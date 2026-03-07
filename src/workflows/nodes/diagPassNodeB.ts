import { DTEState } from "../state";

export const diagPassNodeB = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🧪 DIAG pass node B", {
    currentStep: state.currentStep,
    hasDte: !!state.dte,
    codigoGeneracion: state.dte?.identificacion?.codigoGeneracion,
  });

  return {
    currentStep: 'diag_b',
    progressPercentage: 25,
  };
};
