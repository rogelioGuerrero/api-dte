import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { updateDTEResponseEmailStatus } from '../../business/dteStorage';
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
    if (!nitEmisor) {
      throw new Error('No se puede identificar el emisor del DTE');
    }

    logger.info('Iniciando envío de correos para DTE', {
      codigoGeneracion: state.dte.codigoGeneracion,
      nit: nitEmisor
    });

    // Enviar correos (si hay emails)
    const receptorEmail = state.receptorEmail || state.dte.receptor?.correo || state.dte.emisor?.correo;

    if (!receptorEmail) {
      logger.warn('No hay correo de receptor/emisor; se aborta envío de email', {
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
      const sanitizedDte = (state as any).sanitizedDte || (() => {
        const copy = { ...state.dte } as any;
        copy.identificacion = { ...(state.dte as any).identificacion };
        copy.emisor = { ...(state.dte as any).emisor };
        copy.receptor = state.dte.receptor ? { ...(state.dte as any).receptor } : undefined;
        if (copy.receptor) copy.receptor.correo = receptorEmail;
        return copy;
      })();

      const pdfBase64 = state.pdfBase64;

      emailResults = await sendDTEEmails(
        sanitizedDte,
        state.mhResponse,
        pdfBase64, // PDF generado en backend
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

    if (state.responseId) {
      await updateDTEResponseEmailStatus({
        id: state.responseId,
        correoEnviado,
        correoError: correoError || null,
      });
    }

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
