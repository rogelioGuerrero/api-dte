import type { DTEJSON } from '../../../dte/generator';
import { processDTE } from '../../../mh/process';
import type { DtePreparationResult, DteTypeHandler } from '../base/DteTypeHandler';

const round8 = (value: number) => Math.round(value * 1e8) / 1e8;
const round2 = (value: number) => Math.round(value * 1e2) / 1e2;
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

const mapProcessErrors = (errores: { codigo: string; descripcion: string; campo?: string; valorActual?: unknown }[]) => {
  return errores.map((e) => {
    let msg = `${e.codigo}: ${e.descripcion}`;
    if (e.campo) msg += ` (campo: ${e.campo})`;
    if (e.valorActual !== undefined) msg += ` [valor: ${JSON.stringify(e.valorActual)}]`;
    return msg;
  });
};

export class CreditFiscal03Handler implements DteTypeHandler {
  readonly tipoDte = '03';

  validateRaw(input: DTEJSON): string[] {
    const rawDte: any = input;
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

        if (Array.isArray(item.tributos) && item.tributos.some((tributo: any) => tributo !== '20')) {
          valErrors.push(`ITEM_TRIBUTOS_INVALIDOS: Item ${item.numItem || ''} solo debe incluir código 20 en tributos[]`);
        }
      }

      if (item.tipoItem === 4) {
        if (typeof item.codTributo !== 'string' || !item.codTributo.trim()) {
          valErrors.push(`ITEM_CODTRIBUTO_REQUERIDO: Item ${item.numItem || ''} tipoItem 4 requiere codTributo como cadena`);
        }
      } else if (item.codTributo !== undefined && item.codTributo !== null) {
        valErrors.push(`ITEM_CODTRIBUTO_INVALIDO: Item ${item.numItem || ''} debe enviar codTributo null en CCF 03 para este tipo de ítem`);
      }

      if (Object.prototype.hasOwnProperty.call(item, 'ivaItem')) {
        valErrors.push(`ITEM_IVAITEM_INVALIDO: Item ${item.numItem || ''} no debe incluir ivaItem en CCF 03; el IVA consolidado lo define resumen.totalIva`);
      }

      sumaGravada += item.ventaGravada || 0;
      sumaExenta += item.ventaExenta || 0;
      sumaNoSuj += item.ventaNoSuj || 0;
    }

    const resumenTotalGravada = resumen.totalGravada || 0;
    const resumenTotalExenta = resumen.totalExenta || 0;
    const resumenTotalNoSuj = resumen.totalNoSuj || 0;
    const ivaTributo = Array.isArray(resumen.tributos)
      ? resumen.tributos.find((t: any) => t?.codigo === '20')
      : null;
    const resumenTotalIva = Number(resumen.totalIva ?? ivaTributo?.valor ?? 0);
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

    if (!Array.isArray(resumen.tributos) || resumen.tributos.length === 0) {
      valErrors.push('RESUMEN_TRIBUTOS_REQUERIDOS: resumen.tributos debe ser un arreglo con el IVA consolidado');
    }

    if (resumen.tributos && Array.isArray(resumen.tributos)) {
      const ivaTributoLocal = resumen.tributos.find((t: any) => t?.codigo === '20');
      if (!ivaTributoLocal) {
        valErrors.push('RESUMEN_IVA_CODIGO_20_REQUERIDO: resumen.tributos debe incluir el código 20');
      } else if (!near(Number(ivaTributoLocal.valor || 0), Number(resumenTotalIva || 0))) {
        valErrors.push(`RESUMEN_IVA_VALOR_MISMATCH: resumen.tributos[codigo=20].valor ${ivaTributoLocal.valor} ≠ IVA calculado ${resumenTotalIva}`);
      }
    }

    if (!resumen.totalLetras || !String(resumen.totalLetras).trim().endsWith('USD')) {
      valErrors.push('RESUMEN_TOTAL_LETRAS_INVALIDO: totalLetras debe terminar en USD');
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

export const creditFiscal03Handler = new CreditFiscal03Handler();
