import type { TriageStep } from "../../types/triage";

type SimulationConfig = Partial<Record<TriageStep, "timeout">>;

let current: SimulationConfig = {};

export function setSimulation(config: SimulationConfig | undefined): void {
  current = { ...(config || {}) };
}

export function consumeSimulation(step: TriageStep): "timeout" | undefined {
  return current[step];
}
