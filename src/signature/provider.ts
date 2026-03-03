import { DTEJSON } from '../dte/generator';

export interface SignatureRequest {
  nit: string;
  passwordPri: string;
  certificadoB64: string;
  dteJson: Record<string, unknown>;
}

export interface SignatureProvider {
  name: string;
  sign: (request: SignatureRequest) => Promise<string>;
}

