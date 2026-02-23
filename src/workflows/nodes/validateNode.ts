import { DTEState } from "../state";
import { processDTE } from "../../mh/process";

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

  const { dte, errores } = processDTE(state.dte as any);
  const valErrors: string[] = errores.map((e) => `${e.codigo}: ${e.descripcion}`);

  // Recalcular totales básicos siguiendo reglas MH (8 decimales en ítems, 2 en resumen)
  try {
    let sumaGravada = 0;
    let sumaExenta = 0;
    let sumaNoSuj = 0;
    let sumaIvaItems = 0;

    for (const item of dte.cuerpoDocumento || []) {
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

    const resumen = dte.resumen || {};
    const esperadoTotalVentas = round2(sumaGravada + sumaExenta + sumaNoSuj);
    const esperadoSubTotal = round2(esperadoTotalVentas - (resumen.totalDescu || 0));
    const esperadoTotalIva = round2(sumaIvaItems);
    const esperadoMontoOperacion = round2(esperadoSubTotal + esperadoTotalIva + (resumen.totalNoGravado || 0));
    const esperadoTotalPagar = round2(
      esperadoMontoOperacion
      - (resumen.ivaRete1 || 0)
      - (resumen.reteRenta || 0)
      + (resumen.saldoFavor || 0)
    );

    if (!near(resumen.totalGravada || 0, sumaGravada)) {
      valErrors.push(`RESUMEN_TOTAL_GRAVADA_MISMATCH: ${resumen.totalGravada} ≠ suma ítems ${sumaGravada.toFixed(2)}`);
    }
    if (!near(resumen.totalExenta || 0, sumaExenta)) {
      valErrors.push(`RESUMEN_TOTAL_EXENTA_MISMATCH: ${resumen.totalExenta} ≠ suma ítems ${sumaExenta.toFixed(2)}`);
    }
    if (!near(resumen.totalNoSuj || 0, sumaNoSuj)) {
      valErrors.push(`RESUMEN_TOTAL_NOSUJ_MISMATCH: ${resumen.totalNoSuj} ≠ suma ítems ${sumaNoSuj.toFixed(2)}`);
    }
    if (!near(resumen.totalIva || 0, esperadoTotalIva)) {
      valErrors.push(`RESUMEN_TOTAL_IVA_MISMATCH: ${resumen.totalIva} ≠ IVA ítems ${esperadoTotalIva}`);
    }
    if (!near(resumen.subTotal || resumen.subTotalVentas || 0, esperadoSubTotal)) {
      valErrors.push(`RESUMEN_SUBTOTAL_MISMATCH: ${resumen.subTotal || resumen.subTotalVentas} ≠ esperado ${esperadoSubTotal}`);
    }
    if (!near(resumen.montoTotalOperacion || 0, esperadoMontoOperacion)) {
      valErrors.push(`RESUMEN_MONTO_OPERACION_MISMATCH: ${resumen.montoTotalOperacion} ≠ esperado ${esperadoMontoOperacion}`);
    }
    if (!near(resumen.totalPagar || 0, esperadoTotalPagar)) {
      valErrors.push(`RESUMEN_TOTAL_PAGAR_MISMATCH: ${resumen.totalPagar} ≠ esperado ${esperadoTotalPagar}`);
    }
  } catch (err: any) {
    valErrors.push(`VALIDATION_EXCEPTION: ${err?.message || err}`);
  }

  const isValid = valErrors.length === 0;

  return {
    dte,
    isValid,
    validationErrors: valErrors,
    status: isValid ? 'signing' : 'failed',
    progressPercentage: isValid ? 25 : 10,
    currentStep: 'validator',
    estimatedTime: isValid ? 45 : undefined,
    canRetry: !isValid ? false : undefined,
    errorCode: !isValid ? 'VALIDATION_FAILED' : undefined,
    errorMessage: !isValid ? 'Errores de validación DTE' : undefined,
  };
};
