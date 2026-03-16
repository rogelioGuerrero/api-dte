import type { DTEJSON } from '../dte/generator';
import type { ErrorValidacionMH } from './types';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

export const validateDteRules = (dte: DTEJSON): ErrorValidacionMH[] => {
  const errores: ErrorValidacionMH[] = [];
  const tipoDte = dte.identificacion.tipoDte;

  if (tipoDte === '01' && dte.resumen.montoTotalOperacion < 1095) {
    if (dte.receptor.tipoDocumento !== null || dte.receptor.numDocumento !== null) {
      errores.push({
        codigo: 'RULE-0001',
        campo: 'receptor.tipoDocumento',
        descripcion: 'FE < $1095: receptor.tipoDocumento y receptor.numDocumento deben ser null',
        severidad: 'ERROR',
      });
    }
  }

  if (tipoDte === '01' && dte.resumen.montoTotalOperacion >= 1095) {
    if (dte.receptor.tipoDocumento === null || dte.receptor.numDocumento === null) {
      errores.push({
        codigo: 'RULE-0001C',
        campo: 'receptor.numDocumento',
        descripcion: 'FE >= $1095: se requiere identificación del receptor (tipoDocumento y numDocumento no pueden ser null)',
        severidad: 'ERROR',
      });
    }
  }

  if (tipoDte === '03') {
    if (dte.receptor.tipoDocumento !== undefined && dte.receptor.tipoDocumento !== null) {
      errores.push({
        codigo: 'RULE-0300A',
        campo: 'receptor.tipoDocumento',
        descripcion: 'CCF 03 no admite receptor.tipoDocumento',
        severidad: 'ERROR',
      });
    }

    if (dte.receptor.numDocumento !== undefined && dte.receptor.numDocumento !== null) {
      errores.push({
        codigo: 'RULE-0300B',
        campo: 'receptor.numDocumento',
        descripcion: 'CCF 03 no admite receptor.numDocumento',
        severidad: 'ERROR',
      });
    }

    if ((dte.resumen.montoTotalOperacion ?? 0) <= 0) {
      errores.push({
        codigo: 'RULE-0301',
        campo: 'resumen.montoTotalOperacion',
        descripcion: 'CCF 03 requiere montoTotalOperacion mayor a 0',
        severidad: 'ERROR',
      });
    }

    if ((dte.resumen.totalIva ?? 0) <= 0) {
      errores.push({
        codigo: 'RULE-0302',
        campo: 'resumen.totalIva',
        descripcion: 'CCF 03 requiere totalIva mayor a 0',
        severidad: 'ERROR',
      });
    }

    if (!Array.isArray(dte.resumen.tributos) || dte.resumen.tributos.length === 0) {
      errores.push({
        codigo: 'RULE-0303',
        campo: 'resumen.tributos',
        descripcion: 'CCF 03 requiere resumen.tributos con el IVA consolidado',
        severidad: 'ERROR',
      });
    }

    dte.cuerpoDocumento.forEach((item, idx) => {
      if (item.codTributo !== '20') {
        errores.push({
          codigo: 'RULE-0304A',
          campo: `cuerpoDocumento[${idx + 1}].codTributo`,
          descripcion: `Item ${idx + 1}: codTributo debe ser 20 en CCF 03`,
          severidad: 'ERROR',
        });
      }

      if ((item.ventaGravada ?? 0) > 0 && (!Array.isArray(item.tributos) || item.tributos.length === 0)) {
        errores.push({
          codigo: 'RULE-0304',
          campo: `cuerpoDocumento[${idx + 1}].tributos`,
          descripcion: `Item ${idx + 1}: ventaGravada mayor a 0 requiere tributos[]`,
          severidad: 'ERROR',
        });
      }

      if (Array.isArray(item.tributos) && item.tributos.some((tributo) => tributo !== '20')) {
        errores.push({
          codigo: 'RULE-0304B',
          campo: `cuerpoDocumento[${idx + 1}].tributos`,
          descripcion: `Item ${idx + 1}: tributos[] solo debe contener código 20 en CCF 03`,
          severidad: 'ERROR',
        });
      }

      if ((item as any).ivaItem !== undefined) {
        errores.push({
          codigo: 'RULE-0304C',
          campo: `cuerpoDocumento[${idx + 1}].ivaItem`,
          descripcion: `Item ${idx + 1}: ivaItem no debe enviarse en CCF 03`,
          severidad: 'ERROR',
        });
      }
    });

    const ivaTributo = dte.resumen.tributos?.find((t) => t.codigo === '20');
    if (ivaTributo && !near(ivaTributo.valor, dte.resumen.totalIva ?? 0, 0.01)) {
      errores.push({
        codigo: 'RULE-0305',
        campo: 'resumen.tributos[codigo=20].valor',
        descripcion: 'El IVA consolidado en resumen.tributos debe coincidir con resumen.totalIva',
        severidad: 'ERROR',
      });
    }
  }

  if (tipoDte !== '01') {
    if (!dte.resumen.totalLetras || !dte.resumen.totalLetras.trim().endsWith('USD')) {
      errores.push({
        codigo: 'RULE-0400',
        campo: 'resumen.totalLetras',
        descripcion: 'totalLetras debe terminar en \"USD\"',
        severidad: 'ERROR',
      });
    }

    return errores;
  }

  if (dte.receptor.tipoDocumento === null) {
    if (dte.receptor.numDocumento !== null) {
      errores.push({
        codigo: 'RULE-0001B',
        campo: 'receptor.numDocumento',
        descripcion: 'receptor.tipoDocumento=null requiere receptor.numDocumento=null',
        severidad: 'ERROR',
      });
    }
    return errores;
  }

  if (dte.receptor.tipoDocumento === '13' && dte.receptor.numDocumento && dte.receptor.numDocumento.length !== 9) {
    errores.push({
      codigo: 'RULE-0002',
      campo: 'receptor.numDocumento',
      descripcion: 'tipoDocumento=13 requiere 9 dígitos (DUI)',
      severidad: 'ERROR',
    });
  }

  if (dte.receptor.tipoDocumento === '36' && dte.receptor.numDocumento && dte.receptor.numDocumento.length !== 14) {
    errores.push({
      codigo: 'RULE-0003',
      campo: 'receptor.numDocumento',
      descripcion: 'tipoDocumento=36 requiere 14 dígitos (NIT)',
      severidad: 'ERROR',
    });
  }

  if (dte.emisor.nit && ![9, 14].includes(dte.emisor.nit.length)) {
    errores.push({
      codigo: 'RULE-0004',
      campo: 'emisor.nit',
      descripcion: 'NIT/DUI del emisor debe tener 9 o 14 dígitos',
      severidad: 'ERROR',
    });
  }

  let sumaVentaGravada = 0;
  let sumaVentaExenta = 0;
  let sumaVentaNoSuj = 0;

  dte.cuerpoDocumento.forEach((item, idx) => {
    const totalItem = item.precioUni * item.cantidad - item.montoDescu;
    const sumaTipos = item.ventaNoSuj + item.ventaExenta + item.ventaGravada;

    if (!near(totalItem, sumaTipos, 0.01)) {
      errores.push({
        codigo: 'RULE-0100',
        campo: `cuerpoDocumento[${idx + 1}]`,
        descripcion: `Item ${idx + 1}: Cálculos incorrectos (${totalItem} ≠ ${sumaTipos})`,
        severidad: 'ERROR',
      });
    }

    sumaVentaGravada += item.ventaGravada;
    sumaVentaExenta += item.ventaExenta;
    sumaVentaNoSuj += item.ventaNoSuj;
  });

  if (!near(sumaVentaGravada, dte.resumen.totalGravada, 0.01)) {
    errores.push({
      codigo: 'RULE-0200',
      campo: 'resumen.totalGravada',
      descripcion: `resumen.totalGravada: ${dte.resumen.totalGravada} ≠ suma ítems ${sumaVentaGravada}`,
      severidad: 'ERROR',
    });
  }

  if (!near(sumaVentaExenta, dte.resumen.totalExenta, 0.01)) {
    errores.push({
      codigo: 'RULE-0201',
      campo: 'resumen.totalExenta',
      descripcion: `resumen.totalExenta: ${dte.resumen.totalExenta} ≠ suma ítems ${sumaVentaExenta}`,
      severidad: 'ERROR',
    });
  }

  if (!near(sumaVentaNoSuj, dte.resumen.totalNoSuj, 0.01)) {
    errores.push({
      codigo: 'RULE-0202',
      campo: 'resumen.totalNoSuj',
      descripcion: `resumen.totalNoSuj: ${dte.resumen.totalNoSuj} ≠ suma ítems ${sumaVentaNoSuj}`,
      severidad: 'ERROR',
    });
  }

  const ivaTributo = dte.resumen.tributos?.find((t) => t.codigo === '20');
  if (ivaTributo) {
    const ivaCalculado = dte.resumen.totalGravada * 0.13;
    if (!near(ivaTributo.valor, ivaCalculado, 0.02)) {
      errores.push({
        codigo: 'RULE-0300',
        campo: 'resumen.tributos[codigo=20].valor',
        descripcion: `IVA incorrecto: ${ivaTributo.valor} ≠ ${ivaCalculado} (13% de ${dte.resumen.totalGravada})`,
        severidad: 'ERROR',
      });
    }
  }

  if (!dte.resumen.totalLetras || !dte.resumen.totalLetras.trim().endsWith('USD')) {
    errores.push({
      codigo: 'RULE-0400',
      campo: 'resumen.totalLetras',
      descripcion: 'totalLetras debe terminar en "USD"',
      severidad: 'ERROR',
    });
  }

  return errores;
};
