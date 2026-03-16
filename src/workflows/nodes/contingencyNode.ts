import { DTEState } from "../state";
import { convertirAContingencia } from "../../dte/generator";
import { firmarDocumento, limpiarDteParaFirma } from "../../integrations/firmaClient";
import { processDTE } from "../../mh/process";
import { saveDTEDocument } from "../../dte/dteStorage";
import { TransmisionResult } from "../../types/types";
import { getMHCredentialsByNIT } from "../../business/businessStorage";

export const contingencyNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📦 [contingencyNode] Gestor Contingencia: Transformando a Modelo Diferido...");
  const dteToContingency = state.preparedDte || state.dte;
  
  if (!dteToContingency) {
    console.error("❌ [contingencyNode] No hay DTE en el estado.");
    return { status: 'failed' };
  }

  try {
    // Transformar DTE a Contingencia
    const dteContingencia = convertirAContingencia(dteToContingency, state.contingencyReason);
    
    // Volver a procesar y firmar el DTE de contingencia
    const processed = processDTE(dteContingencia);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
    const nitEmisor = (dteToContingency.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();

    // Obtener credenciales para tener el certificado
    console.log(`🔍 [contingencyNode] Buscando certificado para NIT: ${nitEmisor}`);
    const credentials = await getMHCredentialsByNIT(nitEmisor, state.ambiente || '00');

    if (!credentials || !credentials.certificado_b64) {
      console.error(`❌ [contingencyNode] No se encontró certificado para NIT ${nitEmisor}`);
      return { 
        status: 'failed',
        validationErrors: [`No se encontraron credenciales/certificado para NIT ${nitEmisor} en contingencia`]
      };
    }

    const passwordPri = state.passwordPri || credentials.password_pri;
    if (!passwordPri) {
      console.error(`❌ [contingencyNode] No hay contraseña de llave privada`);
      return {
        status: 'failed',
        validationErrors: [`No hay contraseña de llave privada para firmar contingencia`]
      };
    }

    const jwsContingencia = await firmarDocumento({
      nit: nitEmisor,
      passwordPri: passwordPri,
      certificadoB64: credentials.certificado_b64,
      dteJson: dteLimpio,
    });

    console.log("💾 [contingencyNode] DTE Contingencia firmado y listo.");
    
    // Guardar documento en contingencia
    await saveDTEDocument({
      codigo_generacion: dteContingencia.identificacion.codigoGeneracion,
      tipo_dte: dteContingencia.identificacion.tipoDte,
      numero_control: dteContingencia.identificacion.numeroControl,
      estado: 'contingency',
      dte_json: dteContingencia,
      firma_jws: jwsContingencia,
      mh_response: undefined, // No hay respuesta de MH aún
      business_id: state.businessId!,
      issuer_nit: nitEmisor,
      clase_documento: 'emitido'
    });

    return {
      dte: dteContingencia,
      preparedDte: dteContingencia,
      signature: jwsContingencia,
      isOffline: true,
      status: 'completed', // Marcamos como completado para el usuario (tiene su DTE firmado)
      contingencyReason: state.contingencyReason,
      // Simulamos respuesta exitosa local
      mhResponse: {
        success: false,
        estado: 'CONTINGENCIA',
        mensaje: 'Documento en contingencia',
        fechaHoraRecepcion: new Date().toISOString()
      } as TransmisionResult
    };
  } catch (error: any) {
    console.error("❌ [contingencyNode] Error:", error);
    return {
      status: 'failed',
      validationErrors: [`Error generando contingencia: ${error.message}`]
    };
  }
};
