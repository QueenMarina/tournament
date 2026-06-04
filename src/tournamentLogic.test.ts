import { describe, expect, it } from "vitest";
import { MATCHES } from "./bracketConfig";
import {
  addPlayerToTeamNode,
  applyMatchResult,
  createInitialState,
  createPlayer,
  resetBracketProgress,
} from "./tournamentLogic";
import type { TournamentState } from "./types";

function avatar(username: string): string {
  return `https://mc-heads.net/avatar/${username}/64/nohelm.png`;
}

function addPlayer(state: TournamentState, username: string, teamId: string): TournamentState {
  const result = addPlayerToTeamNode(state, createPlayer(username, teamId, avatar(username)));
  if (!result.ok || !result.value) {
    throw new Error(result.error);
  }
  return result.value;
}

describe("applyMatchResult", () => {
  it("advances a 2v2 winner with one recruited opponent", () => {
    let state = createInitialState();
    state = addPlayer(state, "Alpha", "team-1");
    state = addPlayer(state, "Bravo", "team-1");
    state = addPlayer(state, "Charlie", "team-2");
    state = addPlayer(state, "Delta", "team-2");

    const match = MATCHES.find((candidate) => candidate.id === "w1")!;
    const recruitedId = Object.values(state.players).find((player) => player.username === "Charlie")!.id;
    const eliminatedId = Object.values(state.players).find((player) => player.username === "Delta")!.id;
    const result = applyMatchResult(state, match, {
      winnerSide: "a",
      recruitedPlayerIds: [recruitedId],
      loserDecisions: { [eliminatedId]: "eliminate" },
    });

    expect(result.ok).toBe(true);
    expect(result.value!.nodes["wb-r2-a"].playerIds).toHaveLength(3);
    expect(result.value!.nodes["wb-r2-a"].playerIds).toContain(recruitedId);
    expect(result.value!.players[eliminatedId].status).toBe("eliminated");
  });

  it("advances a 3v3 winner with one recruited opponent", () => {
    let state = createInitialState();
    const playerNames = ["A1", "A2", "A3", "B1", "B2", "B3"];
    playerNames.forEach((name, index) => {
      state.players[name] = {
        id: name,
        username: name,
        avatarUrl: avatar(name),
        initialTeamId: index < 3 ? "team-1" : "team-2",
        currentTeamId: index < 3 ? "team-1" : "team-2",
        status: "active",
      };
    });
    state.nodes["wb-r2-a"] = { ...state.nodes["wb-r2-a"], playerIds: ["A1", "A2", "A3"], teamId: "team-1" };
    state.nodes["wb-r2-b"] = { ...state.nodes["wb-r2-b"], playerIds: ["B1", "B2", "B3"], teamId: "team-2" };

    const match = MATCHES.find((candidate) => candidate.id === "w5")!;
    const result = applyMatchResult(state, match, {
      winnerSide: "b",
      recruitedPlayerIds: ["A1"],
      loserDecisions: { A2: "eliminate", A3: "eliminate" },
    });

    expect(result.ok).toBe(true);
    expect(result.value!.nodes["wb-r3-a"].playerIds).toEqual(["B1", "B2", "B3", "A1"]);
    expect(result.value!.players.A1.currentTeamId).toBe("team-2");
  });

  it("routes w5 and w6 losers to the crossed lower-bracket round 2 nodes", () => {
    let state = createInitialState();
    const playerNames = [
      "A1",
      "A2",
      "A3",
      "B1",
      "B2",
      "B3",
      "C1",
      "C2",
      "C3",
      "D1",
      "D2",
      "D3",
    ];

    playerNames.forEach((name, index) => {
      const teamNumber = Math.floor(index / 3) + 1;
      state.players[name] = {
        id: name,
        username: name,
        avatarUrl: avatar(name),
        initialTeamId: `team-${teamNumber}`,
        currentTeamId: `team-${teamNumber}`,
        status: "active",
      };
    });
    state.nodes["wb-r2-a"] = { ...state.nodes["wb-r2-a"], playerIds: ["A1", "A2", "A3"], teamId: "team-1" };
    state.nodes["wb-r2-b"] = { ...state.nodes["wb-r2-b"], playerIds: ["B1", "B2", "B3"], teamId: "team-2" };
    state.nodes["wb-r2-c"] = { ...state.nodes["wb-r2-c"], playerIds: ["C1", "C2", "C3"], teamId: "team-3" };
    state.nodes["wb-r2-d"] = { ...state.nodes["wb-r2-d"], playerIds: ["D1", "D2", "D3"], teamId: "team-4" };

    const w5 = MATCHES.find((candidate) => candidate.id === "w5")!;
    const w5Result = applyMatchResult(state, w5, {
      winnerSide: "a",
      recruitedPlayerIds: ["B1"],
      loserDecisions: { B2: "loser", B3: "loser" },
    });

    expect(w5Result.ok).toBe(true);
    state = w5Result.value!;
    expect(state.nodes["lb-r2-c"].playerIds).toEqual(["B2", "B3"]);
    expect(state.nodes["lb-r2-a"].playerIds).toEqual([]);

    const w6 = MATCHES.find((candidate) => candidate.id === "w6")!;
    const w6Result = applyMatchResult(state, w6, {
      winnerSide: "a",
      recruitedPlayerIds: ["D1"],
      loserDecisions: { D2: "loser", D3: "loser" },
    });

    expect(w6Result.ok).toBe(true);
    expect(w6Result.value!.nodes["lb-r2-a"].playerIds).toEqual(["D2", "D3"]);
    expect(w6Result.value!.nodes["lb-r2-c"].playerIds).toEqual(["B2", "B3"]);
  });

  it("rejects missing unchosen defeated-player decisions", () => {
    let state = createInitialState();
    state = addPlayer(state, "Alpha", "team-1");
    state = addPlayer(state, "Bravo", "team-1");
    state = addPlayer(state, "Charlie", "team-2");
    state = addPlayer(state, "Delta", "team-2");

    const match = MATCHES.find((candidate) => candidate.id === "w1")!;
    const recruitedId = Object.values(state.players).find((player) => player.username === "Charlie")!.id;
    const result = applyMatchResult(state, match, {
      winnerSide: "a",
      recruitedPlayerIds: [recruitedId],
      loserDecisions: {},
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Every unchosen");
  });

  it("rejects an invalid recruit count", () => {
    let state = createInitialState();
    state = addPlayer(state, "Alpha", "team-1");
    state = addPlayer(state, "Bravo", "team-1");
    state = addPlayer(state, "Charlie", "team-2");
    state = addPlayer(state, "Delta", "team-2");

    const match = MATCHES.find((candidate) => candidate.id === "w1")!;
    const result = applyMatchResult(state, match, {
      winnerSide: "a",
      recruitedPlayerIds: [],
      loserDecisions: {},
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("requires 1 recruited");
  });

  it("automatically pairs first-round loser drops instead of requiring fake 1v1 matches", () => {
    let state = createInitialState();
    state = addPlayer(state, "Alpha", "team-1");
    state = addPlayer(state, "Bravo", "team-1");
    state = addPlayer(state, "Charlie", "team-2");
    state = addPlayer(state, "Delta", "team-2");
    state = addPlayer(state, "Echo", "team-3");
    state = addPlayer(state, "Foxtrot", "team-3");
    state = addPlayer(state, "Golf", "team-4");
    state = addPlayer(state, "Hotel", "team-4");

    expect(MATCHES.some((match) => match.id === "l1" || match.id === "l2")).toBe(false);

    const w1 = MATCHES.find((candidate) => candidate.id === "w1")!;
    const charlieId = Object.values(state.players).find((player) => player.username === "Charlie")!.id;
    const deltaId = Object.values(state.players).find((player) => player.username === "Delta")!.id;
    const firstResult = applyMatchResult(state, w1, {
      winnerSide: "a",
      recruitedPlayerIds: [charlieId],
      loserDecisions: { [deltaId]: "loser" },
    });

    expect(firstResult.ok).toBe(true);
    state = firstResult.value!;
    expect(state.nodes["lb-drop-a"].playerIds).toEqual([deltaId]);
    expect(state.nodes["lb-r2-b"].playerIds).toEqual([]);

    const w2 = MATCHES.find((candidate) => candidate.id === "w2")!;
    const golfId = Object.values(state.players).find((player) => player.username === "Golf")!.id;
    const hotelId = Object.values(state.players).find((player) => player.username === "Hotel")!.id;
    const secondResult = applyMatchResult(state, w2, {
      winnerSide: "a",
      recruitedPlayerIds: [golfId],
      loserDecisions: { [hotelId]: "loser" },
    });

    expect(secondResult.ok).toBe(true);
    expect(secondResult.value!.nodes["lb-drop-b"].playerIds).toEqual([hotelId]);
    expect(secondResult.value!.nodes["lb-r2-b"].playerIds).toEqual([deltaId, hotelId]);
    expect(secondResult.value!.nodes["lb-r2-b"].teamId).toBe("pair-lb-ab");
    expect(secondResult.value!.players[deltaId].status).toBe("active");
    expect(secondResult.value!.players[hotelId].status).toBe("active");
  });

  it("resets bracket progress while keeping roster and team colors", () => {
    let state = createInitialState();
    state.teams["team-1"] = { ...state.teams["team-1"], color: "#123456" };
    state.nodes["seed-1"] = { ...state.nodes["seed-1"], color: "#123456" };
    state = addPlayer(state, "Alpha", "team-1");
    state = addPlayer(state, "Bravo", "team-1");
    state = addPlayer(state, "Charlie", "team-2");
    state = addPlayer(state, "Delta", "team-2");

    const match = MATCHES.find((candidate) => candidate.id === "w1")!;
    const charlieId = Object.values(state.players).find((player) => player.username === "Charlie")!.id;
    const deltaId = Object.values(state.players).find((player) => player.username === "Delta")!.id;
    const result = applyMatchResult(state, match, {
      winnerSide: "a",
      recruitedPlayerIds: [charlieId],
      loserDecisions: { [deltaId]: "eliminate" },
    });

    expect(result.ok).toBe(true);
    const reset = resetBracketProgress(result.value!);

    expect(Object.keys(reset.players)).toHaveLength(4);
    expect(reset.players[deltaId].status).toBe("active");
    expect(reset.results).toEqual({});
    expect(reset.loserQueue).toEqual([]);
    expect(reset.nodes["wb-r2-a"].playerIds).toEqual([]);
    expect(reset.nodes["seed-1"].playerIds).toHaveLength(2);
    expect(reset.nodes["seed-1"].color).toBe("#123456");
  });
});
