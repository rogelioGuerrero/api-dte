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
  certificadoB64: string; // Certificado en formato Base64
  dteJson: Record<string, unknown>;
}

export interface FirmaResponse {
  success: boolean;
  jws?: string;
  error?: string;
}

export const firmarDocumento = async (request: FirmaRequest): Promise<string> => {
  try {
    logger.info('Enviando solicitud de firma', { nit: request.nit });
    
    // Headers base (parecer navegador evita bloqueos tontos en proxies)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'es-ES,es;q=0.9',
      'User-Agent': 'Mozilla/5.0',
      'Connection': 'close',
    };
    
    // Payload sin apiToken (el API no requiere autenticación)
    const payload = {
      nit: request.nit,
      passwordPri: request.passwordPri,
      certificadoB64: request.certificadoB64,
      // Convertimos explícitamente a string para evitar el error "Problemas al convertir String a Json"
      dteJson: typeof request.dteJson === 'string' ? request.dteJson : JSON.stringify(request.dteJson)
    };
    
    const maxAttempts = 2;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.post(FIRMA_SIGN_URL, payload, {
          headers,
          timeout: 30000, // 30 segundos timeout
          validateStatus: () => true, // manejamos manualmente
        });

        const data = response.data;
        const status = response.status;

        // Cortes inmediatos por HTML o 403 para no seguir golpeando
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

        // Éxito: { success: true, jws: "..." }
        if (data.success && data.jws) {
          logger.info('Documento firmado exitosamente');
          return data.jws;
        } 
        // Error: { status: "ERROR", body: { codigo: "...", mensaje: "..." } }
        else if (data.status === 'ERROR' && data.body) {
          throw new Error(`Código ${data.body.codigo}: ${data.body.mensaje}`);
        } 
        // Fallback
        else {
          throw new Error(data.error || JSON.stringify(data));
        }
      } catch (err: any) {
        lastError = err;
        const isLast = attempt === maxAttempts;
        if (!isLast) {
          // Backoff simple para no martillar el servicio
          const delay = 500 * attempt; // 500ms, 1000ms
          logger.warn(`Reintento firma (${attempt}/${maxAttempts - 1}) en ${delay}ms`, { error: err.message });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  } catch (error: any) {
    // Si Axios lanza un error (ej. HTTP 400, 500)
    if (error.response && error.response.data) {
      const data = error.response.data;

      // Detectar respuestas HTML (p.ej. Cloudflare / Just a moment)
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
    
    logger.error('Error firmando documento', { error: error.message });
    throw new Error(`Error al firmar: ${error.message}`);
  }
};

export const limpiarDteParaFirma = (dte: any): Record<string, unknown> => {
  // Crear una copia limpia del DTE para firma
  const cleaned = JSON.parse(JSON.stringify(dte));
  
  // Eliminar campos que no deben ir en la firma
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
  // Render puede estar dormido; enviamos pings más seguidos para despertarlo
  const { retries = 5, baseDelayMs = 10000, timeoutMs = 15000 } = options;
  
  logger.info('Verificando servicio de firma (chequeo de ping)…');
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(FIRMA_STATUS_URL, {
        timeout: timeoutMs,
      });
      
      if (response.status === 200) {
        logger.info('Servicio de firma está activo');
        return;
      }
    } catch (error) {
      logger.warn(`Intento ${i + 1}/${retries}: Servicio de firma (ping) no responde`);
      
      if (i < retries - 1) {
        // Esperamos un lapso fijo (pulsos cada ~10s) para intentar despertarlo
        await new Promise(resolve => setTimeout(resolve, baseDelayMs));
      }
    }
  }
  
  logger.warn('No se pudo verificar el servicio de firma (ping). Continuamos y enviaremos a firmar igual.');
};
