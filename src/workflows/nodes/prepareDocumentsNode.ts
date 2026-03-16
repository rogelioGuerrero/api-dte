import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { generateDtePdfBase64 } from '../../services/pdfGenerator';

const logger = createLogger('prepareDocumentsNode');

/**
 * Nodo encargado de preparar documentos (PDF/JSON) para envío
 * - Genera PDF si no existe en el estado
 * - Ajusta correo receptor en una copia sanitizada
 */
export async function prepareDocumentsNode(state: DTEState): Promise<Partial<DTEState>> {
  try {
    const dteToPrepare = state.preparedDte || state.dte;

    if (!dteToPrepare) {
      throw new Error('No hay DTE para preparar documentos');
    }

    const receptorEmail = state.receptorEmail || dteToPrepare.receptor?.correo || dteToPrepare.emisor?.correo;
    const sanitizedDte = (() => {
      const copy = { ...dteToPrepare } as any;
      copy.identificacion = { ...(dteToPrepare as any).identificacion };
      copy.emisor = { ...(dteToPrepare as any).emisor };
      copy.receptor = dteToPrepare.receptor ? { ...(dteToPrepare as any).receptor } : undefined;
      if (copy.receptor && receptorEmail) copy.receptor.correo = receptorEmail;
      return copy;
    })();

    let pdfBase64 = state.pdfBase64;
    if (!pdfBase64) {
      try {
        pdfBase64 = await generateDtePdfBase64({
          dte: sanitizedDte,
          mhResponse: state.mhResponse,
          logoUrl: sanitizedDte.emisor?.logo_url || sanitizedDte.emisor?.logoUrl,
        });
        logger.info('PDF generado en prepareDocumentsNode', {
          codigoGeneracion: sanitizedDte.identificacion?.codigoGeneracion,
          length: pdfBase64?.length,
        });
      } catch (pdfError: any) {
        logger.warn('No se pudo generar PDF; se continuará sin PDF', { error: pdfError?.message });
      }
    }

    return {
      sanitizedDte,
      pdfBase64,
      documentsPrepared: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('Error en prepareDocumentsNode', { error: errorMessage, codigoGeneracion: state.preparedDte?.identificacion?.codigoGeneracion || state.dte?.identificacion?.codigoGeneracion });
    return {
      documentsPrepared: false,
      documentsError: errorMessage,
    };
  }
}
