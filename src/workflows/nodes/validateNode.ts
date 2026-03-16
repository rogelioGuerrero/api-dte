import { DTEState } from "../state";
import { resolveDteHandler } from "../../dte/registry/resolveDteHandler";
import { createLogger } from "../../utils/logger";

const logger = createLogger('validateNode');

export const validateNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🕵️ Agente Validador: Revisando estructura y reglas de negocio...");

  if (!state.dte) {
    return {
      isValid: false,
      validationErrors: ["No se recibió DTE para validar"],
      status: 'failed',
      errorCode: 'VALIDATION_NO_DTE',
      canRetry: false,
      progressPercentage: 10,
      currentStep: 'validator'
    };
  }

  // 1) Validar consistencia usando el DTE crudo que envió frontend (sin normalizar)
  try {
    const rawDte: any = state.dte;
    logger.info('DTE crudo recibido', {
      codigoGeneracion: rawDte?.identificacion?.codigoGeneracion,
      tipoDte: rawDte?.identificacion?.tipoDte,
      resumen: rawDte?.resumen,
      items: rawDte?.cuerpoDocumento,
    });
    const handler = resolveDteHandler(state.dte as any);
    if (!handler) {
      return {
        dte: state.dte,
        isValid: false,
        validationErrors: [`No existe handler configurado para tipoDte ${rawDte?.identificacion?.tipoDte || 'N/D'}`],
        status: 'failed',
        progressPercentage: 10,
        currentStep: 'validator',
        canRetry: false,
        errorCode: 'VALIDATION_HANDLER_NOT_FOUND',
        errorMessage: 'No existe un preparador configurado para este tipo de DTE'
      };
    }

    console.log(`🔍 [validateNode] Usando handler ${handler.tipoDte} para preparar DTE...`);
    const prepared = handler.prepare(state.dte as any);

    if (prepared.isValid) {
      console.log("✅ [validateNode] DTE válido según esquema. Listo para firmar.");
      return {
        dte: prepared.dte,
        isValid: true,
        validationErrors: [],
        status: 'signing',
        progressPercentage: 25,
        currentStep: 'validator',
        estimatedTime: 45,
      };
    }

    console.warn("⚠️ [validateNode] Errores de preparación detectados:", prepared.validationErrors);
    return {
      dte: prepared.dte,
      isValid: false,
      validationErrors: prepared.validationErrors,
      status: 'failed',
      progressPercentage: 10,
      currentStep: 'validator',
      canRetry: false,
      errorCode: 'VALIDATION_FAILED',
      errorMessage: 'Errores de validación DTE',
    };

  } catch (error: any) {
    console.error("❌ [validateNode] Excepción NO CONTROLADA en validateNode:", error);
    return {
      isValid: false,
      validationErrors: [`EXCEPTION_IN_VALIDATOR: ${error?.message || error}`],
      status: 'failed',
      errorCode: 'VALIDATOR_CRASH',
      errorMessage: 'Error interno en el validador',
      currentStep: 'validator'
    };
  }
};
