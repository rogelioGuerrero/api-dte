import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('firmaClient');

const FIRMA_SERVICE_URL = process.env.FIRMA_SERVICE_URL || 'https://api-firma.onrender.com/firma';

export interface FirmaRequest {
  nit: string;
  passwordPri: string;
  dteJson: Record<string, unknown>;
  apiToken?: string; // Token de autenticación para el servicio de firma
}

export interface FirmaResponse {
  success: boolean;
  jws?: string;
  error?: string;
}

export const firmarDocumento = async (request: FirmaRequest): Promise<string> => {
  try {
    logger.info('Enviando solicitud de firma', { nit: request.nit });
    
    // Headers base
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Si se proporciona un token, añadirlo a los headers (según lo que espere api-firma)
    if (request.apiToken) {
      headers['Authorization'] = `Bearer ${request.apiToken}`;
      // O si espera un header personalizado:
      // headers['x-api-key'] = request.apiToken;
    }
    
    const response = await axios.post<FirmaResponse>(FIRMA_SERVICE_URL, request, {
      headers,
      timeout: 30000, // 30 segundos timeout
    });

    if (response.data.success && response.data.jws) {
      logger.info('Documento firmado exitosamente');
      return response.data.jws;
    } else {
      throw new Error(response.data.error || 'Error en la firma del documento');
    }
  } catch (error: any) {
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
  const { retries = 3, baseDelayMs = 2000, timeoutMs = 60000 } = options;
  
  logger.info('Verificando servicio de firma...');
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(FIRMA_SERVICE_URL.replace('/firma', '/health'), {
        timeout: timeoutMs,
      });
      
      if (response.status === 200) {
        logger.info('Servicio de firma está activo');
        return;
      }
    } catch (error) {
      logger.warn(`Intento ${i + 1}/${retries}: Servicio de firma no responde`);
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, baseDelayMs * (i + 1)));
      }
    }
  }
  
  logger.warn('No se pudo verificar el servicio de firma, continuando...');
};
