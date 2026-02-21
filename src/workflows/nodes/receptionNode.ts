import { DTEState } from "../state";

export const receptionNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("📥 Procesador de Recepción: Analizando documento recibido...");

  if (!state.dte) {
    // Intentar parsear rawInput si dte es nulo (caso de carga de JSON)
    if (state.rawInput) {
       try {
         // Aquí se podría agregar lógica para decodificar JWS si viene firmado
         // Por ahora asumimos que rawInput es el objeto DTE o un JSON string
         const dte = typeof state.rawInput === 'string' ? JSON.parse(state.rawInput) : state.rawInput;
         return {
           dte,
           isValid: true, // Asumimos válido si viene de otro emisor (o agregar validación firma)
           status: 'completed'
         };
       } catch (e) {
         return { status: 'failed', validationErrors: ["Error parseando JSON recibido"] };
       }
    }
    return { status: 'failed', validationErrors: ["No se proporcionó DTE de compra"] };
  }

  return {
    status: 'completed',
    isValid: true
  };
};
