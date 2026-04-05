import type { DTEJSON } from '../../../dte/generator';
import { processDTE } from '../../../mh/process';
import type { DtePreparationResult, DteTypeHandler } from '../base/DteTypeHandler';
import { computeFe01Expectations, near, readItemTotals, round8 } from '../../calculation/fiscalRules';

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

    const items = Array.isArray(rawDte.cuerpoDocumento) ? rawDte.cuerpoDocumento : [];

    for (const item of items) {
      const totalItem = round8((item.precioUni || 0) * (item.cantidad || 0) - (item.montoDescu || 0));
      const sumaTipos = round8((item.ventaGravada || 0) + (item.ventaExenta || 0) + (item.ventaNoSuj || 0));

      if (!near(totalItem, sumaTipos)) {
        valErrors.push(`ITEM_TOTAL_MISMATCH: Item ${item.numItem || ''} total ${totalItem} ≠ ventaGravada+Exenta+NoSuj ${sumaTipos}`);
      }

      if ((item.ventaGravada || 0) > 0 && item.tributos != null) {
        if (!Array.isArray(item.tributos)) {
          valErrors.push(`ITEM_TRIBUTOS_INVALIDOS: Item ${item.numItem || ''} tributos debe ser null o array`);
        }
      }

      if (!Object.prototype.hasOwnProperty.call(item, 'ivaItem')) {
        valErrors.push(`ITEM_IVAITEM_REQUERIDO: Item ${item.numItem || ''} debe incluir ivaItem en FE 01`);
      }
    }

    const resumen = rawDte.resumen || {};
    const totals = readItemTotals(items);
    const expectations = computeFe01Expectations(resumen, totals);

    const resumenTotalGravada = resumen.totalGravada || 0;
    const resumenTotalExenta = resumen.totalExenta || 0;
    const resumenTotalNoSuj = resumen.totalNoSuj || 0;
    const resumenTotalIva = resumen.totalIva || 0;
    const resumenSubTotal = resumen.subTotal || resumen.subTotalVentas || 0;
    const resumenMontoOperacion = resumen.montoTotalOperacion || 0;
    const resumenTotalPagar = resumen.totalPagar || 0;

    if (!near(resumenTotalGravada, expectations.totalGravadaBase)) {
      valErrors.push(`RESUMEN_TOTAL_GRAVADA_MISMATCH: ${resumenTotalGravada} ≠ base esperada ${expectations.totalGravadaBase}`);
    }
    if (!near(resumenTotalExenta, totals.sumaExenta)) {
      valErrors.push(`RESUMEN_TOTAL_EXENTA_MISMATCH: ${resumenTotalExenta} ≠ suma ítems ${totals.sumaExenta.toFixed(2)}`);
    }
    if (!near(resumenTotalNoSuj, totals.sumaNoSuj)) {
      valErrors.push(`RESUMEN_TOTAL_NOSUJ_MISMATCH: ${resumenTotalNoSuj} ≠ suma ítems ${totals.sumaNoSuj.toFixed(2)}`);
    }
    if (!near(resumenTotalIva, expectations.totalIva)) {
      valErrors.push(`RESUMEN_TOTAL_IVA_MISMATCH: ${resumenTotalIva} ≠ IVA ítems ${expectations.totalIva}`);
    }
    if (!near(resumenSubTotal, expectations.subTotal)) {
      valErrors.push(`RESUMEN_SUBTOTAL_MISMATCH: ${resumenSubTotal} ≠ esperado ${expectations.subTotal}`);
    }
    const resumenSubTotalVentas = resumen.subTotalVentas || 0;
    if (!near(resumenSubTotalVentas, expectations.subTotalVentas)) {
      valErrors.push(`RESUMEN_SUBTOTAL_VENTAS_MISMATCH: ${resumenSubTotalVentas} ≠ esperado ${expectations.subTotalVentas}`);
    }

    if (!near(resumenMontoOperacion, expectations.montoTotalOperacion)) {
      valErrors.push(`RESUMEN_MONTO_OPERACION_MISMATCH: ${resumenMontoOperacion} ≠ esperado ${expectations.montoTotalOperacion}`);
    }
    if (!near(resumenTotalPagar, expectations.totalPagar)) {
      valErrors.push(`RESUMEN_TOTAL_PAGAR_MISMATCH: ${resumenTotalPagar} ≠ esperado ${expectations.totalPagar}`);
    }

    if (resumen.tributos != null && !Array.isArray(resumen.tributos)) {
      valErrors.push('RESUMEN_TRIBUTOS_INVALIDOS: resumen.tributos debe ser null o array');
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
