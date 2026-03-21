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
    const dteToEmail = state.preparedDte || state.dte;

    // Validaciones iniciales
    if (!dteToEmail) {
      throw new Error('No hay DTE para enviar correo');
    }

    if (!state.mhResponse) {
      throw new Error('No hay respuesta de MH para enviar correo');
    }

    const nitEmisor = dteToEmail?.emisor?.nit || dteToEmail?.identificacion?.nit;
    if (!nitEmisor) {
      throw new Error('No se puede identificar el emisor del DTE');
    }

    logger.info('Iniciando envío de correos para DTE', {
      codigoGeneracion: dteToEmail.identificacion?.codigoGeneracion,
      nit: nitEmisor
    });

    // Enviar correos (si hay emails)
    const receptorEmail = state.receptorEmail || dteToEmail.receptor?.correo || dteToEmail.emisor?.correo;

    if (!receptorEmail) {
      logger.warn('No hay correo de receptor/emisor; se aborta envío de email', {
        codigoGeneracion: dteToEmail.identificacion?.codigoGeneracion
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
        const copy = { ...dteToEmail } as any;
        copy.identificacion = { ...(dteToEmail as any).identificacion };
        copy.emisor = { ...(dteToEmail as any).emisor };
        copy.receptor = dteToEmail.receptor ? { ...(dteToEmail as any).receptor } : undefined;
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

    const receptorMessageId = emailResults.receptor.messageId || null;
    const correoEnviado = !!(emailResults.receptor.success && receptorMessageId);
    const correoError = !correoEnviado ? emailResults.receptor.error || null : null;
    const correoEnviadoAt = correoEnviado ? new Date().toISOString() : null;

    logger.info('Correos enviados', {
      receptorSuccess: emailResults.receptor.success,
      receptorEmail,
      receptorMessageId,
      correoEnviado,
      codigoGeneracion: dteToEmail.identificacion?.codigoGeneracion
    });

    if (state.responseId) {
      await updateDTEResponseEmailStatus({
        id: state.responseId,
        correoEnviado,
        correoError: correoError || null,
        correoMessageId: receptorMessageId,
        correoDestinatario: receptorEmail || null,
        correoEnviadoAt,
      });
    }

    return {
      emailSent: correoEnviado,
      emailMessageId: receptorMessageId || undefined,
      emailRecipient: receptorEmail || undefined,
      emailSentAt: correoEnviadoAt || undefined,
      emailResults: {
        receptor: emailResults.receptor.success
      },
      emailError: correoError || undefined,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    logger.error('Error en emailNode', {
      error: errorMessage,
      codigoGeneracion: state.preparedDte?.identificacion?.codigoGeneracion || state.dte?.identificacion?.codigoGeneracion
    });

    // El error de correo no debe detener el workflow
    return {
      emailSent: false,
      emailError: errorMessage
    };
  }
}
