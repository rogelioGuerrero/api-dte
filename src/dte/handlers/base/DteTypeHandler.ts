import type { DTEJSON } from '../../../dte/generator';
import type { ProcessDTEResult } from '../../../mh/process';

export interface DtePreparationResult {
  dte: DTEJSON;
  isValid: boolean;
  validationErrors: string[];
}

export interface DteTypeHandler {
  readonly tipoDte: string;
  validateRaw(input: DTEJSON): string[];
  process(input: DTEJSON): ProcessDTEResult;
  prepare(input: DTEJSON): DtePreparationResult;
}
