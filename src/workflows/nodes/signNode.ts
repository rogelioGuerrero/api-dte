import { DTEState } from "../state";
import { getMHCredentialsByNIT } from '../../business/businessStorage';
import { limpiarDteParaFirma } from "../../integrations/firmaClient";
import { processDTE } from "../../mh/process";
import { signWithConfiguredProvider } from "../../signature/service";

export const signNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("✍️ Nodo Firmador: Solicitando firma electrónica...");
  
  if (!state.dte) { 
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
    const processed = processDTE(state.dte);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
    const nitEmisor = (state.nit || state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();

    const nitLimpioBusqueda = nitEmisor;
    
    console.log(`🔍 Buscando credenciales para NIT: ${nitLimpioBusqueda}, ambiente: ${state.ambiente || '00'}`);
    
    const credentials = await getMHCredentialsByNIT(nitLimpioBusqueda, state.ambiente || '00');
    
    if (!credentials) {
      console.error(`❌ No hay credenciales en Supabase para el NIT: ${nitLimpioBusqueda}`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_NO_CREDENTIALS',
        errorMessage: `El NIT ${nitLimpioBusqueda} no está registrado o no tiene credenciales activas en Supabase para el ambiente ${state.ambiente || '00'}`,
        canRetry: false,
        progressPercentage: 25,
        currentStep: 'signer'
      };
    }

    console.log(`✅ Credenciales encontradas para business_id: ${credentials.business_id}`);

    // Validación de Suscripción / Licencia activa
    if (!credentials.activo) {
      console.error(`❌ Licencia inactiva o suspendida para el NIT: ${nitLimpioBusqueda}`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_INACTIVE_LICENSE',
        errorMessage: `El servicio DTE se encuentra suspendido para el contribuyente ${nitLimpioBusqueda}. Por favor verifique su licencia o suscripción.`,
        canRetry: false,
        progressPercentage: 25,
        currentStep: 'signer'
      };
    }

    // Usar la contraseña del request (si viene, para retrocompatibilidad/pruebas) o la guardada en Supabase
    const finalPasswordPri = state.passwordPri || credentials.password_pri;

    if (!finalPasswordPri) {
      console.error(`❌ No hay contraseña configurada en Supabase para el NIT: ${nitLimpioBusqueda}`);
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
      console.error(`❌ No hay certificado (Base64) configurado en Supabase para el NIT: ${nitLimpioBusqueda}`);
      return { 
        status: 'failed', 
        errorCode: 'SIGN_ERROR_NO_CERTIFICATE',
        errorMessage: 'El certificado digital (.p12/.pfx) no está configurado en la base de datos para este NIT',
        canRetry: false,
        progressPercentage: 25,
        currentStep: 'signer'
      };
    }

    console.log(`🔐 Enviando a firmar con proveedor externo...`);
    const { jws, provider } = await signWithConfiguredProvider({
      nit: nitEmisor,
      passwordPri: finalPasswordPri,
      certificadoB64: credentials.certificado_b64,
      dteJson: dteLimpio
    });

    console.log(`✅ Firma exitosa (${provider})`);
    return {
      isSigned: true,
      signature: jws,
      status: 'transmitting',
      progressPercentage: 50,
      currentStep: 'signer',
      estimatedTime: 30, // 30 segundos restantes
      businessId: state.businessId || credentials.business_id,
      nit: nitLimpioBusqueda,
    };
  } catch (error: any) {
    console.error("❌ Error de firma:", error);
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
