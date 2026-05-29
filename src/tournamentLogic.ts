import { BRACKET_NODES, DEFAULT_TEAMS, LOSER_PAIRINGS } from "./bracketConfig";
import type {
  BracketNodeDefinition,
  LoserDecision,
  MatchDefinition,
  MatchResult,
  MatchSide,
  NodeAssignment,
  Player,
  PlayerStatus,
  Team,
  TournamentState,
} from "./types";

export interface ApplyMatchPayload {
  winnerSide: MatchSide;
  recruitedPlayerIds: string[];
  loserDecisions: Record<string, LoserDecision>;
}

export interface LogicResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

export const bracketNodeById = new Map(BRACKET_NODES.map((node) => [node.id, node]));

export function createInitialState(): TournamentState {
  const teams = Object.fromEntries(DEFAULT_TEAMS.map((team) => [team.id, team]));
  const nodes = Object.fromEntries(
    BRACKET_NODES.map((node) => [
      node.id,
      {
        playerIds: [],
        color: node.teamId ? teams[node.teamId].color : "#8792a8",
        label: node.label,
        teamId: node.teamId,
      } satisfies NodeAssignment,
    ]),
  );

  return {
    players: {},
    teams,
    nodes,
    results: {},
    loserQueue: [],
  };
}

export function createPlayer(username: string, teamId: string, avatarUrl: string): Player {
  const normalized = username.trim();
  return {
    id: `${normalized.toLowerCase()}-${crypto.randomUUID()}`,
    username: normalized,
    avatarUrl,
    initialTeamId: teamId,
    currentTeamId: teamId,
    status: "active",
  };
}

export function getNodeDefinition(nodeId: string): BracketNodeDefinition {
  const node = bracketNodeById.get(nodeId);
  if (!node) {
    throw new Error(`Unknown bracket node: ${nodeId}`);
  }
  return node;
}

export function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

export function removePlayerFromCollections(state: TournamentState, playerId: string): TournamentState {
  const nodes = Object.fromEntries(
    Object.entries(state.nodes).map(([nodeId, assignment]) => [
      nodeId,
      { ...assignment, playerIds: assignment.playerIds.filter((id) => id !== playerId) },
    ]),
  );

  return {
    ...state,
    nodes,
    loserQueue: state.loserQueue.filter((id) => id !== playerId),
  };
}

function withAutomaticLoserPairings(state: TournamentState): TournamentState {
  let nodes = state.nodes;
  const players = { ...state.players };

  for (const pairing of LOSER_PAIRINGS) {
    const sourceAssignments = pairing.sourceNodeIds.map((nodeId) => nodes[nodeId]);
    const sourcePlayerIds = sourceAssignments.flatMap((assignment) => assignment?.playerIds ?? []);
    const sourceDefinitions = pairing.sourceNodeIds.map((nodeId) => getNodeDefinition(nodeId));
    const sourceSlotsFilled = sourceAssignments.every((assignment, index) => {
      const definition = sourceDefinitions[index];
      return assignment && assignment.playerIds.length === definition.slotCount;
    });

    const output = nodes[pairing.outputNodeId];
    const outputDefinition = getNodeDefinition(pairing.outputNodeId);
    const isAutomaticOutput = output.teamId === pairing.id || output.playerIds.length === 0;

    if (!sourceSlotsFilled) {
      if (output.teamId === pairing.id) {
        nodes = {
          ...nodes,
          [pairing.outputNodeId]: {
            ...output,
            playerIds: [],
            teamId: undefined,
          },
        };
      }
      continue;
    }

    const pairedPlayerIds = uniqueIds(sourcePlayerIds).slice(0, outputDefinition.slotCount);
    if (pairedPlayerIds.length !== outputDefinition.slotCount || !isAutomaticOutput) {
      continue;
    }

    const firstSource = sourceAssignments[0];
    for (const playerId of pairedPlayerIds) {
      if (players[playerId] && players[playerId].status !== "eliminated") {
        players[playerId] = { ...players[playerId], status: "active" };
      }
    }

    nodes = {
      ...nodes,
      [pairing.outputNodeId]: {
        ...output,
        playerIds: pairedPlayerIds,
        color: firstSource.color,
        teamId: pairing.id,
      },
    };
  }

  return {
    ...state,
    players,
    nodes,
    loserQueue: state.loserQueue.filter((playerId) =>
      Object.values(nodes).every((assignment) => !assignment.playerIds.includes(playerId)),
    ),
  };
}

export function setNodePlayers(
  state: TournamentState,
  nodeId: string,
  playerIds: string[],
  color?: string,
  teamId?: string | null,
): LogicResult<TournamentState> {
  const node = getNodeDefinition(nodeId);
  const normalizedIds = uniqueIds(playerIds).filter((playerId) => Boolean(state.players[playerId]));

  if (normalizedIds.length > node.slotCount) {
    return { ok: false, error: `${node.label} only has ${node.slotCount} slots.` };
  }

  const players = { ...state.players };
  for (const playerId of normalizedIds) {
    const player = players[playerId];
    players[playerId] = {
      ...player,
      status: "active",
      currentTeamId: teamId ?? player.currentTeamId,
    };
  }

  return {
    ok: true,
    value: withAutomaticLoserPairings({
      ...state,
      players,
      loserQueue: state.loserQueue.filter((playerId) => !normalizedIds.includes(playerId)),
      nodes: {
        ...state.nodes,
        [nodeId]: {
          ...state.nodes[nodeId],
          playerIds: normalizedIds,
          color: color ?? state.nodes[nodeId].color,
          teamId: teamId === undefined ? state.nodes[nodeId].teamId : teamId ?? undefined,
        },
      },
    }),
  };
}

export function addPlayerToTeamNode(state: TournamentState, player: Player): LogicResult<TournamentState> {
  const team = state.teams[player.initialTeamId];
  if (!team) {
    return { ok: false, error: "Choose a valid team." };
  }

  const currentNode = state.nodes[team.seedNodeId];
  const nextIds = uniqueIds([...currentNode.playerIds, player.id]);
  const node = getNodeDefinition(team.seedNodeId);

  if (nextIds.length > node.slotCount) {
    return { ok: false, error: `${team.name} already has ${node.slotCount} players.` };
  }

  return {
    ok: true,
    value: {
      ...state,
      players: {
        ...state.players,
        [player.id]: player,
      },
      nodes: {
        ...state.nodes,
        [team.seedNodeId]: {
          ...currentNode,
          playerIds: nextIds,
          color: team.color,
          teamId: team.id,
        },
      },
    },
  };
}

export function resetBracketProgress(state: TournamentState): TournamentState {
  const fresh = createInitialState();
  const fallbackTeamId = Object.keys(state.teams)[0] ?? "";
  const players: Record<string, Player> = Object.fromEntries(
    Object.entries(state.players).map(([playerId, player]): [string, Player] => {
      const initialTeamId = state.teams[player.initialTeamId] ? player.initialTeamId : fallbackTeamId;
      return [
        playerId,
        {
          ...player,
          initialTeamId,
          currentTeamId: initialTeamId,
          status: "active",
        },
      ];
    }),
  );
  const nodes = Object.fromEntries(
    Object.entries(fresh.nodes).map(([nodeId, assignment]) => {
      const node = getNodeDefinition(nodeId);
      if (!node.teamId || !state.teams[node.teamId]) {
        return [nodeId, assignment];
      }

      const team = state.teams[node.teamId];
      return [
        nodeId,
        {
          ...assignment,
          color: team.color,
          teamId: team.id,
        },
      ];
    }),
  );

  const next: TournamentState = {
    ...fresh,
    players,
    teams: state.teams,
    nodes,
    results: {},
    loserQueue: [],
  };

  const orderedPlayerIds: string[] = [];
  const orderedSet = new Set<string>();
  for (const team of Object.values(state.teams)) {
    const seedPlayerIds = state.nodes[team.seedNodeId]?.playerIds ?? [];
    for (const playerId of seedPlayerIds) {
      if (players[playerId] && !orderedSet.has(playerId)) {
        orderedPlayerIds.push(playerId);
        orderedSet.add(playerId);
      }
    }
  }

  const leftoverPlayerIds = Object.values(players)
    .filter((player) => !orderedSet.has(player.id))
    .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }))
    .map((player) => player.id);

  for (const playerId of [...orderedPlayerIds, ...leftoverPlayerIds]) {
    const player = players[playerId];
    const team = next.teams[player.initialTeamId];
    if (!team) {
      continue;
    }

    const node = next.nodes[team.seedNodeId];
    const nodeDefinition = getNodeDefinition(team.seedNodeId);
    if (!node || node.playerIds.length >= nodeDefinition.slotCount) {
      continue;
    }

    next.nodes[team.seedNodeId] = {
      ...node,
      playerIds: [...node.playerIds, player.id],
      color: team.color,
      teamId: team.id,
    };
  }

  return next;
}

export function updateTeam(state: TournamentState, team: Team): TournamentState {
  const previous = state.teams[team.id];
  const nodes = { ...state.nodes };

  if (previous) {
    for (const [nodeId, assignment] of Object.entries(nodes)) {
      if (assignment.teamId === team.id) {
        nodes[nodeId] = { ...assignment, color: team.color };
      }
    }
  }

  return withAutomaticLoserPairings({
    ...state,
    teams: {
      ...state.teams,
      [team.id]: team,
    },
    nodes,
  });
}

export function movePlayerToTeam(state: TournamentState, playerId: string, nextTeamId: string): LogicResult<TournamentState> {
  const player = state.players[playerId];
  const team = state.teams[nextTeamId];

  if (!player || !team) {
    return { ok: false, error: "Player or team was not found." };
  }

  const removed = removePlayerFromCollections(state, playerId);
  const movedPlayer: Player = {
    ...player,
    initialTeamId: nextTeamId,
    currentTeamId: nextTeamId,
    status: "active",
  };

  const result = addPlayerToTeamNode(
    {
      ...removed,
      players: {
        ...removed.players,
        [playerId]: movedPlayer,
      },
    },
    movedPlayer,
  );

  return result.ok && result.value
    ? { ok: true, value: withAutomaticLoserPairings(result.value) }
    : result;
}

export function deletePlayer(state: TournamentState, playerId: string): TournamentState {
  const next = removePlayerFromCollections(state, playerId);
  const players = { ...next.players };
  delete players[playerId];

  const results = Object.fromEntries(
    Object.entries(next.results).map(([resultId, result]) => [
      resultId,
      {
        ...result,
        recruitedPlayerIds: result.recruitedPlayerIds.filter((id) => id !== playerId),
        loserDecisions: Object.fromEntries(
          Object.entries(result.loserDecisions).filter(([id]) => id !== playerId),
        ),
      },
    ]),
  );

  return withAutomaticLoserPairings({ ...next, players, results });
}

export function applyMatchResult(
  state: TournamentState,
  match: MatchDefinition,
  payload: ApplyMatchPayload,
): LogicResult<TournamentState> {
  const sideANode = state.nodes[match.sideAId];
  const sideBNode = state.nodes[match.sideBId];
  const outputNode = getNodeDefinition(match.outputNodeId);

  if (!sideANode || !sideBNode) {
    return { ok: false, error: "Both sides must exist before resolving a match." };
  }

  const winnerNode = payload.winnerSide === "a" ? sideANode : sideBNode;
  const loserNode = payload.winnerSide === "a" ? sideBNode : sideANode;
  const winnerPlayerIds = winnerNode.playerIds.filter((id) => Boolean(state.players[id]));
  const loserPlayerIds = loserNode.playerIds.filter((id) => Boolean(state.players[id]));
  const recruitedIds = uniqueIds(payload.recruitedPlayerIds);

  if (winnerPlayerIds.length === 0 || loserPlayerIds.length === 0) {
    return { ok: false, error: "Both sides need players before resolving the match." };
  }

  for (const playerId of recruitedIds) {
    if (!loserPlayerIds.includes(playerId)) {
      return { ok: false, error: "Recruited players must come from the defeated side." };
    }
  }

  if (recruitedIds.length > match.recruitLimit) {
    return { ok: false, error: `${match.label} can recruit at most ${match.recruitLimit} player(s).` };
  }

  const requiredRecruitCount = Math.max(0, Math.min(match.recruitLimit, match.advanceCount - winnerPlayerIds.length));
  if (recruitedIds.length !== requiredRecruitCount) {
    return {
      ok: false,
      error: `${match.label} requires ${requiredRecruitCount} recruited player(s) for this result.`,
    };
  }

  const advancingIds = uniqueIds([...winnerPlayerIds, ...recruitedIds]);
  if (advancingIds.length > match.advanceCount || advancingIds.length > outputNode.slotCount) {
    return { ok: false, error: `${match.label} sends too many players to ${outputNode.label}.` };
  }

  const unchosenLoserIds = loserPlayerIds.filter((id) => !recruitedIds.includes(id));
  for (const playerId of unchosenLoserIds) {
    if (!payload.loserDecisions[playerId]) {
      return { ok: false, error: "Every unchosen defeated player needs a loser/eliminate decision." };
    }
  }

  const players = { ...state.players };
  const outputTeamId = winnerNode.teamId;
  for (const playerId of advancingIds) {
    const player = players[playerId];
    players[playerId] = {
      ...player,
      status: "active",
      currentTeamId: outputTeamId ?? player.currentTeamId,
    };
  }

  const nodes = {
    ...state.nodes,
    [match.outputNodeId]: {
      ...state.nodes[match.outputNodeId],
      playerIds: advancingIds,
      color: winnerNode.color,
      label: state.nodes[match.outputNodeId].label,
      teamId: outputTeamId,
    },
  };

  let loserQueue = state.loserQueue.filter((playerId) => !advancingIds.includes(playerId));

  for (const playerId of unchosenLoserIds) {
    const decision = payload.loserDecisions[playerId];
    if (decision === "eliminate" || !match.loserDestinationId) {
      players[playerId] = { ...players[playerId], status: "eliminated" };
      loserQueue = loserQueue.filter((queuedId) => queuedId !== playerId);
      continue;
    }

    players[playerId] = { ...players[playerId], status: "queued" };

    const destination = nodes[match.loserDestinationId];
    const destinationDefinition = getNodeDefinition(match.loserDestinationId);
    const nextDestinationIds = uniqueIds([...destination.playerIds, playerId]);

    if (nextDestinationIds.length > destinationDefinition.slotCount) {
      return {
        ok: false,
        error: `${destinationDefinition.label} is full. Move players manually or choose elimination.`,
      };
    }

    nodes[match.loserDestinationId] = {
      ...destination,
      playerIds: nextDestinationIds,
      color: destination.playerIds.length === 0 ? loserNode.color : destination.color,
      teamId: destination.teamId ?? loserNode.teamId,
    };
    loserQueue = loserQueue.filter((queuedId) => queuedId !== playerId);
  }

  const result: MatchResult = {
    matchId: match.id,
    winnerSide: payload.winnerSide,
    recruitedPlayerIds: recruitedIds,
    loserDecisions: Object.fromEntries(unchosenLoserIds.map((id) => [id, payload.loserDecisions[id]])),
    completedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    value: withAutomaticLoserPairings({
      ...state,
      players,
      nodes,
      loserQueue,
      results: {
        ...state.results,
        [match.id]: result,
      },
    }),
  };
}

export function getRosterCounts(state: TournamentState): Record<PlayerStatus, number> {
  return Object.values(state.players).reduce(
    (counts, player) => {
      counts[player.status] += 1;
      return counts;
    },
    { active: 0, queued: 0, eliminated: 0 },
  );
}
