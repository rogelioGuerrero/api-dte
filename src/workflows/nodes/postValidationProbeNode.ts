import { DTEState } from "../state";

export const postValidationProbeNode = async (state: DTEState): Promise<Partial<DTEState>> => {
  console.log("🧪 Post-validator probe: LangGraph sí ejecutó el nodo siguiente al validator");

  return {
    currentStep: 'post_validation_probe',
    progressPercentage: state.progressPercentage ?? 25,
  };
};
