import { createInitialState } from "./tournamentLogic";
import type { TournamentArchive, TournamentArchiveSummary, TournamentState } from "./types";

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

function normalizeTournamentState(parsed: TournamentState): TournamentState {
  const fallback = createInitialState();

  return {
    ...fallback,
    ...parsed,
    players: parsed.players ?? fallback.players,
    teams: { ...fallback.teams, ...parsed.teams },
    nodes: { ...fallback.nodes, ...parsed.nodes },
    results: parsed.results ?? {},
    loserQueue: parsed.loserQueue ?? [],
  };
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

    return normalizeTournamentState(parsed);
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

export async function loadTournamentArchives(): Promise<TournamentArchiveSummary[]> {
  try {
    const res = await fetch("/api/archives");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.archives) ? data.archives : [];
  } catch {
    return [];
  }
}

export async function loadTournamentArchive(archiveId: string): Promise<TournamentArchive | null> {
  try {
    const res = await fetch(`/api/archives/${encodeURIComponent(archiveId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const archive = data.archive as TournamentArchive | undefined;
    if (!archive || !isTournamentState(archive.state)) return null;

    return {
      ...archive,
      state: normalizeTournamentState(archive.state),
    };
  } catch {
    return null;
  }
}

export async function saveTournamentArchive(
  name: string,
  state: TournamentState,
  token: string | null,
): Promise<TournamentArchiveSummary> {
  if (!token) {
    throw new Error("Admin login required.");
  }

  const res = await fetch("/api/archives", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, state }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Could not save archive.");
  }

  return data.archive as TournamentArchiveSummary;
}
