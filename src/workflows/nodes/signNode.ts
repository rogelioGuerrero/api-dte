import { DTEState } from "../state";
import { getMHCredentialsByNIT } from '../../business/businessStorage';
import { firmarDocumento, limpiarDteParaFirma, wakeFirmaService } from "../../integrations/firmaClient";
import { processDTE } from "../../mh/process";

export const signNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("✍️ Nodo Firmador: Solicitando firma electrónica...");
  
  if (!state.dte) { 
    return { 
      status: 'failed',
      errorCode: 'SIGN_ERROR_NO_DTE',
      errorMessage: 'No hay DTE para firmar',
      canRetry: true,
      progressPercentage: 25
    };
  }

  try {
    // Asegurar que el servicio de firma esté despierto
    await wakeFirmaService({ retries: 3, baseDelayMs: 2000, timeoutMs: 60000 });

    const processed = processDTE(state.dte);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();

    // Obtener las credenciales del negocio para sacar el token y la contraseña de firma
    // Buscamos por NIT y lo limpiamos de guiones para ser más robustos
    const nitLimpioBusqueda = (state.businessId || nitEmisor).replace(/[\s-]/g, '').trim();
    const credentials = await getMHCredentialsByNIT(nitLimpioBusqueda, state.ambiente || '00');
    
    if (!credentials) {
      console.error(`❌ No hay credenciales en Supabase para el NIT: ${nitLimpioBusqueda}`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_NO_CREDENTIALS',
        errorMessage: `El NIT ${nitLimpioBusqueda} no está registrado o no tiene credenciales activas en Supabase para el ambiente ${state.ambiente || '00'}`,
        canRetry: false,
        progressPercentage: 25
      };
    }

    // Validación de Suscripción / Licencia activa
    if (!credentials.activo) {
      console.error(`❌ Licencia inactiva o suspendida para el NIT: ${nitLimpioBusqueda}`);
      return {
        status: 'failed',
        errorCode: 'SIGN_ERROR_INACTIVE_LICENSE',
        errorMessage: `El servicio DTE se encuentra suspendido para el contribuyente ${nitLimpioBusqueda}. Por favor verifique su licencia o suscripción.`,
        canRetry: false,
        progressPercentage: 25
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
        progressPercentage: 25
      };
    }

    // Ejecutar firma real
    const jwsFirmado = await firmarDocumento({
      nit: nitEmisor,
      passwordPri: finalPasswordPri,
      dteJson: dteLimpio,
      apiToken: credentials.api_token // Pasamos el token del negocio
    });

    console.log("✅ Firma exitosa");
    return {
      isSigned: true,
      signature: jwsFirmado,
      status: 'transmitting',
      progressPercentage: 50,
      currentStep: 'signer',
      estimatedTime: 30 // 30 segundos restantes
    };
  } catch (error: any) {
    console.error("❌ Error de firma:", error);
    return {
      status: 'failed',
      errorCode: 'SIGN_ERROR_SERVICE',
      errorMessage: `Error al firmar: ${error.message || 'Desconocido'}`,
      canRetry: true,
      progressPercentage: 40
    };
  }
};
