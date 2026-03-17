import type { DTEJSON } from '../../dte/generator';
import type { DteTypeHandler } from '../handlers/base/DteTypeHandler';
import { creditFiscal03Handler } from '../handlers/creditFiscal03/handler';
import { invoice01Handler } from '../handlers/invoice01/handler';

const handlerRegistry = new Map<string, DteTypeHandler>([
  [invoice01Handler.tipoDte, invoice01Handler],
  [creditFiscal03Handler.tipoDte, creditFiscal03Handler],
]);

export const resolveDteHandler = (dte: Pick<DTEJSON, 'identificacion'> | undefined | null): DteTypeHandler | null => {
  const tipoDte = dte?.identificacion?.tipoDte?.trim();
  if (!tipoDte) {
    return null;
  }

  return handlerRegistry.get(tipoDte) || null;
};
