import { DTEState } from "../state";
import { getMHCredentialsByNIT } from '../../business/businessStorage';
import { limpiarDteParaFirma } from "../../integrations/firmaClient";
import { processDTE } from "../../mh/process";
import { signWithConfiguredProvider } from "../../signature/service";
import { obtenerFechaActual, obtenerHoraActual, actualizarFechasDTE } from "../../dte/generator";

const isTemporaryFirmaAvailabilityError = (error: any) => {
  const message = `${error?.message || ''}`.toUpperCase();
  return error?.code === 'FIRMA_RATE_LIMIT'
    || message.includes('TOO MANY REQUESTS')
    || message.includes('RATE LIMIT')
    || message.includes('CLOUDFLARE')
    || message.includes('PROTEGIDO')
    || message.includes('TIMED OUT')
    || message.includes('ECONNRESET')
    || message.includes('ECONNREFUSED')
    || message.includes('ETIMEDOUT');
};

const buildTemporaryFirmaMessage = (error: any) => {
  const retryAfterMs = error?.retryAfterMs;
  if (retryAfterMs && Number.isFinite(retryAfterMs)) {
    return `El servicio de firma está calentando o temporalmente saturado. Intenta nuevamente en ${Math.max(1, Math.ceil(retryAfterMs / 1000))} segundos.`;
  }

  return 'El servicio de firma está iniciando o temporalmente saturado. Intenta nuevamente en unos segundos.';
};

export const signNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("✍️ [signNode] Nodo Firmador INICIADO. Solicitando firma electrónica...");
  const dteToSign = state.preparedDte || state.dte;

  if (!dteToSign) {
    console.error("❌ [signNode] Error: No hay DTE en el estado para firmar.");
    return {
      status: 'failed',
      errorCode: 'SIGN_ERROR_NO_DTE',
      errorMessage: 'No hay DTE para firmar',
      canRetry: true,
      progressPercentage: 25,
      currentStep: 'signer'
    };
  }

  try {
    console.log("🔄 [signNode] Preparando DTE para firma...");
    const processed = state.preparedDte ? { dte: state.preparedDte, errores: [] } : processDTE(dteToSign);
    
    // Actualizar fecha y hora al momento exacto de la firma
    console.log("🕐 [signNode] Actualizando fecha/hora a la fecha actual...");
    const dteConFechaActual = actualizarFechasDTE(processed.dte);
    
    const dteLimpio = limpiarDteParaFirma(dteConFechaActual as unknown as Record<string, unknown>);

    const nitEmisor = (state.nit || dteToSign.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();
    console.log(`🆔 [signNode] NIT Emisor detectado: ${nitEmisor}`);

    const nitLimpioBusqueda = nitEmisor;

    console.log(`🔍 [signNode] Buscando credenciales en Supabase para NIT: ${nitLimpioBusqueda}, ambiente: ${state.ambiente || '00'}`);

    const credentials = await getMHCredentialsByNIT(nitLimpioBusqueda, state.ambiente || '00');

    if (!credentials) {
      console.error(`❌ [signNode] No se encontraron credenciales en Supabase para el NIT: ${nitLimpioBusqueda}`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_NO_CREDENTIALS',
        errorMessage: `El NIT ${nitLimpioBusqueda} no está registrado o no tiene credenciales activas en Supabase para el ambiente ${state.ambiente || '00'}`,
        canRetry: false,
        progressPercentage: 25,
        currentStep: 'signer'
      };
    }

    console.log(`✅ [signNode] Credenciales encontradas. Business ID: ${credentials.business_id}`);

    if (!credentials.activo) {
      console.error(`❌ [signNode] Licencia inactiva o suspendida para el NIT: ${nitLimpioBusqueda}`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_INACTIVE_LICENSE',
        errorMessage: `El servicio DTE se encuentra suspendido para el contribuyente ${nitLimpioBusqueda}. Por favor verifique su licencia o suscripción.`,
        canRetry: false,
        progressPercentage: 25,
        currentStep: 'signer'
      };
    }

    const finalPasswordPri = state.passwordPri || credentials.password_pri;

    if (!finalPasswordPri) {
      console.error(`❌ [signNode] Faltan credenciales: No hay password_pri.`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_NO_PASSWORD',
        errorMessage: 'La contraseña del certificado no está configurada en la base de datos para este NIT',
        canRetry: false,
        progressPercentage: 25,
        currentStep: 'signer'
      };
    }

    if (!credentials.certificado_b64) {
      console.error(`❌ [signNode] Faltan credenciales: No hay certificado_b64.`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_NO_CERTIFICATE',
        errorMessage: 'El certificado digital (.p12/.pfx) no está configurado en la base de datos para este NIT',
        canRetry: false,
        progressPercentage: 25,
        currentStep: 'signer'
      };
    }

    console.log(`🔐 [signNode] Enviando payload a firmar con proveedor externo...`);
    const { jws, provider } = await signWithConfiguredProvider({
      nit: nitEmisor,
      passwordPri: finalPasswordPri,
      certificadoB64: credentials.certificado_b64,
      dteJson: dteLimpio
    });

    console.log(`✅ [signNode] Firma exitosa recibida. Proveedor: ${provider}`);
    console.log(`📝 [signNode] JWS longitud: ${jws?.length}`);

    return {
      dte: dteConFechaActual,
      preparedDte: dteConFechaActual,
      isSigned: true,
      signature: jws,
      status: 'transmitting',
      progressPercentage: 50,
      currentStep: 'signer',
      estimatedTime: 30,
      businessId: state.businessId || credentials.business_id,
      nit: nitLimpioBusqueda,
    };
  } catch (error: any) {
    console.error("❌ [signNode] Excepción capturada en proceso de firma:", error);

    if (isTemporaryFirmaAvailabilityError(error)) {
      return {
        status: 'failed',
        errorCode: 'SIGNER_TEMPORARILY_UNAVAILABLE',
        errorMessage: buildTemporaryFirmaMessage(error),
        canRetry: true,
        progressPercentage: 35,
        currentStep: 'signer',
        retryAfterMs: error?.retryAfterMs,
      };
    }

    return {
      status: 'failed',
      errorCode: 'SIGN_ERROR_SERVICE',
      errorMessage: `Error al firmar: ${error.message || 'Desconocido'}`,
      canRetry: true,
      progressPercentage: 40,
      currentStep: 'signer'
    };
  }
};
