import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { saveDTEResponse } from '../../business/dteStorage';

const logger = createLogger('persistResponseNode');

/**
 * Nodo dedicado a persistir la respuesta de MH y el DTE
 */
export async function persistResponseNode(state: DTEState): Promise<Partial<DTEState>> {
  try {
    if (!state.dte) {
      throw new Error('No hay DTE para persistir');
    }
    if (!state.mhResponse) {
      throw new Error('No hay respuesta de MH para persistir');
    }

    const nitEmisor = state.nit || state.dte?.emisor?.nit || state.dte?.identificacion?.nit;
    const businessId = state.businessId;

    if (!nitEmisor || !businessId) {
      throw new Error('No se puede identificar el emisor del DTE');
    }

    const savedResponse = await saveDTEResponse({
      businessId: businessId!,
      nit: nitEmisor,
      dteJson: state.dte,
      mhResponse: state.mhResponse,
      ambiente: state.dte.identificacion.ambiente || state.ambiente || '00',
      tipoDte: (state.dte as any).tipoDte || state.dte.identificacion?.tipoDte,
      codigoGeneracion: state.dte.identificacion?.codigoGeneracion || state.dte.codigoGeneracion,
      selloRecibido: state.mhResponse.selloRecibido || state.mhResponse.selloRecepcion,
    });

    logger.info('Respuesta MH guardada en Supabase', {
      responseId: savedResponse.id,
      codigoGeneracion: state.dte.identificacion?.codigoGeneracion || state.dte.codigoGeneracion,
    });

    return {
      responseId: savedResponse.id,
      persistenceSaved: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Error en persistResponseNode', { error: errorMessage, codigoGeneracion: state.dte?.codigoGeneracion });
    return {
      persistenceSaved: false,
      persistenceError: errorMessage,
    };
  }
}
