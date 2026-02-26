import { DTEState } from '../state';
import { createLogger } from '../../utils/logger';
import { getMHCredentialsByNIT, updateMHTokenByNIT } from '../../business/businessStorage';
import { getCachedMHAuthToken, normalizeBearerToken, shouldRefreshTokenWithExp } from '../../mh/authClient';

const logger = createLogger('tokenNode');

/**
 * Obtiene o refresca el token MH para el NIT/ambiente del estado.
 * Devuelve apiToken y apiTokenExpiresAt en el estado parcial.
 */
export const tokenNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  const ambiente = state.ambiente || '00';
  const nitEmisor = (state.dte?.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();
  const nitBusqueda = (state.businessId || nitEmisor).replace(/[\s-]/g, '').trim();

  if (!nitBusqueda) {
    return {
      status: 'failed',
      errorCode: 'TOKEN_ERROR_NO_NIT',
      errorMessage: 'No se pudo determinar el NIT para obtener token MH',
      canRetry: false,
    };
  }

  const credentials = await getMHCredentialsByNIT(nitBusqueda, ambiente);

  if (!credentials) {
    return {
      status: 'failed',
      errorCode: 'TOKEN_ERROR_NO_CREDENTIALS',
      errorMessage: `El NIT ${nitBusqueda} no tiene credenciales activas para ambiente ${ambiente}`,
      canRetry: false,
    };
  }

  let apiToken = normalizeBearerToken(credentials.api_token);
  let apiTokenExpiresAt = credentials.api_token_expires_at;

  if (shouldRefreshTokenWithExp(credentials.api_token, credentials.api_token_expires_at, ambiente)) {
    logger.info('Refrescando token MH', { nit: nitBusqueda, ambiente });

    if (!credentials.api_password) {
      return {
        status: 'failed',
        errorCode: 'TOKEN_ERROR_NO_API_PASSWORD',
        errorMessage: 'No hay api_password configurada para renovar el token MH',
        canRetry: false,
      };
    }

    const { token, expMs } = await getCachedMHAuthToken(nitBusqueda, credentials.api_password, ambiente);
    apiToken = token;
    apiTokenExpiresAt = expMs ? new Date(expMs).toISOString() : undefined;

    await updateMHTokenByNIT(nitBusqueda, ambiente, apiToken, apiTokenExpiresAt);
  }

  return {
    apiToken,
    apiTokenExpiresAt,
    businessId: credentials.business_id || state.businessId,
  };
};
