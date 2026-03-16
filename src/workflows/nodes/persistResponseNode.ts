import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { saveDTEResponse } from '../../business/dteStorage';

const logger = createLogger('persistResponseNode');

/**
 * Nodo dedicado a persistir la respuesta de MH y el DTE
 */
export async function persistResponseNode(state: DTEState): Promise<Partial<DTEState>> {
  try {
    const dteToPersist = state.preparedDte || state.dte;

    if (!dteToPersist) {
      throw new Error('No hay DTE para persistir');
    }
    if (!state.mhResponse) {
      throw new Error('No hay respuesta de MH para persistir');
    }

    const nitEmisor = state.nit || dteToPersist?.emisor?.nit || dteToPersist?.identificacion?.nit;
    const businessId = state.businessId;

    if (!nitEmisor || !businessId) {
      throw new Error('No se puede identificar el emisor del DTE');
    }

    const savedResponse = await saveDTEResponse({
      businessId: businessId!,
      nit: nitEmisor,
      dteJson: dteToPersist,
      mhResponse: state.mhResponse,
      ambiente: dteToPersist.identificacion.ambiente || state.ambiente || '00',
      tipoDte: (dteToPersist as any).tipoDte || dteToPersist.identificacion?.tipoDte,
      codigoGeneracion: dteToPersist.identificacion?.codigoGeneracion,
      selloRecibido: state.mhResponse.selloRecibido || state.mhResponse.selloRecepcion,
    });

    logger.info('Respuesta MH guardada en Supabase', {
      responseId: savedResponse.id,
      codigoGeneracion: dteToPersist.identificacion?.codigoGeneracion,
    });

    return {
      responseId: savedResponse.id,
      persistenceSaved: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Error en persistResponseNode', { error: errorMessage, codigoGeneracion: state.preparedDte?.identificacion?.codigoGeneracion || state.dte?.identificacion?.codigoGeneracion });
    return {
      persistenceSaved: false,
      persistenceError: errorMessage,
    };
  }
}
