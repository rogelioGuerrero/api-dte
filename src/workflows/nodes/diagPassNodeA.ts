import { DTEState } from "../state";

export const diagPassNodeA = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🧪 DIAG pass node A", {
    currentStep: state.currentStep,
    hasDte: !!state.dte,
    codigoGeneracion: state.dte?.identificacion?.codigoGeneracion,
  });

  return {
    currentStep: 'diag_a',
    progressPercentage: 15,
  };
};
