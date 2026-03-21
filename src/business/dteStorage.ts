import { supabase } from '../database/supabase';
import { createLogger } from '../utils/logger';

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
  correoMessageId?: string | null;
  correoDestinatario?: string | null;
  correoEnviadoAt?: string | null;
}

export interface DTEResponseEmailStatus {
  id: string;
  correoEnviado: boolean;
  correoError?: string | null;
  correoMessageId?: string | null;
  correoDestinatario?: string | null;
  correoEnviadoAt?: string | null;
}

/**
 * Guardar respuesta completa de MH en Supabase
 */
export async function saveDTEResponse(responseData: DTEResponse) {
  try {
    const businessId = responseData.businessId;
    if (!businessId) {
      throw new Error('businessId UUID es requerido para guardar respuesta DTE');
    }
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
        correo_error: responseData.correoError,
        correo_message_id: responseData.correoMessageId ?? null,
        correo_destinatario: responseData.correoDestinatario ?? null,
        correo_enviado_at: responseData.correoEnviadoAt ?? null,
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
        correo_error: payload.correoError ?? null,
        correo_message_id: payload.correoMessageId ?? null,
        correo_destinatario: payload.correoDestinatario ?? null,
        correo_enviado_at: payload.correoEnviadoAt ?? null,
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

export async function getDTEResponseByNumeroControl(
  businessId: string,
  numeroControl: string,
  ambiente?: string,
  tipoDte?: string
) {
  try {
    let query = supabase
      .from('dte_responses')
      .select('*')
      .eq('business_id', businessId)
      .eq('dte_json->identificacion->>numeroControl', numeroControl)
      .order('fecha_hora_procesamiento', { ascending: false })
      .limit(1);

    if (ambiente) {
      query = query.eq('ambiente', ambiente);
    }

    if (tipoDte) {
      query = query.eq('tipo_dte', tipoDte);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error('Error buscando respuesta DTE por número de control', {
        error,
        businessId,
        numeroControl,
        ambiente,
        tipoDte,
      });
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error en getDTEResponseByNumeroControl', {
      error,
      businessId,
      numeroControl,
      ambiente,
      tipoDte,
    });
    throw error;
  }
}
