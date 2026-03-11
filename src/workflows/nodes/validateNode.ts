import { DTEState } from "../state";
import { processDTE } from "../../mh/process";
import { createLogger } from "../../utils/logger";

const logger = createLogger('validateNode');

const round8 = (value: number) => {
  return Math.round(value * 1e8) / 1e8;
};

const round2 = (value: number) => {
  return Math.round(value * 1e2) / 1e2;
};

const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

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
    console.log("🔍 [validateNode] Iniciando validación de consistencia cruda...");

    const valErrors: string[] = [];

    // Bloque de validación matemática (existente)
    try {
      let sumaGravada = 0;
      let sumaExenta = 0;
      let sumaNoSuj = 0;
      let sumaIvaItems = 0;

      for (const item of rawDte.cuerpoDocumento || []) {
        const totalItem = round8((item.precioUni || 0) * (item.cantidad || 0) - (item.montoDescu || 0));
        const sumaTipos = round8((item.ventaGravada || 0) + (item.ventaExenta || 0) + (item.ventaNoSuj || 0));

        if (!near(totalItem, sumaTipos)) {
          valErrors.push(`ITEM_TOTAL_MISMATCH: Item ${item.numItem || ''} total ${totalItem} ≠ ventaGravada+Exenta+NoSuj ${sumaTipos}`);
        }

        sumaGravada += item.ventaGravada || 0;
        sumaExenta += item.ventaExenta || 0;
        sumaNoSuj += item.ventaNoSuj || 0;
        sumaIvaItems += item.ivaItem || 0;
      }

      const resumen = (rawDte as any).resumen || {};
      const esperadoTotalVentas = round2(sumaGravada + sumaExenta + sumaNoSuj);
      const esperadoSubTotal = round2(esperadoTotalVentas - (resumen.totalDescu || 0));
      const tipoDte = rawDte.identificacion?.tipoDte || '';
      const esperadoTotalIva = round2(sumaIvaItems);
      const esperadoMontoOperacion = tipoDte === '01'
        ? round2(esperadoSubTotal + (resumen.totalNoGravado || 0))
        : round2(esperadoSubTotal + esperadoTotalIva + (resumen.totalNoGravado || 0));
      const esperadoTotalPagar = round2(
        esperadoMontoOperacion
        - (resumen.ivaRete1 || 0)
        - (resumen.reteRenta || 0)
        + (resumen.saldoFavor || 0)
      );

      const resumenTotalGravada = resumen.totalGravada || 0;
      const resumenTotalExenta = resumen.totalExenta || 0;
      const resumenTotalNoSuj = resumen.totalNoSuj || 0;
      const resumenTotalIva = resumen.totalIva || 0;
      const resumenSubTotal = resumen.subTotal || resumen.subTotalVentas || 0;
      const resumenMontoOperacion = resumen.montoTotalOperacion || 0;
      const resumenTotalPagar = resumen.totalPagar || 0;

      if (!near(resumenTotalGravada, sumaGravada)) {
        valErrors.push(`RESUMEN_TOTAL_GRAVADA_MISMATCH: ${resumenTotalGravada} ≠ suma ítems ${sumaGravada.toFixed(2)}`);
      }
      if (!near(resumenTotalExenta, sumaExenta)) {
        valErrors.push(`RESUMEN_TOTAL_EXENTA_MISMATCH: ${resumenTotalExenta} ≠ suma ítems ${sumaExenta.toFixed(2)}`);
      }
      if (!near(resumenTotalNoSuj, sumaNoSuj)) {
        valErrors.push(`RESUMEN_TOTAL_NOSUJ_MISMATCH: ${resumenTotalNoSuj} ≠ suma ítems ${sumaNoSuj.toFixed(2)}`);
      }
      if (!near(resumenTotalIva, esperadoTotalIva)) {
        valErrors.push(`RESUMEN_TOTAL_IVA_MISMATCH: ${resumenTotalIva} ≠ IVA ítems ${esperadoTotalIva}`);
      }
      if (!near(resumenSubTotal, esperadoSubTotal)) {
        valErrors.push(`RESUMEN_SUBTOTAL_MISMATCH: ${resumenSubTotal} ≠ esperado ${esperadoSubTotal}`);
      }
      if (!near(resumenMontoOperacion, esperadoMontoOperacion)) {
        valErrors.push(`RESUMEN_MONTO_OPERACION_MISMATCH: ${resumenMontoOperacion} ≠ esperado ${esperadoMontoOperacion}`);
      }
      if (!near(resumenTotalPagar, esperadoTotalPagar)) {
        valErrors.push(`RESUMEN_TOTAL_PAGAR_MISMATCH: ${resumenTotalPagar} ≠ esperado ${esperadoTotalPagar}`);
      }
    } catch (err: any) {
      console.error("❌ Error en validación matemática:", err);
      valErrors.push(`VALIDATION_EXCEPTION_RAW: ${err?.message || err}`);
    }

    // Si el crudo no cuadra, no seguimos a normalizar/firma
    if (valErrors.length > 0) {
      console.warn("⚠️ [validateNode] Errores de validación cruda detectados:", valErrors);
      return {
        dte: state.dte,
        isValid: false,
        validationErrors: valErrors,
        status: 'failed',
        progressPercentage: 10,
        currentStep: 'validator',
        canRetry: false,
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Errores de validación DTE (crudo)'
      };
    }

    console.log("✅ [validateNode] Validación cruda exitosa. Procediendo a processDTE...");

    // 2) Validar con normalización y reglas existentes (schema + reglas)
    const { dte, errores } = processDTE(state.dte as any);
    console.log("🔍 [validateNode] processDTE completado. Errores encontrados:", errores.length);
    
    const valErrorsSchema: string[] = errores.map((e) => {
      let msg = `${e.codigo}: ${e.descripcion}`;
      if (e.campo) msg += ` (campo: ${e.campo})`;
      if (e.valorActual !== undefined) msg += ` [valor: ${JSON.stringify(e.valorActual)}]`;
      return msg;
    });

    const isValid = valErrorsSchema.length === 0;
    if (isValid) {
      console.log("✅ [validateNode] DTE válido según esquema. Listo para firmar.");
      return {
        dte,
        isValid: true,
        validationErrors: [],
        status: 'signing',
        progressPercentage: 25,
        currentStep: 'validator',
        estimatedTime: 45,
      };
    }

    console.warn("⚠️ [validateNode] Errores de esquema/reglas detectados:", valErrorsSchema);
    return {
      dte,
      isValid: false,
      validationErrors: valErrorsSchema,
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
