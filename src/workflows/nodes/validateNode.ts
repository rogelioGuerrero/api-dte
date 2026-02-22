import { DTEState } from "../state";
import { processDTE } from "../../mh/process";

export const validateNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🕵️ Agente Validador: Revisando estructura y reglas de negocio...");
  
  const dte = state.dte;
  if (!dte) {
    return { 
      isValid: false, 
      validationErrors: ["No se proporcionó un objeto DTE"], 
      status: 'failed',
      errorCode: 'VALIDATION_ERROR_NO_DTE',
      errorMessage: 'No se proporcionó un objeto DTE',
      canRetry: true,
      progressPercentage: 5
    };
  }

  try {
    const processed = processDTE(dte);

    // Debug puntual para rastrear ivaRete1 en runtime
    const resumenIn: any = (dte as any)?.resumen;
    const resumenOut: any = (processed as any)?.dte?.resumen;
    console.log('DEBUG ivaRete1', {
      input: resumenIn?.ivaRete1,
      normalized: resumenOut?.ivaRete1,
    });
    
    if (processed.errores.length > 0) {
      console.warn("❌ Agente Validador: DTE Rechazado", processed.errores);
      return {
        isValid: false,
        validationErrors: processed.errores.map(e => `${e.campo}: ${e.descripcion}`),
        status: 'failed',
        errorCode: 'VALIDATION_ERROR_FIELDS',
        errorMessage: 'El DTE tiene campos inválidos',
        canRetry: true,
        progressPercentage: 20
      };
    }

    console.log("✅ Agente Validador: DTE Aprobado");
    return {
      isValid: true,
      validationErrors: [],
      status: 'signing',
      progressPercentage: 25,
      currentStep: 'validator',
      estimatedTime: 45 // 45 segundos restantes
    };
  } catch (error: any) {
    console.error("❌ Error en validación:", error);
    return {
      status: 'failed',
      errorCode: 'VALIDATION_ERROR_SYSTEM',
      errorMessage: 'Error del sistema al validar DTE',
      canRetry: true,
      progressPercentage: 20
    };
  }
};
