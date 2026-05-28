import { createInitialState } from "./tournamentLogic";
import type { TournamentState } from "./types";

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

export async function loadTournamentState(): Promise<TournamentState> {
  const fallback = createInitialState();

  try {
    const res = await fetch("/api/state");
    if (!res.ok) return fallback;
    const data = await res.json();
    if (!data.state) return fallback;
    const parsed = data.state as unknown;
    if (!isTournamentState(parsed)) return fallback;

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

export async function saveTournamentState(
  state: TournamentState,
  token: string | null,
): Promise<void> {
  if (!token) return;
  await fetch("/api/state", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(state),
  });
}

export function resetTournamentState(): TournamentState {
  return createInitialState();
}
