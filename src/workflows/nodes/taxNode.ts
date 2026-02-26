import { DTEState } from "../state";
import { updateTaxAccumulator, createEmptyAccumulator, getPeriodFromDate } from "../../tax/taxCalculator";
import { getAccumulator, saveAccumulator } from '../../tax/taxStorage';
import { createHash } from 'crypto';

const toDeterministicUUID = (value: string) => {
  const hash = createHash('sha1').update(value).digest('hex');
  const bytes = hash.slice(0, 32).split('');
  bytes[12] = '5'; // version 5
  const variant = parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  const b = bytes.join('');
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20, 32)}`;
};

export const taxNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log(`📊 Contador Autónomo (${state.flowType || 'emission'}): Actualizando libros...`);
  
  if (state.status !== 'completed' || !state.dte) {
    return {};
  }

  try {
    const rawBusinessId = (state.businessId || state.dte.emisor?.nit || '').toString().trim();
    if (!rawBusinessId) {
      console.warn('TaxNode: sin businessId/nit, no se actualiza acumulador');
      return {};
    }

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(rawBusinessId);
    const nitClean = rawBusinessId.replace(/[^0-9]/g, '');
    const businessKey = isUuid ? rawBusinessId : toDeterministicUUID(nitClean || rawBusinessId);

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
