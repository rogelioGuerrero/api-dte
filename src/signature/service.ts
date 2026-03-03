import { ExternalApiSignatureProvider } from './externalApiProvider';
import { NodeJoseSignatureProvider } from './internalJoseProvider';
import { SignatureMode, SignatureProvider, SignatureRequest } from './provider';
import { createLogger } from '../utils/logger';

const logger = createLogger('SignatureService');

const mode: SignatureMode = (process.env.SIGNATURE_PROVIDER as SignatureMode) || 'dual';
const primary: SignatureProvider = mode === 'external' ? ExternalApiSignatureProvider : NodeJoseSignatureProvider;
const secondary: SignatureProvider | null = mode === 'dual'
  ? (primary.name === 'internal' ? ExternalApiSignatureProvider : NodeJoseSignatureProvider)
  : null;

export const signWithConfiguredProvider = async (request: SignatureRequest): Promise<{ jws: string; provider: string }> => {
  try {
    const jws = await primary.sign(request);
    return { jws, provider: primary.name };
  } catch (error: any) {
    logger.error('Firma falló en provider primario', { provider: primary.name, error: error.message });
    if (!secondary) throw error;
    logger.warn('Intentando fallback de firma', { fallback: secondary.name });
    const jws = await secondary.sign(request);
    return { jws, provider: secondary.name };
  }
};
