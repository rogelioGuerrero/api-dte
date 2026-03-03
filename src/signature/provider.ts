import { DTEJSON } from '../dte/generator';

export interface SignatureRequest {
  nit: string;
  passwordPri: string;
  certificadoB64: string;
  dteJson: Record<string, unknown> | string | DTEJSON;
}

export interface SignatureProvider {
  name: 'internal' | 'external';
  sign(request: SignatureRequest): Promise<string>;
}

export type SignatureMode = 'internal' | 'external' | 'dual';
