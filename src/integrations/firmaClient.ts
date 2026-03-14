import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('firmaClient');

const getBaseUrl = (): string => {
  const envUrl = process.env.FIRMA_SERVICE_URL;
  if (!envUrl) return 'https://api-firma.onrender.com/firma';

  if (envUrl.endsWith('/firmardocumento') || envUrl.endsWith('/firmardocumento/')) {
    return envUrl.replace(/\/firmardocumento\/?$/, '');
  }

  return envUrl.replace(/\/$/, '');
};

const FIRMA_BASE_URL = getBaseUrl();
const FIRMA_SIGN_URL = `${FIRMA_BASE_URL}/firmardocumento/`;
const FIRMA_STATUS_URL = `${FIRMA_BASE_URL}/status`;

export interface FirmaRequest {
  nit: string;
  passwordPri: string;
  certificadoB64: string;
  dteJson: Record<string, unknown>;
}

export interface FirmaResponse {
  success: boolean;
  jws?: string;
  error?: string;
}

const parseRetryAfterMs = (retryAfter?: string): number | undefined => {
  if (!retryAfter) return undefined;

  const asNumber = Number(retryAfter);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber * 1000;
  }

  const asDate = Date.parse(retryAfter);
  if (Number.isNaN(asDate)) return undefined;

  const diff = asDate - Date.now();
  return diff > 0 ? diff : undefined;
};

const createRateLimitError = (message: string, retryAfterMs?: number) => {
  const error = new Error(message) as Error & { code?: string; retryAfterMs?: number };
  error.code = 'FIRMA_RATE_LIMIT';
  if (retryAfterMs) {
    error.retryAfterMs = retryAfterMs;
  }
  return error;
};

export const firmarDocumento = async (request: FirmaRequest): Promise<string> => {
  try {
    logger.info('Enviando solicitud de firma', { nit: request.nit });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'es-ES,es;q=0.9',
      'User-Agent': 'Mozilla/5.0',
      'Connection': 'close',
    };

    const payload = {
      nit: request.nit,
      passwordPri: request.passwordPri,
      certificadoB64: request.certificadoB64,
      dteJson: typeof request.dteJson === 'string' ? request.dteJson : JSON.stringify(request.dteJson)
    };

    const maxAttempts = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.post(FIRMA_SIGN_URL, payload, {
          headers,
          timeout: 30000,
          validateStatus: () => true,
        });

        const data = response.data;
        const status = response.status;

        if (typeof data === 'string' && data.toLowerCase().includes('<html')) {
          const msg = 'Servicio de firma bloqueado o protegido (Cloudflare/HTML). No se pudo firmar.';
          logger.error(msg, { snippet: data.substring(0, 120), status });
          throw new Error(msg);
        }

        if (status === 403) {
          const msg = 'Servicio de firma respondió 403. No reintento para evitar bloqueo.';
          logger.error(msg);
          throw new Error(msg);
        }

        if (status === 429) {
          const retryAfterMs = parseRetryAfterMs(response.headers['retry-after']);
          const msg = `Servicio de firma respondió 429 Too Many Requests${retryAfterMs ? `; reintentar en ${Math.ceil(retryAfterMs / 1000)}s` : ''}.`;
          logger.warn(msg, { nit: request.nit, retryAfterMs });
          throw createRateLimitError(msg, retryAfterMs);
        }

        if (data.success && data.jws) {
          logger.info('Documento firmado exitosamente');
          return data.jws;
        } else if (data.status === 'ERROR' && data.body) {
          throw new Error(`Código ${data.body.codigo}: ${data.body.mensaje}`);
        } else {
          throw new Error(data.error || JSON.stringify(data));
        }
      } catch (err: any) {
        lastError = err;
        const isLast = attempt === maxAttempts;

        if (!isLast) {
          const retryAfterMs = err?.retryAfterMs;
          const delay = retryAfterMs || (err?.code === 'FIRMA_RATE_LIMIT' ? 3000 * attempt : 1000 * attempt);
          logger.warn(`Reintento firma (${attempt}/${maxAttempts - 1}) en ${delay}ms`, {
            error: err.message,
            code: err?.code,
            retryAfterMs,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  } catch (error: any) {
    if (error.response && error.response.data) {
      const data = error.response.data;

      if (typeof data === 'string' && data.toLowerCase().includes('<html')) {
        const msg = 'Servicio de firma bloqueado o protegido (Cloudflare/HTML). No se pudo firmar.';
        logger.error(msg, { snippet: data.substring(0, 120) });
        throw new Error(msg);
      }

      if (data.status === 'ERROR' && data.body) {
        const errorMsg = `Código ${data.body.codigo}: ${data.body.mensaje}`;
        logger.error('Error del servicio de firma', { error: errorMsg });
        throw new Error(errorMsg);
      }

      logger.error('Error del servicio de firma', { error: JSON.stringify(data) });
      throw new Error(JSON.stringify(data));
    }

    logger.error('Error firmando documento', {
      error: error.message,
      code: error.code,
      retryAfterMs: error.retryAfterMs,
    });

    if (error.code === 'FIRMA_RATE_LIMIT') {
      throw error;
    }

    throw new Error(`Error al firmar: ${error.message}`);
  }
};

export const limpiarDteParaFirma = (dte: any): Record<string, unknown> => {
  const cleaned = JSON.parse(JSON.stringify(dte));

  delete cleaned.firma;
  delete cleaned.selloRecibido;
  delete cleaned.fechaHoraRecepcion;

  return cleaned;
};

export const wakeFirmaService = async (options: {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
} = {}): Promise<void> => {
  const { retries = 5, baseDelayMs = 10000, timeoutMs = 15000 } = options;

  logger.info('Verificando servicio de firma (chequeo de ping)…');

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(FIRMA_STATUS_URL, {
        timeout: timeoutMs,
        validateStatus: () => true,
      });

      if (response.status === 200) {
        logger.info('Servicio de firma está activo');
        return;
      }

      if (response.status === 429) {
        logger.warn('Servicio de firma respondió 429 en ping. Omitimos más chequeos y dejamos que la firma maneje el rate limit.');
        return;
      }
    } catch (error) {
      logger.warn(`Intento ${i + 1}/${retries}: Servicio de firma (ping) no responde`);

      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, baseDelayMs));
      }
    }
  }

  logger.warn('No se pudo verificar el servicio de firma (ping). Continuamos y enviaremos a firmar igual.');
};
