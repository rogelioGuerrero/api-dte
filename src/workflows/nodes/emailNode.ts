import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { saveDTEResponse } from '../../business/dteStorage';
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

    if (!state.dte?.identificacion?.nit) {
      throw new Error('No se puede identificar el emisor del DTE');
    }

    logger.info('Iniciando envío de correos para DTE', {
      codigoGeneracion: state.dte.codigoGeneracion,
      nit: state.dte.identificacion.nit
    });

    // 1. Guardar respuesta MH en Supabase
    const savedResponse = await saveDTEResponse({
      businessId: state.dte.identificacion.nit,
      nit: state.dte.identificacion.nit,
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
    const emisorEmail = state.dte.identificacion?.correo;
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
    let emailResults;
    let emailError = null;

    try {
      emailResults = await sendDTEEmails(
        state.dte,
        state.mhResponse,
        state.pdfBase64 // PDF generado por frontend (opcional)
      );

      logger.info('Correos enviados', {
        emisorSuccess: emailResults.emisor.success,
        receptorSuccess: emailResults.receptor.success,
        codigoGeneracion: state.dte.codigoGeneracion
      });

      // 4. Actualizar registro con estado de correo
      await saveDTEResponse({
        ...savedResponse,
        correoEnviado: emailResults.emisor.success || emailResults.receptor.success,
        correoError: (!emailResults.emisor.success || !emailResults.receptor.success) 
          ? `${emailResults.emisor.error || ''} | ${emailResults.receptor.error || ''}` 
          : null
      });

      return {
        emailSent: true,
        emailResults: {
          emisor: emailResults.emisor.success,
          receptor: emailResults.receptor.success
        }
      };

    } catch (emailError) {
      emailError = emailError instanceof Error ? emailError.message : 'Error desconocido';
      
      logger.error('Error enviando correos', {
        error: emailError,
        codigoGeneracion: state.dte.codigoGeneracion
      });

      // Actualizar registro con error
      await saveDTEResponse({
        ...savedResponse,
        correoEnviado: false,
        correoError: emailError
      });

      return {
        emailSent: false,
        emailError
      };
    }

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
