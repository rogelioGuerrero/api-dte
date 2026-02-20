import { MonthlyTaxAccumulator } from './types';

export const getPeriodFromDate = (dateStr: string): { month: string; year: string; key: string } => {
  const date = new Date(dateStr);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return { month, year, key: `${year}-${month}` };
};

export const createEmptyAccumulator = (periodKey: { key: string }, businessId: string): MonthlyTaxAccumulator => {
  return {
    business_id: businessId,
    period_date: periodKey.key,
    tipo_dte: 'ALL',
    total_exentas: 0,
    total_no_sujetas: 0,
    total_gravadas: 0,
    total_iva: 0,
    total_rete_iva: 0,
    total_rete_renta: 0,
    total_operaciones: 0,
    cantidad_documentos: 0,
    updated_at: new Date().toISOString()
  };
};

export const updateTaxAccumulator = (acc: MonthlyTaxAccumulator, dte: any, flowType: 'emission' | 'reception' = 'emission'): MonthlyTaxAccumulator => {
  const newAcc = { ...acc };
  
  // Asumimos estructura estándar de DTE JSON (FE o CCF)
  const resumen = dte.resumen;
  
  if (resumen) {
    const gravada = resumen.totalGravada || 0;
    const exenta = resumen.totalExenta || 0;
    const noSujeta = resumen.totalNoSujeta || 0;
    
    let iva = 0;
    if (resumen.tributos && Array.isArray(resumen.tributos)) {
       const ivaTributo = resumen.tributos.find((t: any) => t.codigo === '20');
       if (ivaTributo) {
         iva = (ivaTributo.valor || 0);
       }
    }

    if (flowType === 'emission') {
      // --- VENTAS (Débito Fiscal) ---
      newAcc.total_gravadas += gravada;
      newAcc.total_exentas += exenta;
      newAcc.total_no_sujetas += noSujeta;
      newAcc.total_iva += iva;
      newAcc.total_operaciones += (gravada + exenta + noSujeta);
      
    } else {
      // --- COMPRAS (Crédito Fiscal) ---
      // Para simplificar, acumulamos compras en los mismos campos pero con tipo_dte diferente
      const tipoDte = dte.identificacion?.tipoDte;
      
      // Si es DTE de compra, afectamos el crédito fiscal
      if (tipoDte === '03' || tipoDte === '05' || tipoDte === '14') {
        // Para compras, restamos del total (crédito)
        newAcc.total_gravadas -= gravada; // Crédito fiscal
        newAcc.total_exentas -= exenta;
        newAcc.total_no_sujetas -= noSujeta;
        newAcc.total_iva -= iva; // IVA crédito
      }
      
      // Retenciones recibidas (DTE 07)
      if (tipoDte === '07') {
         newAcc.total_rete_iva += (resumen.totalRetencion || 0);
      }
    }
  }
  
  newAcc.updated_at = new Date().toISOString();
  return newAcc;
};
