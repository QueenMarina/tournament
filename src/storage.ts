import { createInitialState } from "./tournamentLogic";
import type { TournamentState } from "./types";

const STORAGE_KEY = "minecraft-tournament-bracket-v1";

function isTournamentState(value: unknown): value is TournamentState {
  return Boolean(
    value &&
      typeof value === "object" &&
      "players" in value &&
      "teams" in value &&
      "nodes" in value &&
      "results" in value,
  );
}

export function loadTournamentState(): TournamentState {
  const fallback = createInitialState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isTournamentState(parsed)) {
      return fallback;
    }

    return {
      ...fallback,
      ...parsed,
      teams: { ...fallback.teams, ...parsed.teams },
      nodes: { ...fallback.nodes, ...parsed.nodes },
      results: parsed.results ?? {},
      loserQueue: parsed.loserQueue ?? [],
    };
  } catch {
    return fallback;
  }
}

export function saveTournamentState(state: TournamentState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetTournamentState(): TournamentState {
  localStorage.removeItem(STORAGE_KEY);
  return createInitialState();
}
