import type { DTEJSON } from '../dte/generator';
import type { ErrorValidacionMH } from './types';

export type DteSchemaRef = 'FE' | 'CCFE' | 'FEXE';

export interface DteTypeContract {
  readonly tipoDte: string;
  readonly schemaRef: DteSchemaRef;
  validateRules?: (dte: DTEJSON, helpers: DteRuleHelpers) => ErrorValidacionMH[];
}

export interface DteRuleHelpers {
  near: (a: number, b: number, tol: number) => boolean;
}

const creditFiscal03Contract: DteTypeContract = {
  tipoDte: '03',
  schemaRef: 'CCFE',
  validateRules: (dte, helpers) => {
    const errores: ErrorValidacionMH[] = [];

    if ((dte.resumen.montoTotalOperacion ?? 0) <= 0) {
      errores.push({
        codigo: 'RULE-0301',
        campo: 'resumen.montoTotalOperacion',
        descripcion: 'CCF 03 requiere montoTotalOperacion mayor a 0',
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
      if (item.tipoItem === 4) {
        if (typeof item.codTributo !== 'string' || !item.codTributo.trim()) {
          errores.push({
            codigo: 'RULE-0304A',
            campo: `cuerpoDocumento[${idx + 1}].codTributo`,
            descripcion: `Item ${idx + 1}: tipoItem 4 requiere codTributo como cadena`,
            severidad: 'ERROR',
          });
        }
      } else if (item.codTributo !== null && item.codTributo !== undefined) {
        errores.push({
          codigo: 'RULE-0304A',
          campo: `cuerpoDocumento[${idx + 1}].codTributo`,
          descripcion: `Item ${idx + 1}: codTributo debe ser null en CCF 03 para este tipo de ítem`,
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
    const totalIvaCalculado = dte.resumen.totalIva ?? ivaTributo?.valor ?? 0;

    if (!ivaTributo) {
      errores.push({
        codigo: 'RULE-0305A',
        campo: 'resumen.tributos[codigo=20]',
        descripcion: 'El IVA consolidado debe declararse en resumen.tributos con el código 20',
        severidad: 'ERROR',
      });
    } else if (!helpers.near(ivaTributo.valor, totalIvaCalculado, 0.01)) {
      errores.push({
        codigo: 'RULE-0305',
        campo: 'resumen.tributos[codigo=20].valor',
        descripcion: 'El IVA consolidado en resumen.tributos debe coincidir con el IVA calculado',
        severidad: 'ERROR',
      });
    }

    return errores;
  },
};

const invoice01Contract: DteTypeContract = {
  tipoDte: '01',
  schemaRef: 'FE',
};

const export11Contract: DteTypeContract = {
  tipoDte: '11',
  schemaRef: 'FEXE',
};

const contractRegistry = new Map<string, DteTypeContract>([
  [invoice01Contract.tipoDte, invoice01Contract],
  [creditFiscal03Contract.tipoDte, creditFiscal03Contract],
  [export11Contract.tipoDte, export11Contract],
]);

export const resolveDteContract = (tipoDte: string | null | undefined): DteTypeContract | null => {
  if (!tipoDte) {
    return null;
  }

  return contractRegistry.get(tipoDte.trim()) ?? null;
};
