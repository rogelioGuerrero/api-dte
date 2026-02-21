import { DTEState } from "../state";
import { saveDTEDocument } from "../../dte/dteStorage";
import { transmitirDTESandbox } from "../../mh/sandboxClient";

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

  try {
    const ambiente = state.ambiente || '00';
    
    // Transmisión real
    const result = await transmitirDTESandbox(state.signature, ambiente);
    
    if (result.success) {
      console.log("✅ MH: Recibido exitosamente.", result.selloRecepcion);
      
      // Guardar documento procesado
      if (state.businessId && state.codigoGeneracion) {
        await saveDTEDocument({
          codigo_generacion: state.codigoGeneracion,
          tipo_dte: state.dte!.identificacion.tipoDte,
          numero_control: state.dte!.identificacion.numeroControl,
          estado: 'processed',
          dte_json: state.dte!,
          firma_jws: state.signature,
          mh_response: result,
          business_id: state.businessId,
          issuer_nit: state.dte!.emisor.nit,
          clase_documento: 'emitido',
          sello_recibido: result.selloRecepcion,
          fh_procesamiento: result.fechaHoraRecepcion
        });
      }

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
