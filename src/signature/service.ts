import { ExternalApiSignatureProvider } from './externalApiProvider';
import { SignatureRequest } from './provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('SignatureService');

const primary = ExternalApiSignatureProvider;

export const signWithConfiguredProvider = async (request: SignatureRequest): Promise<{ jws: string; provider: string }> => {
  try {
    const jws = await primary.sign(request);
    return { jws, provider: primary.name };
  } catch (error: any) {
    logger.error('Firma falló en el proveedor', { provider: primary.name, error: error.message });
    throw error;
  }
};
