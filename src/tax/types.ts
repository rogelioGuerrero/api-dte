export interface MonthlyTaxAccumulator {
  id?: string;
  business_id: string;
  period_date: string; // "YYYY-MM-DD" (first day of month)
  tipo_dte: string;
  
  // Acumuladores del mes
  total_exentas: number;
  total_no_sujetas: number;
  total_gravadas: number;
  total_iva: number;
  total_rete_iva: number;
  total_rete_renta: number;
  total_operaciones: number;
  
  // Contadores
  cantidad_documentos: number;
  
  created_at?: string;
  updated_at?: string;
}
