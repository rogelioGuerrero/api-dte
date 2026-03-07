import { DTEState } from "../state";
import { updateTaxAccumulator, createEmptyAccumulator, getPeriodFromDate } from "../../tax/taxCalculator";
import { getAccumulator, saveAccumulator } from '../../tax/taxStorage';

export const taxNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log(`📊 Contador Autónomo (${state.flowType || 'emission'}): Actualizando libros...`);
  
  if (state.status !== 'completed' || !state.dte) {
    return {};
  }

  try {
    const businessKey = (state.businessId || '').toString().trim();
    if (!businessKey) {
      console.warn('TaxNode: sin businessId UUID, no se actualiza acumulador');
      return {};
    }

    const period = getPeriodFromDate(state.dte.identificacion.fecEmi);
    let existingAcc = await getAccumulator(businessKey, period.key, 'ALL');
    if (!existingAcc) {
      // Si no existe business en Supabase, opcionalmente podríamos abortar; por ahora creamos acumulador local
      existingAcc = createEmptyAccumulator(period, businessKey);
    }
    const baseAcc = existingAcc;
    
    // Pasamos el flowType para distinguir si suma a Ventas o Compras
    const updatedAcc = updateTaxAccumulator(baseAcc, state.dte, state.flowType);
    
    try {
      await saveAccumulator(updatedAcc);
      console.log(`💰 Impacto Fiscal Guardado: ${state.flowType === 'reception' ? 'Crédito' : 'Débito'} actualizado.`);
    } catch (err: any) {
      if (err?.code === '23503') {
        console.warn('TaxNode: business_id no existe en businesses; se omite guardar acumulador', { businessKey });
      } else {
        throw err;
      }
    }

    return {
      taxImpact: updatedAcc
    };
  } catch (error) {
    console.error("❌ Error en Contador Autónomo:", error);
    return {};
  }
};
