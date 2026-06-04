export type PlayerStatus = "active" | "queued" | "eliminated";

export type MatchSide = "a" | "b";

export type LoserDecision = "loser" | "eliminate";

export interface Team {
  id: string;
  name: string;
  color: string;
  seedNodeId: string;
}

export interface Player {
  id: string;
  username: string;
  avatarUrl: string;
  initialTeamId: string;
  currentTeamId: string;
  status: PlayerStatus;
}

export interface BracketNodeDefinition {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  slotCount: number;
  section: "winner" | "loser" | "final";
  teamId?: string;
}

export interface NodeAssignment {
  playerIds: string[];
  color: string;
  label: string;
  teamId?: string;
}

export interface MatchDefinition {
  id: string;
  label: string;
  sideAId: string;
  sideBId: string;
  outputNodeId: string;
  advanceCount: number;
  recruitLimit: number;
  loserDestinationId?: string;
}

export interface MatchResult {
  matchId: string;
  winnerSide: MatchSide;
  recruitedPlayerIds: string[];
  loserDecisions: Record<string, LoserDecision>;
  completedAt: string;
}

export interface TournamentState {
  players: Record<string, Player>;
  teams: Record<string, Team>;
  nodes: Record<string, NodeAssignment>;
  results: Record<string, MatchResult>;
  loserQueue: string[];
}

export interface TournamentArchiveSummary {
  id: string;
  name: string;
  createdAt: string;
  playerCount: number;
  resultCount: number;
}

export interface TournamentArchive extends TournamentArchiveSummary {
  state: TournamentState;
}
