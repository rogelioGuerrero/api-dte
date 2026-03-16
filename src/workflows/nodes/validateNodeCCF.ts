import { DTEState } from "../state";
import { processDTE } from "../../mh/process";
import { createLogger } from "../../utils/logger";

const logger = createLogger('validateNodeCCF');

const round8 = (value: number) => {
  return Math.round(value * 1e8) / 1e8;
};

const round2 = (value: number) => {
  return Math.round(value * 1e2) / 1e2;
};

const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

export const validateNodeCCF = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🕵️ Agente Validador CCF: Revisando estructura y reglas de negocio para tipo 03...");
  const sourceDte = state.inputDte || state.dte;

  if (!sourceDte) {
    return {
      isValid: false,
      validationErrors: ["No se recibió DTE para validar"],
      status: 'failed',
      errorCode: 'VALIDATION_NO_DTE',
      canRetry: false,
      progressPercentage: 10,
      currentStep: 'validator_ccf'
    };
  }

  try {
    const rawDte: any = sourceDte;
    logger.info('DTE crudo CCF recibido', {
      codigoGeneracion: rawDte?.identificacion?.codigoGeneracion,
      tipoDte: rawDte?.identificacion?.tipoDte,
      resumen: rawDte?.resumen,
      items: rawDte?.cuerpoDocumento,
    });

    const tipoDte = rawDte?.identificacion?.tipoDte;
    if (tipoDte !== '03') {
      return {
        isValid: false,
        validationErrors: [`Tipo DTE no soportado por validator CCF: ${tipoDte ?? 'N/D'}`],
        status: 'failed',
        progressPercentage: 10,
        currentStep: 'validator_ccf',
        canRetry: false,
        errorCode: 'VALIDATION_UNSUPPORTED_DTE',
        errorMessage: 'El validador CCF solo acepta tipoDte 03'
      };
    }

    console.log("🔍 [validateNodeCCF] Iniciando validación cruda...");
    const valErrors: string[] = [];

    const items = Array.isArray(rawDte.cuerpoDocumento) ? rawDte.cuerpoDocumento : [];
    const resumen = rawDte.resumen || {};
    const receptor = rawDte.receptor || {};

    if (items.length === 0) {
      valErrors.push('CUERPO_DOCUMENTO_REQUERIDO: Debe existir al menos un item');
    }

    if ('tipoDocumento' in receptor) {
      valErrors.push('RECEPTOR_CAMPO_INVALIDO: receptor.tipoDocumento no debe enviarse en CCF 03');
    }

    if ('numDocumento' in receptor) {
      valErrors.push('RECEPTOR_CAMPO_INVALIDO: receptor.numDocumento no debe enviarse en CCF 03');
    }

    let sumaGravada = 0;
    let sumaExenta = 0;
    let sumaNoSuj = 0;

    for (const item of items) {
      const totalItem = round8((item.precioUni || 0) * (item.cantidad || 0) - (item.montoDescu || 0));
      const sumaTipos = round8((item.ventaGravada || 0) + (item.ventaExenta || 0) + (item.ventaNoSuj || 0));

      if (!near(totalItem, sumaTipos)) {
        valErrors.push(`ITEM_TOTAL_MISMATCH: Item ${item.numItem || ''} total ${totalItem} ≠ ventaGravada+Exenta+NoSuj ${sumaTipos}`);
      }

      if ((item.ventaGravada || 0) > 0) {
        if (!Array.isArray(item.tributos) || item.tributos.length === 0) {
          valErrors.push(`ITEM_TRIBUTOS_REQUERIDOS: Item ${item.numItem || ''} con ventaGravada debe incluir tributos[]`);
        }
      }

      if (!Object.prototype.hasOwnProperty.call(item, 'codTributo')) {
        valErrors.push(`ITEM_CODTRIBUTO_REQUERIDO: Item ${item.numItem || ''} debe incluir codTributo`);
      }

      sumaGravada += item.ventaGravada || 0;
      sumaExenta += item.ventaExenta || 0;
      sumaNoSuj += item.ventaNoSuj || 0;
    }

    const resumenTotalGravada = resumen.totalGravada || 0;
    const resumenTotalExenta = resumen.totalExenta || 0;
    const resumenTotalNoSuj = resumen.totalNoSuj || 0;
    const resumenTotalIva = resumen.totalIva || 0;
    const resumenSubTotal = resumen.subTotal || resumen.subTotalVentas || 0;
    const resumenMontoOperacion = resumen.montoTotalOperacion || 0;
    const resumenTotalPagar = resumen.totalPagar || 0;

    const esperadoSubTotalVentas = round2(sumaGravada + sumaExenta + sumaNoSuj);
    const esperadoSubTotal = round2(esperadoSubTotalVentas - (resumen.totalDescu || 0));
    const esperadoMontoOperacion = round2(esperadoSubTotal + (resumen.totalNoGravado || 0) + resumenTotalIva);
    const esperadoTotalPagar = round2(
      esperadoMontoOperacion
      - (resumen.ivaRete1 || 0)
      - (resumen.reteRenta || 0)
      + (resumen.saldoFavor || 0)
    );

    if (!near(resumenTotalGravada, sumaGravada)) {
      valErrors.push(`RESUMEN_TOTAL_GRAVADA_MISMATCH: ${resumenTotalGravada} ≠ suma ítems ${sumaGravada.toFixed(2)}`);
    }

    if (!near(resumenTotalExenta, sumaExenta)) {
      valErrors.push(`RESUMEN_TOTAL_EXENTA_MISMATCH: ${resumenTotalExenta} ≠ suma ítems ${sumaExenta.toFixed(2)}`);
    }

    if (!near(resumenTotalNoSuj, sumaNoSuj)) {
      valErrors.push(`RESUMEN_TOTAL_NOSUJ_MISMATCH: ${resumenTotalNoSuj} ≠ suma ítems ${sumaNoSuj.toFixed(2)}`);
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

    if (resumenMontoOperacion <= 0) {
      valErrors.push('RESUMEN_MONTO_OPERACION_INVALIDO: montoTotalOperacion debe ser mayor a 0 para CCF 03');
    }

    if (resumenTotalIva <= 0) {
      valErrors.push('RESUMEN_TOTAL_IVA_INVALIDO: totalIva debe ser mayor a 0 para CCF 03');
    }

    if (!Array.isArray(resumen.tributos) || resumen.tributos.length === 0) {
      valErrors.push('RESUMEN_TRIBUTOS_REQUERIDOS: resumen.tributos debe ser un arreglo con el IVA consolidado');
    }

    if (resumen.tributos && Array.isArray(resumen.tributos)) {
      const ivaTributo = resumen.tributos.find((t: any) => t?.codigo === '20');
      if (!ivaTributo) {
        valErrors.push('RESUMEN_IVA_CODIGO_20_REQUERIDO: resumen.tributos debe incluir el código 20');
      }
    }

    if (!resumen.totalLetras || !String(resumen.totalLetras).trim().endsWith('USD')) {
      valErrors.push('RESUMEN_TOTAL_LETRAS_INVALIDO: totalLetras debe terminar en USD');
    }

    if (valErrors.length > 0) {
      console.warn("⚠️ [validateNodeCCF] Errores de validación cruda detectados:", valErrors);
      return {
        dte: sourceDte,
        inputDte: sourceDte,
        isValid: false,
        validationErrors: valErrors,
        status: 'failed',
        progressPercentage: 10,
        currentStep: 'validator_ccf',
        canRetry: false,
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Errores de validación DTE CCF (crudo)'
      };
    }

    console.log("✅ [validateNodeCCF] Validación cruda exitosa. Procediendo a processDTE...");

    const { dte, errores } = processDTE(sourceDte as any);
    console.log("🔍 [validateNodeCCF] processDTE completado. Errores encontrados:", errores.length);

    const valErrorsSchema: string[] = errores.map((e) => {
      let msg = `${e.codigo}: ${e.descripcion}`;
      if (e.campo) msg += ` (campo: ${e.campo})`;
      if (e.valorActual !== undefined) msg += ` [valor: ${JSON.stringify(e.valorActual)}]`;
      return msg;
    });

    const isValid = valErrorsSchema.length === 0;
    if (isValid) {
      console.log("✅ [validateNodeCCF] DTE CCF válido según esquema. Listo para firmar.");
      return {
        dte,
        inputDte: sourceDte,
        preparedDte: dte,
        isValid: true,
        validationErrors: [],
        status: 'signing',
        progressPercentage: 25,
        currentStep: 'validator_ccf',
        estimatedTime: 45,
      };
    }

    console.warn("⚠️ [validateNodeCCF] Errores de esquema/reglas detectados:", valErrorsSchema);
    return {
      dte,
      inputDte: sourceDte,
      preparedDte: dte,
      isValid: false,
      validationErrors: valErrorsSchema,
      status: 'failed',
      progressPercentage: 10,
      currentStep: 'validator_ccf',
      canRetry: false,
      errorCode: 'VALIDATION_FAILED',
      errorMessage: 'Errores de validación DTE CCF',
    };
  } catch (error: any) {
    console.error("❌ [validateNodeCCF] Excepción NO CONTROLADA en validateNodeCCF:", error);
    return {
      isValid: false,
      validationErrors: [`EXCEPTION_IN_VALIDATOR_CCF: ${error?.message || error}`],
      status: 'failed',
      errorCode: 'VALIDATOR_CCF_CRASH',
      errorMessage: 'Error interno en el validador CCF',
      currentStep: 'validator_ccf'
    };
  }
};
