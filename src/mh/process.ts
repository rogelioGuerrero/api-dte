import type { DTEJSON } from '../dte/generator';
import type { ErrorValidacionMH } from './types';
import { normalizeDTE } from './normalize';
import { validateDteSchema } from './validateSchema';
import { validateDteRules } from './validateRules';

export interface ProcessDTEResult {
  dte: DTEJSON;
  errores: ErrorValidacionMH[];
}

export const processDTE = (input: DTEJSON): ProcessDTEResult => {
  const dte = normalizeDTE(input);
  const errores = [...validateDteSchema(dte), ...validateDteRules(dte)];
  return { dte, errores };
};
