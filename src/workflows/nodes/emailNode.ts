import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { saveDTEResponse, updateDTEResponseEmailStatus } from '../../business/dteStorage';
import { sendDTEEmails } from '../../services/emailService';

const logger = createLogger('emailNode');

/**
 * Nodo para enviar correos electrónicos después de procesar DTE
 */
export async function emailNode(state: DTEState): Promise<Partial<DTEState>> {
  try {
    // Validaciones iniciales
    if (!state.dte) {
      throw new Error('No hay DTE para enviar correo');
    }

    if (!state.mhResponse) {
      throw new Error('No hay respuesta de MH para enviar correo');
    }

    const nitEmisor = state.dte?.emisor?.nit || state.dte?.identificacion?.nit;
    const businessId = state.businessId || nitEmisor;
    if (!nitEmisor) {
      throw new Error('No se puede identificar el emisor del DTE');
    }

    logger.info('Iniciando envío de correos para DTE', {
      codigoGeneracion: state.dte.codigoGeneracion,
      nit: nitEmisor
    });

    // 1. Guardar respuesta MH en Supabase
    const savedResponse = await saveDTEResponse({
      businessId: businessId,
      nit: nitEmisor,
      dteJson: state.dte,
      mhResponse: state.mhResponse,
      ambiente: state.dte.identificacion.ambiente || '00',
      tipoDte: state.dte.tipoDte,
      codigoGeneracion: state.dte.codigoGeneracion,
      selloRecibido: state.mhResponse.selloRecibido
    });

    logger.info('Respuesta MH guardada en Supabase', { 
      responseId: savedResponse.id,
      codigoGeneracion: state.dte.codigoGeneracion 
    });

    // 2. Enviar correos (si hay emails)
    const emisorEmail = state.dte.identificacion?.correo || state.dte.emisor?.correo;
    const receptorEmail = state.dte.receptor?.correo;

    if (!emisorEmail && !receptorEmail) {
      logger.warn('No hay correos para enviar', {
        codigoGeneracion: state.dte.codigoGeneracion
      });

      return {
        emailSent: false,
        emailError: 'No hay correos de emisor ni receptor'
      };
    }

    // 3. Intentar enviar correos
    let emailResults = {
      emisor: { success: false, error: emisorEmail ? null : 'Emisor sin correo' },
      receptor: { success: false, error: receptorEmail ? null : 'Receptor sin correo' },
    } as any;

    // Solo llamamos al servicio si hay al menos un destinatario válido
    if (emisorEmail || receptorEmail) {
      try {
        // Clonar DTE y limpiar correos vacíos para que el servicio no intente enviarlos
        const sanitizedDte = { ...state.dte } as any;
        sanitizedDte.identificacion = { ...(state.dte as any).identificacion };
        sanitizedDte.emisor = { ...(state.dte as any).emisor };
        sanitizedDte.receptor = { ...(state.dte as any).receptor };

        if (!emisorEmail) {
          sanitizedDte.identificacion.correo = undefined;
          if (sanitizedDte.emisor) sanitizedDte.emisor.correo = undefined;
        }
        if (!receptorEmail && sanitizedDte.receptor) {
          sanitizedDte.receptor.correo = undefined;
        }

        // Verificar si quedó al menos un destinatario tras limpiar
        const hasAnyRecipient = (sanitizedDte.identificacion?.correo || sanitizedDte.emisor?.correo || sanitizedDte.receptor?.correo);

        if (hasAnyRecipient) {
          emailResults = await sendDTEEmails(
            sanitizedDte,
            state.mhResponse,
            state.pdfBase64 // PDF generado por frontend (opcional)
          );
        }
      } catch (emailError) {
        emailResults.emisor.error = emailError instanceof Error ? emailError.message : 'Error desconocido';
        emailResults.receptor.error = emailResults.receptor.error || emailResults.emisor.error;
      }
    }

    logger.info('Correos enviados', {
      emisorSuccess: emailResults.emisor.success,
      receptorSuccess: emailResults.receptor.success,
      codigoGeneracion: state.dte.codigoGeneracion
    });

    const correoEnviado = !!(emailResults.emisor.success || emailResults.receptor.success);
    const correoError = (!emailResults.emisor.success || !emailResults.receptor.success)
      ? `${emailResults.emisor.error || ''} | ${emailResults.receptor.error || ''}`.trim()
      : null;

    await updateDTEResponseEmailStatus({
      id: (savedResponse as any).id,
      correoEnviado,
      correoError: correoError || null,
    });

    return {
      emailSent: correoEnviado,
      emailResults: {
        emisor: emailResults.emisor.success,
        receptor: emailResults.receptor.success
      },
      emailError: correoError || undefined,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    logger.error('Error en emailNode', {
      error: errorMessage,
      codigoGeneracion: state.dte?.codigoGeneracion
    });

    // El error de correo no debe detener el workflow
    return {
      emailSent: false,
      emailError: errorMessage
    };
  }
}
