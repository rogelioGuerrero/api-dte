import { supabase } from './supabase';
import { createLogger } from '../utils/logger';

const logger = createLogger('debugLogger');

export interface DebugSignedDTE {
  codigoGeneracion: string;
  signature: string;
  payload: Record<string, any> | null;
}

export const saveSignedDteDebug = async (data: DebugSignedDTE) => {
  try {
    const { error } = await supabase.from('debug_signed_dte').insert({
      codigo_generacion: data.codigoGeneracion,
      signature: data.signature,
      payload: data.payload,
    });
    if (error) {
      logger.warn('No se pudo guardar debug_signed_dte', { error: error.message });
    }
  } catch (e: any) {
    logger.warn('Excepción guardando debug_signed_dte', { error: e?.message });
  }
};
