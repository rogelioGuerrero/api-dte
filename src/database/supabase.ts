import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const logger = createLogger('supabase');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Verificar conexión
export const testConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('dte_documents').select('id').limit(1);
    if (error) {
      logger.error('Error conectando a Supabase', { error: error.message });
      return false;
    }
    logger.info('Conexión a Supabase exitosa');
    return true;
  } catch (error: any) {
    logger.error('Error verificando conexión a Supabase', { error: error.message });
    return false;
  }
};
