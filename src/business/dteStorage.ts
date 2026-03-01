import { supabase } from '../database/supabase';
import { createLogger } from '../utils/logger';
import { createHash } from 'crypto';

const logger = createLogger('dteStorage');

export interface DTEResponse {
  businessId: string;
  nit: string;
  dteJson: any;
  mhResponse: any;
  ambiente: string;
  tipoDte?: string;
  codigoGeneracion: string;
  selloRecibido?: string;
  correoEnviado?: boolean;
  correoError?: string;
}

export interface DTEResponseEmailStatus {
  id: string;
  correoEnviado: boolean;
  correoError?: string | null;
}

const toDeterministicUUID = (value: string) => {
  const hash = createHash('sha1').update(value).digest('hex');
  const bytes = hash.slice(0, 32).split('');
  bytes[12] = '5';
  const variant = parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const b = bytes.join('');
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20, 32)}`;
};

/**
 * Guardar respuesta completa de MH en Supabase
 */
export async function saveDTEResponse(responseData: DTEResponse) {
  try {
    const rawBiz = responseData.businessId || responseData.nit;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(rawBiz);
    const nitClean = (responseData.nit || rawBiz || '').replace(/[^0-9]/g, '');
    const businessId = isUuid ? rawBiz : toDeterministicUUID(nitClean || rawBiz);
    const codigoGeneracion = responseData.codigoGeneracion
      || responseData.dteJson?.identificacion?.codigoGeneracion
      || responseData.mhResponse?.codigoGeneracion
      || null;

    const { data, error } = await supabase
      .from('dte_responses')
      .insert({
        business_id: businessId,
        nit: responseData.nit,
        dte_json: responseData.dteJson,
        mh_response: responseData.mhResponse,
        ambiente: responseData.ambiente,
        tipo_dte: responseData.tipoDte || responseData.dteJson?.identificacion?.tipoDte || responseData.mhResponse?.tipoDte || null,
        codigo_generacion: codigoGeneracion,
        sello_recibido: responseData.selloRecibido
          || responseData.mhResponse?.selloRecepcion
          || responseData.mhResponse?.selloRecibido,
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
 * Actualiza solo el estado de correo de una respuesta existente
 */
export async function updateDTEResponseEmailStatus(payload: DTEResponseEmailStatus) {
  try {
    const { data, error } = await supabase
      .from('dte_responses')
      .update({
        correo_enviado: payload.correoEnviado,
        correo_error: payload.correoError ?? null
      })
      .eq('id', payload.id)
      .select()
      .single();

    if (error) {
      logger.error('Error actualizando estado de correo DTE', { error, payload });
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error en updateDTEResponseEmailStatus', { error, payload });
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
