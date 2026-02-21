import { supabase } from '../database/supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('dteStorage');

export interface DTEResponse {
  businessId: string;
  nit: string;
  dteJson: any;
  mhResponse: any;
  ambiente: string;
  tipoDte: string;
  codigoGeneracion: string;
  selloRecibido?: string;
  correoEnviado?: boolean;
  correoError?: string;
}

/**
 * Guardar respuesta completa de MH en Supabase
 */
export async function saveDTEResponse(responseData: DTEResponse) {
  try {
    const { data, error } = await supabase
      .from('dte_responses')
      .insert({
        business_id: responseData.businessId,
        nit: responseData.nit,
        dte_json: responseData.dteJson,
        mh_response: responseData.mhResponse,
        ambiente: responseData.ambiente,
        tipo_dte: responseData.tipoDte,
        codigo_generacion: responseData.codigoGeneracion,
        sello_recibido: responseData.selloRecibido,
        correo_enviado: responseData.correoEnviado || false,
        correo_error: responseData.correoError
      })
      .select()
      .single();

    if (error) {
      logger.error('Error guardando respuesta DTE', { error, responseData: { ...responseData, dteJson: '[DTE_DATA]', mhResponse: '[MH_RESPONSE]' } });
      throw error;
    }

    logger.info('Respuesta DTE guardada exitosamente', { 
      responseId: data.id,
      codigoGeneracion: responseData.codigoGeneracion 
    });

    return data;
  } catch (error) {
    logger.error('Error en saveDTEResponse', { error, responseData: { ...responseData, dteJson: '[DTE_DATA]', mhResponse: '[MH_RESPONSE]' } });
    throw error;
  }
}

/**
 * Obtener respuestas DTE de un negocio
 */
export async function getDTEResponses(businessId: string, limit = 50, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('dte_responses')
      .select('*')
      .eq('business_id', businessId)
      .order('fecha_hora_procesamiento', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error obteniendo respuestas DTE', { error, businessId });
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error('Error en getDTEResponses', { error, businessId });
    throw error;
  }
}

/**
 * Buscar respuesta DTE por código de generación
 */
export async function getDTEResponseByCodigo(codigoGeneracion: string) {
  try {
    const { data, error } = await supabase
      .from('dte_responses')
      .select('*')
      .eq('codigo_generacion', codigoGeneracion)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error buscando respuesta DTE por código', { error, codigoGeneracion });
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error en getDTEResponseByCodigo', { error, codigoGeneracion });
    throw error;
  }
}
