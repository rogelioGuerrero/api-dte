import { DTEState } from "../state";
import { convertirAContingencia } from "../../dte/generator";
import { firmarDocumento, limpiarDteParaFirma } from "../../integrations/firmaClient";
import { processDTE } from "../../mh/process";
import { saveDTEDocument } from "../../dte/dteStorage";
import { TransmisionResult } from "../../types/types";

export const contingencyNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📦 Gestor Contingencia: Transformando a Modelo Diferido...");
  
  if (!state.dte || !state.passwordPri) return { status: 'failed' };

  try {
    // Transformar DTE a Contingencia
    const dteContingencia = convertirAContingencia(state.dte, state.contingencyReason);
    
    // Volver a procesar y firmar el DTE de contingencia
    const processed = processDTE(dteContingencia);
    const dteLimpio = limpiarDteParaFirma(processed.dte as unknown as Record<string, unknown>);
    const nitEmisor = (state.dte.emisor?.nit || '').toString().replace(/[\s-]/g, '').trim();

    const jwsContingencia = await firmarDocumento({
      nit: nitEmisor,
      passwordPri: state.passwordPri,
      dteJson: dteLimpio,
    });

    console.log("💾 DTE Contingencia firmado y listo.");
    
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
    return {
      status: 'failed',
      validationErrors: [`Error generando contingencia: ${error.message}`]
    };
  }
};
