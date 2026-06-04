import { createInitialState } from "./tournamentLogic";
import type { TournamentArchive, TournamentArchiveSummary, TournamentState } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isTournamentState(value: unknown): value is TournamentState {
  return Boolean(
    isRecord(value) &&
      isRecord(value.players) &&
      isRecord(value.teams) &&
      isRecord(value.nodes) &&
      isRecord(value.results),
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

function isArchiveSummary(value: unknown): value is TournamentArchiveSummary {
  return Boolean(
    isRecord(value) &&
      typeof value.id === "string" &&
      typeof value.name === "string" &&
      typeof value.createdAt === "string" &&
      typeof value.playerCount === "number" &&
      typeof value.resultCount === "number",
  );
}

function isJsonResponse(res: Response): boolean {
  return res.headers.get("content-type")?.includes("application/json") ?? false;
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
    if (!res.ok || !isJsonResponse(res)) return [];
    const data = await res.json();
    return Array.isArray(data.archives) ? data.archives.filter(isArchiveSummary) : [];
  } catch {
    return [];
  }
}

export async function loadTournamentArchive(archiveId: string): Promise<TournamentArchive | null> {
  try {
    const res = await fetch(`/api/archives/${encodeURIComponent(archiveId)}`);
    if (!res.ok || !isJsonResponse(res)) return null;
    const data = await res.json();
    const archive = data.archive as TournamentArchive | undefined;
    if (!isArchiveSummary(archive) || !isTournamentState(archive.state)) return null;

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

  if (!isJsonResponse(res)) {
    throw new Error("Archive API is not available. Deploy the updated server.js too.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Could not save archive.");
  }

  if (!isArchiveSummary(data.archive)) {
    throw new Error("Archive save response was invalid.");
  }

  return data.archive;
}
