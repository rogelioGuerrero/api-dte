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
    const receptorEmail = state.dte.receptor?.correo || state.dte.emisor?.correo || process.env.FALLBACK_DTE_EMAIL;

    if (!receptorEmail) {
      logger.warn('No hay correo de receptor/emisor; se omite envío de email', {
        codigoGeneracion: state.dte.codigoGeneracion
      });

      return {
        emailSent: false,
        emailError: 'No hay correo de receptor/emisor'
      };
    }

    // 3. Intentar enviar correos (solo receptor)
    let emailResults = {
      receptor: { success: false, error: receptorEmail ? null : 'Receptor sin correo' },
    } as any;

    try {
      const sanitizedDte = { ...state.dte } as any;
      sanitizedDte.identificacion = { ...(state.dte as any).identificacion };
      sanitizedDte.emisor = { ...(state.dte as any).emisor };
      sanitizedDte.receptor = { ...(state.dte as any).receptor };

      // usar el correo efectivo que se determinó (receptor > emisor > fallback)
      if (sanitizedDte.receptor) {
        sanitizedDte.receptor.correo = receptorEmail;
      }

      emailResults = await sendDTEEmails(
        sanitizedDte,
        state.mhResponse,
        state.pdfBase64, // PDF generado por frontend (opcional)
        JSON.stringify(sanitizedDte)
      );
    } catch (emailError) {
      emailResults.receptor.error = emailError instanceof Error ? emailError.message : 'Error desconocido';
    }

    logger.info('Correos enviados', {
      receptorSuccess: emailResults.receptor.success,
      codigoGeneracion: state.dte.codigoGeneracion
    });

    const correoEnviado = !!emailResults.receptor.success;
    const correoError = !emailResults.receptor.success ? emailResults.receptor.error || null : null;

    await updateDTEResponseEmailStatus({
      id: (savedResponse as any).id,
      correoEnviado,
      correoError: correoError || null,
    });

    return {
      emailSent: correoEnviado,
      emailResults: {
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
