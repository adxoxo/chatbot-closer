import type { ScoringWeights } from "./types";

/**
 * Maximum achievable weighted score for a tenant (every signal at 2).
 * Mirrors backend `scoring_engine.max_score`. With the default weights this is
 * 16, not the 18 the UI used to hardcode (SC-8).
 */
export function maxScore(w?: ScoringWeights): number {
  if (!w) return 16;
  return (w.weight_bl + w.weight_bs + w.weight_pc + w.weight_u + w.weight_da) * 2;
}
