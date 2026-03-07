import { DTEState } from "../state";
import { transmitirDTESandbox } from "../../mh/sandboxClient";
import { createLogger } from '../../utils/logger';
import { getMHCredentialsByNIT, updateMHTokenByNIT } from '../../business/businessStorage';
import { randomUUID } from 'crypto';
import { getCachedMHAuthToken, normalizeBearerToken, requestMHAuthToken, shouldRefreshTokenWithExp } from '../../mh/authClient';
import { saveSignedDteDebug } from '../../database/debugLogger';

const decodeJwsPayload = (jws: string) => {
  try {
    const parts = jws.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
};

const logger = createLogger('transmitNode');

export const transmitNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  const ambiente = state.ambiente || '00';
  const nitEmisor = (state.nit || state.dte?.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();
  const nitLimpioBusqueda = nitEmisor;
  
  console.log(`📡 Transmitter: Enviando DTE a MH para NIT: ${nitLimpioBusqueda}, ambiente: ${ambiente}`);
  
  if (!state.dte || !state.signature || !state.apiToken) {
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_MISSING_DATA',
      errorMessage: 'Faltan datos requeridos para transmisión (DTE, firma o token)',
      canRetry: false,
      currentStep: 'transmitter'
    };
  }

  try {
    // Obtener credenciales para extraer el token
    const credentials = await getMHCredentialsByNIT(nitLimpioBusqueda, ambiente);

    if (!credentials) {
      console.error('❌ TransmitNode: sin credenciales MH', { nitLimpioBusqueda, ambiente });
      return {
        status: 'failed',
        errorCode: 'TRANSMIT_ERROR_NO_CREDENTIALS',
        errorMessage: `No se encontraron credenciales para NIT ${nitLimpioBusqueda} en ambiente ${ambiente}`,
        canRetry: false,
        currentStep: 'transmitter'
      };
    }

    console.log(`✅ Credenciales encontradas para transmisión, business_id: ${credentials.business_id}`);

    // Usar el token actualizado del estado o el de las credenciales
    const finalApiToken = state.apiToken || normalizeBearerToken(credentials.api_token);
    
    if (!finalApiToken) {
      return {
        status: 'failed',
        errorCode: 'TRANSMIT_ERROR_NO_TOKEN',
        errorMessage: 'No hay token API válido para transmisión',
        canRetry: true,
        currentStep: 'transmitter'
      };
    }

    // Log del payload JWS para debug
    try {
      const decoded = decodeJwsPayload(state.signature);
      if (decoded) {
        const resumenDbg = decoded.resumen || {};
        const itemsDbg = (decoded.cuerpoDocumento || []).map((i: any) => ({ numItem: i.numItem, ventaGravada: i.ventaGravada, ivaItem: i.ivaItem }));
        logger.info('DEBUG JWS PAYLOAD', {
          resumen: {
            totalGravada: resumenDbg.totalGravada,
            totalExenta: resumenDbg.totalExenta,
            totalNoSuj: resumenDbg.totalNoSuj,
            totalIva: resumenDbg.totalIva,
            montoTotalOperacion: resumenDbg.montoTotalOperacion,
            totalPagar: resumenDbg.totalPagar,
          },
          items: itemsDbg,
        });
        await saveSignedDteDebug({
          codigoGeneracion: state.dte.identificacion?.codigoGeneracion || '',
          signature: state.signature,
          payload: decoded,
        });
      }
    } catch (e) {
      logger.warn('No se pudo loggear payload decodificado', { error: (e as any)?.message });
    }

    console.log(`🚀 Enviando DTE firmado a MH...`);
    const result = await transmitirDTESandbox(
      state.signature,
      ambiente,
      finalApiToken,
      1, // version
      state.dte.identificacion?.tipoDte || '01',
      1, // idEnvio
      state.dte.identificacion?.codigoGeneracion
    );

    if (result.estado === 'CONTINGENCIA') {
      console.warn("⚠️ MH offline. Activando Contingencia.");
      return {
        status: 'contingency',
        isOffline: true,
        contingencyReason: result.mensaje || 'Servicio MH no disponible',
        mhResponse: result,
        businessId: state.businessId || credentials.business_id,
        nit: nitLimpioBusqueda,
        currentStep: 'transmitter',
        progressPercentage: 75,
        estimatedTime: 20 // 20 segundos más
      };
    }

    if (result.success) {
      console.log("✅ MH: Recibido exitosamente.", result.selloRecepcion);
      
      return {
        isTransmitted: true,
        mhResponse: result,
        status: 'completed',
        progressPercentage: 90,
        currentStep: 'transmitter',
        estimatedTime: 5 // 5 segundos para tax keeper
      };
    } else {
      // Manejo de errores
      console.error("❌ MH Rechazo/Error:", result);

      // Detectar errores de negocio MH (estado RECHAZADO) -> no reintentar
      const mhRejected = result.estado === 'RECHAZADO' || (result as any).codigoMsg || (result as any).clasificaMsg;

      // Detectar problemas de conexión o errores 500 para contingencia
      const isCommError = !mhRejected && result.errores?.some((e: any) => e.codigo === 'COM-ERR' || e.codigo.startsWith('HTTP-'));
      
      if (isCommError) {
        if ((state.retryCount || 0) < 2) {
          console.log(`🔄 Error de conexión. Reintentando (${(state.retryCount || 0) + 1}/3)...`);
          return {
            retryCount: (state.retryCount || 0) + 1,
            status: 'transmitting',
            progressPercentage: 60,
            currentStep: 'transmitter',
            estimatedTime: 20 // 20 segundos más
          };
        } else {
          console.warn("⚠️ Timeout/Error Conexión. Activando Contingencia.");
          return {
            status: 'contingency',
            isOffline: true,
            contingencyReason: "Falla de comunicación con MH",
            errorCode: 'TRANSMIT_ERROR_COMMUNICATION',
            errorMessage: 'Falla de comunicación con Ministerio de Hacienda',
            canRetry: true,
            progressPercentage: 70,
            currentStep: 'transmitter'
          };
        }
      }

      // Errores de validación de MH (no reintentables)
      return {
        status: 'failed',
        errorCode: 'TRANSMIT_ERROR_MH_VALIDATION',
        errorMessage: result.errores?.map(e => `MH [${e.codigo}]: ${e.descripcion}`).join(', ') || result.mensaje || 'Error desconocido MH',
        canRetry: false, // Errores de MH no se reintentan
        progressPercentage: 60,
        currentStep: 'transmitter'
      };
    }
  } catch (error: any) {
    console.error("❌ Error crítico en transmisión:", error);
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_SYSTEM',
      errorMessage: `Error transmisión: ${error.message}`,
      canRetry: true,
      progressPercentage: 60,
      currentStep: 'transmitter'
    };
  }
};
