import type { DTEJSON } from '../../../dte/generator';
import { processDTE } from '../../../mh/process';
import type { DtePreparationResult, DteTypeHandler } from '../base/DteTypeHandler';

const round8 = (value: number) => Math.round(value * 1e8) / 1e8;
const round2 = (value: number) => Math.round(value * 1e2) / 1e2;
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

type ResumenExpectations = {
  subTotal: number;
  totalIva: number;
  totalPagarWithIva: number;
  totalPagarWithoutIva: number;
};

const computeResumenExpectations = (
  resumen: any,
  totals: { sumaGravada: number; sumaExenta: number; sumaNoSuj: number; sumaIvaItems: number }
): ResumenExpectations => {
  const esperadoTotalVentas = round2(totals.sumaGravada + totals.sumaExenta + totals.sumaNoSuj);
  const subTotal = round2(esperadoTotalVentas - (resumen.totalDescu || 0));
  const totalIva = round2(totals.sumaIvaItems);
  const ajustes = round2(
    -(resumen.ivaRete1 || 0)
    - (resumen.reteRenta || 0)
    + (resumen.saldoFavor || 0)
  );

  return {
    subTotal,
    totalIva,
    totalPagarWithIva: round2(subTotal + totalIva + ajustes),
    totalPagarWithoutIva: round2(subTotal + ajustes),
  };
};

const mapProcessErrors = (errores: { codigo: string; descripcion: string; campo?: string; valorActual?: unknown }[]) => {
  return errores.map((e) => {
    let msg = `${e.codigo}: ${e.descripcion}`;
    if (e.campo) msg += ` (campo: ${e.campo})`;
    if (e.valorActual !== undefined) msg += ` [valor: ${JSON.stringify(e.valorActual)}]`;
    return msg;
  });
};

export class Invoice01Handler implements DteTypeHandler {
  readonly tipoDte = '01';

  validateRaw(input: DTEJSON): string[] {
    const rawDte: any = input;
    const valErrors: string[] = [];

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

    const resumen = rawDte.resumen || {};
    const expectations = computeResumenExpectations(resumen, {
      sumaGravada,
      sumaExenta,
      sumaNoSuj,
      sumaIvaItems,
    });

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
    if (!near(resumenTotalIva, expectations.totalIva)) {
      valErrors.push(`RESUMEN_TOTAL_IVA_MISMATCH: ${resumenTotalIva} ≠ IVA ítems ${expectations.totalIva}`);
    }
    if (!near(resumenSubTotal, expectations.subTotal)) {
      valErrors.push(`RESUMEN_SUBTOTAL_MISMATCH: ${resumenSubTotal} ≠ esperado ${expectations.subTotal}`);
    }

    const montoOperacionEsValido =
      near(resumenMontoOperacion, expectations.totalPagarWithIva)
      || near(resumenMontoOperacion, expectations.totalPagarWithoutIva);

    if (!montoOperacionEsValido) {
      valErrors.push(
        `RESUMEN_MONTO_OPERACION_MISMATCH: ${resumenMontoOperacion} ≠ esperado ${expectations.totalPagarWithIva} (con IVA) o ${expectations.totalPagarWithoutIva} (sin IVA)`
      );
    }

    const totalPagarEsValido =
      near(resumenTotalPagar, expectations.totalPagarWithIva)
      || near(resumenTotalPagar, expectations.totalPagarWithoutIva);

    if (!totalPagarEsValido) {
      valErrors.push(
        `RESUMEN_TOTAL_PAGAR_MISMATCH: ${resumenTotalPagar} ≠ esperado ${expectations.totalPagarWithIva} (con IVA) o ${expectations.totalPagarWithoutIva} (sin IVA)`
      );
    }

    return valErrors;
  }

  process(input: DTEJSON) {
    return processDTE(input);
  }

  prepare(input: DTEJSON): DtePreparationResult {
    const rawErrors = this.validateRaw(input);
    if (rawErrors.length > 0) {
      return {
        dte: input,
        isValid: false,
        validationErrors: rawErrors,
      };
    }

    const processed = this.process(input);
    const schemaErrors = mapProcessErrors(processed.errores);

    return {
      dte: processed.dte,
      isValid: schemaErrors.length === 0,
      validationErrors: schemaErrors,
    };
  }
}

export const invoice01Handler = new Invoice01Handler();
