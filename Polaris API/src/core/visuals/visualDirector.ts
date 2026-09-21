import type { PersonaMode } from "../personality/personaEngine.js";

export type VisualState = "IDLE" | "LISTENING" | "THINKING" | "EXECUTING" | "SPEAKING" | "SUCCESS" | "WARNING" | "ERROR" | "OFFLINE";

export type PolarisVisualScene = {
  mode: PersonaMode;
  state: VisualState;
  depth: "flat" | "layered" | "3d";
  intensity: number;
  orbitSpeed: number;
  particleDensity: number;
  glow: number;
  accent: "cyan" | "violet" | "mint" | "amber" | "rose";
  motion: "still" | "slow" | "medium" | "fast";
  labels: string[];
};

export function buildVisualScene(mode: PersonaMode, state: VisualState): PolarisVisualScene {
  const accentByState: Record<VisualState, PolarisVisualScene["accent"]> = {
    IDLE: "cyan",
    LISTENING: "mint",
    THINKING: "violet",
    EXECUTING: "cyan",
    SPEAKING: "violet",
    SUCCESS: "mint",
    WARNING: "amber",
    ERROR: "rose",
    OFFLINE: "amber"
  };

  const motionByState: Record<VisualState, PolarisVisualScene["motion"]> = {
    IDLE: "slow",
    LISTENING: "medium",
    THINKING: "medium",
    EXECUTING: "fast",
    SPEAKING: "medium",
    SUCCESS: "medium",
    WARNING: "slow",
    ERROR: "slow",
    OFFLINE: "still"
  };

  const intensity = mode === "CREATIVE" || mode === "OPERATOR" ? 0.9 : mode === "CALM" ? 0.45 : 0.7;

  return {
    mode,
    state,
    depth: "3d",
    intensity,
    orbitSpeed: state === "OFFLINE" ? 0 : mode === "FOCUS" ? 0.35 : 0.65,
    particleDensity: mode === "CALM" ? 12 : mode === "CREATIVE" ? 42 : 26,
    glow: state === "ERROR" ? 0.85 : intensity,
    accent: accentByState[state],
    motion: motionByState[state],
    labels: [
      `modo:${mode.toLowerCase()}`,
      `estado:${state.toLowerCase()}`,
      "safe-runtime",
      "cross-device"
    ]
  };
}
