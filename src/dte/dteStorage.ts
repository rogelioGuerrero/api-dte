import { supabase } from '../database/supabase';
import { createLogger } from '../utils/logger';
import { DTEJSON } from './generator';

const logger = createLogger('dteStorage');

const normalizeTimestampForDb = (value?: string | null): string | null => {
  if (!value) return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const isoCandidate = new Date(trimmed);
  if (!Number.isNaN(isoCandidate.getTime())) {
    return isoCandidate.toISOString();
  }

  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, dd, mm, yyyy, hh, mi, ss] = match;
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  return trimmed;
};

export interface DTEDocument {
  id?: string;
  codigo_generacion: string;
  tipo_dte: string;
  numero_control: string;
  sello_recibido?: string;
  fh_procesamiento?: string;
  business_id: string;
  issuer_nit: string;
  receiver_nit?: string;
  dte_json: DTEJSON;
  firma_jws?: string;
  estado: string;
  clase_documento: string;
  mh_response?: any;
  pdf_url?: string;
  xml_url?: string;
  json_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const saveDTEDocument = async (doc: DTEDocument): Promise<void> => {
  try {
    const { error } = await supabase
      .from('dte_documents')
      .upsert({
        codigo_generacion: doc.codigo_generacion,
        tipo_dte: doc.tipo_dte,
        numero_control: doc.numero_control,
        sello_recibido: doc.sello_recibido,
        fh_procesamiento: normalizeTimestampForDb(doc.fh_procesamiento),
        business_id: doc.business_id,
        issuer_nit: doc.issuer_nit,
        receiver_nit: doc.receiver_nit,
        estado: doc.estado,
        clase_documento: doc.clase_documento,
        dte_json: doc.dte_json,
        firma_jws: doc.firma_jws,
        mh_response: doc.mh_response,
        pdf_url: doc.pdf_url,
        xml_url: doc.xml_url,
        json_url: doc.json_url,
        updated_at: new Date().toISOString()
      }, { onConflict: 'codigo_generacion' });

    if (error) throw error;

    logger.info('DTE document saved successfully', { codigoGeneracion: doc.codigo_generacion, businessId: doc.business_id });
  } catch (error: any) {
    logger.error('Error saving DTE document', { error: error.message });
    throw error;
  }
};

export const getDTEDocument = async (codigoGeneracion: string): Promise<DTEDocument | null> => {
  try {
    const { data, error } = await supabase
      .from('dte_documents')
      .select('*')
      .eq('codigo_generacion', codigoGeneracion)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as DTEDocument;
  } catch (error: any) {
    logger.error('Error fetching DTE document', { error: error.message });
    throw error;
  }
};

export const getDTEDocumentByNumeroControl = async (
  businessId: string,
  numeroControl: string,
  tipoDte?: string
): Promise<DTEDocument | null> => {
  try {
    let query = supabase
      .from('dte_documents')
      .select('*')
      .eq('business_id', businessId)
      .eq('numero_control', numeroControl)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (tipoDte) {
      query = query.eq('tipo_dte', tipoDte);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    return (data as DTEDocument | null) ?? null;
  } catch (error: any) {
    logger.error('Error fetching DTE document by numero_control', {
      error: error.message,
      businessId,
      numeroControl,
      tipoDte,
    });
    throw error;
  }
};

export const getDTEsByPeriod = async (startDate: string, endDate: string, businessId: string): Promise<DTEDocument[]> => {
  try {
    const { data, error } = await supabase
      .from('dte_documents')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []) as DTEDocument[];
  } catch (error: any) {
    logger.error('Error fetching DTEs by period', { error: error.message });
    throw error;
  }
};

export const getDTEsByBusiness = async (
  businessId: string,
  options?: {
    tipoDte?: string;
    claseDocumento?: string;
    estado?: string;
    limit?: number;
    offset?: number;
  }
): Promise<DTEDocument[]> => {
  try {
    let query = supabase
      .from('dte_documents')
      .select('*')
      .eq('business_id', businessId);

    if (options?.tipoDte) {
      query = query.eq('tipo_dte', options.tipoDte);
    }
    if (options?.claseDocumento) {
      query = query.eq('clase_documento', options.claseDocumento);
    }
    if (options?.estado) {
      query = query.eq('estado', options.estado);
    }

    query = query.order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as DTEDocument[];
  } catch (error: any) {
    logger.error('Error fetching DTEs by business', { error: error.message });
    throw error;
  }
};

export const updateDTEDocumentStatus = async (
  codigoGeneracion: string,
  newStatus: string,
  additionalData?: Partial<DTEDocument>
): Promise<void> => {
  try {
    const updateData: any = {
      estado: newStatus,
      updated_at: new Date().toISOString()
    };

    if (additionalData) {
      if (additionalData.mh_response) updateData.mh_response = additionalData.mh_response;
      if (additionalData.pdf_url) updateData.pdf_url = additionalData.pdf_url;
      if (additionalData.xml_url) updateData.xml_url = additionalData.xml_url;
      if (additionalData.json_url) updateData.json_url = additionalData.json_url;
      if (additionalData.sello_recibido) updateData.sello_recibido = additionalData.sello_recibido;
      if (additionalData.fh_procesamiento) updateData.fh_procesamiento = additionalData.fh_procesamiento;
    }

    const { error } = await supabase
      .from('dte_documents')
      .update(updateData)
      .eq('codigo_generacion', codigoGeneracion);

    if (error) throw error;

    logger.info('DTE document status updated', { codigoGeneracion, newStatus });
  } catch (error: any) {
    logger.error('Error updating DTE document status', { error: error.message, codigoGeneracion });
    throw error;
  }
};
