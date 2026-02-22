import { DTEState } from "../state";
import { transmitirDTESandbox } from "../../mh/sandboxClient";
import { createLogger } from '../../utils/logger';
import { getMHCredentialsByNIT, updateMHTokenByNIT } from '../../business/businessStorage';
import { randomUUID } from 'crypto';
import { getCachedMHAuthToken, normalizeBearerToken, shouldRefreshTokenWithExp } from '../../mh/authClient';

const logger = createLogger('transmitNode');

export const transmitNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📡 Transmisor: Enviando a Ministerio de Hacienda...");

  if (!state.signature) {
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_NO_SIGNATURE',
      errorMessage: 'No hay firma JWS para transmitir',
      canRetry: true,
      progressPercentage: 50
    };
  }

  if (!state.dte) {
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_NO_DTE',
      errorMessage: 'No hay DTE en el estado para extraer metadata',
      canRetry: true,
      progressPercentage: 50
    };
  }

  try {
    const ambiente = state.ambiente || '00';
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();
    const nitLimpioBusqueda = (state.businessId || nitEmisor).replace(/[\s-]/g, '').trim();
    
    // Obtener credenciales para extraer el token
    const credentials = await getMHCredentialsByNIT(nitLimpioBusqueda, ambiente);

    if (!credentials) {
      return {
        status: 'failed',
        errorCode: 'TRANSMIT_ERROR_NO_CREDENTIALS',
        errorMessage: `El NIT ${nitLimpioBusqueda} no tiene credenciales activas para ambiente ${ambiente}`,
        canRetry: false,
        progressPercentage: 50
      };
    }

    let apiToken = normalizeBearerToken(credentials.api_token);
    let apiTokenExpiresAt = credentials.api_token_expires_at;

    if (shouldRefreshTokenWithExp(credentials.api_token, credentials.api_token_expires_at, ambiente)) {
      console.log(`🔄 Token necesita refresh para NIT ${nitLimpioBusqueda}`);
      
      if (!credentials.api_password) {
        console.error(`❌ No api_password para NIT ${nitLimpioBusqueda}`);
        return {
          status: 'failed',
          errorCode: 'TRANSMIT_ERROR_NO_API_PASSWORD',
          errorMessage: 'No hay contraseña API configurada para obtener token MH',
          canRetry: false,
          progressPercentage: 50
        };
      }

      const { token, expMs } = await getCachedMHAuthToken(nitLimpioBusqueda, credentials.api_password, ambiente);
      apiToken = token;
      apiTokenExpiresAt = expMs ? new Date(expMs).toISOString() : undefined;
      console.log(`💾 Guardando token actualizado en BD...`);
      await updateMHTokenByNIT(nitLimpioBusqueda, ambiente, apiToken, apiTokenExpiresAt);
    }
    
    // Extraer metadata necesaria para el MH
    const version = state.dte.identificacion?.version || 1; // Usar versión declarada en el DTE
    const tipoDte = state.dte.identificacion?.tipoDte || '01'; // Default CCF
    const codigoGeneracion = state.dte.identificacion?.codigoGeneracion || randomUUID(); // Usar el mismo del DTE o generar uno
    const idEnvio = Math.floor(Math.random() * 999999) + 1; // MH espera número entero, no UUID

    // Transmisión real
    const result = await transmitirDTESandbox(
      state.signature, 
      ambiente, 
      apiToken,
      version, 
      tipoDte, 
      idEnvio,
      codigoGeneracion
    );
    
    if (result.success) {
      console.log("✅ MH: Recibido exitosamente.", result.selloRecepcion);
      
      // El guardado y correo lo maneja emailNode
      
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
      
      // Detectar problemas de conexión o errores 500 para contingencia
      const isCommError = result.errores?.some(e => e.codigo === 'COM-ERR' || e.codigo.startsWith('HTTP-'));
      
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
            progressPercentage: 70
          };
        }
      }

      // Errores de validación de MH (no reintentables)
      return {
        status: 'failed',
        errorCode: 'TRANSMIT_ERROR_MH_VALIDATION',
        errorMessage: result.errores?.map(e => `MH [${e.codigo}]: ${e.descripcion}`).join(', ') || result.mensaje || 'Error desconocido MH',
        canRetry: false, // Errores de MH no se reintentan
        progressPercentage: 60
      };
    }
  } catch (error: any) {
    console.error("❌ Error crítico en transmisión:", error);
    return {
      status: 'failed',
      errorCode: 'TRANSMIT_ERROR_SYSTEM',
      errorMessage: `Error transmisión: ${error.message}`,
      canRetry: true,
      progressPercentage: 60
    };
  }
};
