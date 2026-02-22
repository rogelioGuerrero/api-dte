import { DTEState } from "../state";
import { transmitirDTESandbox } from "../../mh/sandboxClient";
import { createLogger } from '../../utils/logger';
import { getMHCredentialsByNIT } from '../../business/businessStorage';
import { randomUUID } from 'crypto';

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
    
    // Extraer metadata necesaria para el MH
    const version = state.dte.identificacion?.version || 1;
    const tipoDte = state.dte.identificacion?.tipoDte || '01'; // Default CCF
    const idEnvio = randomUUID(); // MH requiere un UUID único por envío

    // Transmisión real
    const result = await transmitirDTESandbox(
      state.signature, 
      ambiente, 
      credentials?.api_token || '', // Pasamos el token si existe, sino string vacío 
      version, 
      tipoDte, 
      idEnvio
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
