import { DTEState } from "../state";

export const diagExitNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🧪 DIAG exit node", {
    currentStep: state.currentStep,
    hasDte: !!state.dte,
    codigoGeneracion: state.dte?.identificacion?.codigoGeneracion,
  });

  return {
    currentStep: 'diag_exit',
    status: 'completed',
    progressPercentage: 100,
  };
};
