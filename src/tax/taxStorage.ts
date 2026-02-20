import { supabase } from '../database/supabase';
import { MonthlyTaxAccumulator } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('taxStorage');

export const getAccumulator = async (businessId: string, periodDate: string, tipoDte: string): Promise<MonthlyTaxAccumulator | undefined> => {
  try {
    const { data, error } = await supabase
      .from('tax_accumulators')
      .select('*')
      .eq('business_id', businessId)
      .eq('period_date', periodDate)
      .eq('tipo_dte', tipoDte)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return undefined; // No found
      throw error;
    }

    return data as MonthlyTaxAccumulator;
  } catch (error: any) {
    logger.error('Error fetching tax accumulator', { error: error.message });
    throw error;
  }
};

export const saveAccumulator = async (accumulator: MonthlyTaxAccumulator): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tax_accumulators')
      .upsert({
        business_id: accumulator.business_id,
        period_date: accumulator.period_date,
        tipo_dte: accumulator.tipo_dte,
        total_exentas: accumulator.total_exentas,
        total_no_sujetas: accumulator.total_no_sujetas,
        total_gravadas: accumulator.total_gravadas,
        total_iva: accumulator.total_iva,
        total_rete_iva: accumulator.total_rete_iva,
        total_rete_renta: accumulator.total_rete_renta,
        total_operaciones: accumulator.total_operaciones,
        cantidad_documentos: accumulator.cantidad_documentos,
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_id,period_date,tipo_dte' });

    if (error) throw error;
    
    logger.info('Tax accumulator saved successfully', { 
      businessId: accumulator.business_id, 
      period: accumulator.period_date, 
      tipoDte: accumulator.tipo_dte 
    });
  } catch (error: any) {
    logger.error('Error saving tax accumulator', { error: error.message });
    throw error;
  }
};

export const getAllAccumulators = async (businessId: string, year?: number): Promise<MonthlyTaxAccumulator[]> => {
  try {
    let query = supabase
      .from('tax_accumulators')
      .select('*')
      .eq('business_id', businessId);

    if (year) {
      query = query.gte('period_date', `${year}-01-01`).lte('period_date', `${year}-12-31`);
    }

    const { data, error } = await query.order('period_date', { ascending: false });

    if (error) throw error;

    return (data || []) as MonthlyTaxAccumulator[];
  } catch (error: any) {
    logger.error('Error fetching all accumulators', { error: error.message });
    throw error;
  }
};

export const deleteAccumulator = async (businessId: string, periodDate: string, tipoDte: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('tax_accumulators')
      .delete()
      .eq('business_id', businessId)
      .eq('period_date', periodDate)
      .eq('tipo_dte', tipoDte);

    if (error) {
      logger.error('Error deleting accumulator', { businessId, periodDate, tipoDte, error: error.message });
      throw error;
    }
    
    logger.info('Tax accumulator deleted successfully', { businessId, periodDate, tipoDte });
  } catch (error: any) {
    logger.error('Error in deleteAccumulator', { error: error.message });
    throw error;
  }
};

// Nuevas funciones para el nuevo esquema

export const getAccumulatorsByMonth = async (businessId: string, year: number, month: number): Promise<MonthlyTaxAccumulator[]> => {
  try {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

    const { data, error } = await supabase
      .from('tax_accumulators')
      .select('*')
      .eq('business_id', businessId)
      .gte('period_date', startDate)
      .lte('period_date', endDate)
      .order('tipo_dte', { ascending: true });

    if (error) throw error;

    return (data || []) as MonthlyTaxAccumulator[];
  } catch (error: any) {
    logger.error('Error fetching accumulators by month', { error: error.message });
    throw error;
  }
};

export const getMonthlySummary = async (businessId: string, year: number, month: number): Promise<{
  totalDocuments: number;
  totalOperaciones: number;
  totalIVA: number;
  totalRetenciones: number;
}> => {
  try {
    const accumulators = await getAccumulatorsByMonth(businessId, year, month);
    
    const summary = accumulators.reduce((acc, curr) => ({
      totalDocuments: acc.totalDocuments + curr.cantidad_documentos,
      totalOperaciones: acc.totalOperaciones + curr.total_operaciones,
      totalIVA: acc.totalIVA + curr.total_iva,
      totalRetenciones: acc.totalRetenciones + curr.total_rete_iva + curr.total_rete_renta
    }), {
      totalDocuments: 0,
      totalOperaciones: 0,
      totalIVA: 0,
      totalRetenciones: 0
    });
    
    return summary;
  } catch (error: any) {
    logger.error('Error getting monthly summary', { error: error.message });
    throw error;
  }
};
