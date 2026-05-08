import { SignatureProvider, SignatureRequest } from './provider';
import { firmarDocumento } from '../integrations/firmaClient';
import { createLogger } from '../utils/logger';

const logger = createLogger('SignatureProvider:external');

export const ExternalApiSignatureProvider: SignatureProvider = {
  name: 'external',
  async sign({ nit, passwordPri, certificadoB64, dteJson }: SignatureRequest): Promise<string> {
    const parsedDte = typeof dteJson === 'string' ? JSON.parse(dteJson) : (dteJson as Record<string, unknown>);

    logger.info('Delegando firma a servicio externo', { nit });

    return firmarDocumento({
      nit,
      passwordPri,
      certificadoB64,
      dteJson: parsedDte,
    });
  },
};
