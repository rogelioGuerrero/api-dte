import { dteGraph } from './dteWorkflow';
import { DTEState, INITIAL_STATE } from './state';
import { DTEData } from '../types/types';

export interface IngestionResult {
  successful: number;
  failed: number;
  errors: string[];
}

/**
 * Procesa un lote de DTEs utilizando el Agente LangGraph para actualizar los libros fiscales.
 * @param dtes Lista de objetos DTE (JSON)
 * @param passwordPri Contraseña de firma privada
 */
export const ingestDteBatch = async (
  dtes: { dte: DTEData; mode: 'ventas' | 'compras' }[],
  passwordPri: string
): Promise<IngestionResult> => {
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`🚀 Iniciando ingestión masiva de ${dtes.length} documentos con LangGraph...`);

  // Procesamos en serie para no saturar IndexedDB o el hilo principal
  for (const item of dtes) {
    try {
      const flowType = item.mode === 'ventas' ? 'emission' : 'reception';
      
      const initialState: DTEState = {
        ...INITIAL_STATE,
        dte: item.dte as any, 
        inputDte: item.dte as any,
        flowType: flowType,
        passwordPri: passwordPri, // Pasar contraseña al estado
        status: 'draft',
      };

      // Invoke returns the final state
      const finalState = await dteGraph.invoke(initialState as any);

      if (finalState.status === 'completed' || (finalState.taxImpact && Object.keys(finalState.taxImpact).length > 0)) {
        successful++;
      } else {
        failed++;
        const valErrors = (finalState.validationErrors || []) as string[];
        const errMsg = Array.isArray(valErrors) ? valErrors.join(', ') : 'Error desconocido en grafo';
        errors.push(`Doc ${item.dte.identificacion?.numeroControl || 'S/N'}: ${errMsg}`);
      }
    } catch (error: any) {
      failed++;
      errors.push(`Error crítico procesando Doc: ${error.message}`);
      console.error(error);
    }
  }

  console.log(`🏁 Ingestión finalizada. Éxitos: ${successful}, Fallos: ${failed}`);
  return { successful, failed, errors };
};
