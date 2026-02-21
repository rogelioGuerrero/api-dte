import { DTEState } from "../state";
import { updateTaxAccumulator, createEmptyAccumulator, getPeriodFromDate } from "../../tax/taxCalculator";
import { getAccumulator, saveAccumulator } from '../../tax/taxStorage';

export const taxNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log(`📊 Contador Autónomo (${state.flowType || 'emission'}): Actualizando libros...`);
  
  if (state.status !== 'completed' || !state.dte) {
    return {};
  }

  try {
    const period = getPeriodFromDate(state.dte.identificacion.fecEmi);
    const existingAcc = await getAccumulator(state.businessId!, period.key, 'ALL');
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();
    const baseAcc = existingAcc || createEmptyAccumulator(period, state.businessId!);
    
    // Pasamos el flowType para distinguir si suma a Ventas o Compras
    const updatedAcc = updateTaxAccumulator(baseAcc, state.dte, state.flowType);
    
    await saveAccumulator(updatedAcc);

    console.log(`💰 Impacto Fiscal Guardado: ${state.flowType === 'reception' ? 'Crédito' : 'Débito'} actualizado.`);

    return {
      taxImpact: updatedAcc
    };
  } catch (error) {
    console.error("❌ Error en Contador Autónomo:", error);
    return {};
  }
};
