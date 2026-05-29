import type { BracketNodeDefinition, MatchDefinition, Team } from "./types";

export const CANVAS_WIDTH = 2220;
export const CANVAS_HEIGHT = 1418;

export const DEFAULT_TEAMS: Team[] = [
  { id: "team-1", name: "Team 1", color: "#e84f5f", seedNodeId: "seed-1" },
  { id: "team-2", name: "Team 2", color: "#ff8a4c", seedNodeId: "seed-2" },
  { id: "team-3", name: "Team 3", color: "#f5ce4d", seedNodeId: "seed-3" },
  { id: "team-4", name: "Team 4", color: "#5bd17b", seedNodeId: "seed-4" },
  { id: "team-5", name: "Team 5", color: "#4fc3f7", seedNodeId: "seed-5" },
  { id: "team-6", name: "Team 6", color: "#6c8cff", seedNodeId: "seed-6" },
  { id: "team-7", name: "Team 7", color: "#b65cff", seedNodeId: "seed-7" },
  { id: "team-8", name: "Team 8", color: "#ff6fcf", seedNodeId: "seed-8" },
];

export const BRACKET_NODES: BracketNodeDefinition[] = [
  { id: "seed-1", label: "Seed 1", x: 55, y: 93, width: 205, height: 52, slotCount: 2, section: "winner", teamId: "team-1" },
  { id: "seed-2", label: "Seed 2", x: 55, y: 162, width: 205, height: 52, slotCount: 2, section: "winner", teamId: "team-2" },
  { id: "seed-3", label: "Seed 3", x: 54, y: 255, width: 206, height: 52, slotCount: 2, section: "winner", teamId: "team-3" },
  { id: "seed-4", label: "Seed 4", x: 55, y: 325, width: 205, height: 52, slotCount: 2, section: "winner", teamId: "team-4" },
  { id: "seed-5", label: "Seed 5", x: 55, y: 432, width: 205, height: 52, slotCount: 2, section: "winner", teamId: "team-5" },
  { id: "seed-6", label: "Seed 6", x: 54, y: 501, width: 206, height: 52, slotCount: 2, section: "winner", teamId: "team-6" },
  { id: "seed-7", label: "Seed 7", x: 55, y: 594, width: 205, height: 52, slotCount: 2, section: "winner", teamId: "team-7" },
  { id: "seed-8", label: "Seed 8", x: 55, y: 664, width: 205, height: 52, slotCount: 2, section: "winner", teamId: "team-8" },

  { id: "wb-r2-a", label: "WB R2 A", x: 444, y: 116, width: 205, height: 76, slotCount: 3, section: "winner" },
  { id: "wb-r2-b", label: "WB R2 B", x: 443, y: 278, width: 206, height: 76, slotCount: 3, section: "winner" },
  { id: "wb-r2-c", label: "WB R2 C", x: 444, y: 455, width: 206, height: 77, slotCount: 3, section: "winner" },
  { id: "wb-r2-d", label: "WB R2 D", x: 444, y: 617, width: 205, height: 76, slotCount: 3, section: "winner" },
  { id: "wb-r3-a", label: "WB R3 A", x: 829, y: 184, width: 205, height: 101, slotCount: 4, section: "winner" },
  { id: "wb-r3-b", label: "WB R3 B", x: 829, y: 523, width: 205, height: 101, slotCount: 4, section: "winner" },
  { id: "wb-finalist", label: "Winner Finalist", x: 1601, y: 354, width: 205, height: 101, slotCount: 4, section: "winner" },

  { id: "lb-drop-a", label: "LB Drop A", x: 55, y: 1042, width: 205, height: 26, slotCount: 1, section: "loser" },
  { id: "lb-drop-b", label: "LB Drop B", x: 55, y: 1111, width: 205, height: 26, slotCount: 1, section: "loser" },
  { id: "lb-drop-c", label: "LB Drop C", x: 55, y: 1252, width: 205, height: 27, slotCount: 1, section: "loser" },
  { id: "lb-drop-d", label: "LB Drop D", x: 55, y: 1322, width: 205, height: 28, slotCount: 1, section: "loser" },
  { id: "lb-r2-a", label: "LB R2 A", x: 444, y: 954, width: 205, height: 52, slotCount: 2, section: "loser" },
  { id: "lb-r2-b", label: "LB R2 B", x: 444, y: 1064, width: 205, height: 52, slotCount: 2, section: "loser" },
  { id: "lb-r2-c", label: "LB R2 C", x: 444, y: 1164, width: 205, height: 52, slotCount: 2, section: "loser" },
  { id: "lb-r2-d", label: "LB R2 D", x: 444, y: 1274, width: 205, height: 52, slotCount: 2, section: "loser" },
  { id: "lb-r3-a", label: "LB R3 A", x: 829, y: 996, width: 206, height: 78, slotCount: 3, section: "loser" },
  { id: "lb-r3-b", label: "LB R3 B", x: 828, y: 1206, width: 207, height: 78, slotCount: 3, section: "loser" },
  { id: "lb-r4-a", label: "LB R4 A", x: 1213, y: 925, width: 206, height: 101, slotCount: 4, section: "loser" },
  { id: "lb-r4-b", label: "LB R4 B", x: 1214, y: 1088, width: 205, height: 101, slotCount: 4, section: "loser" },
  { id: "lb-finalist", label: "Loser Finalist", x: 1601, y: 1008, width: 205, height: 101, slotCount: 4, section: "loser" },

  { id: "champion", label: "Champion", x: 1986, y: 690, width: 178, height: 112, slotCount: 4, section: "final" },
];

export const MATCHES: MatchDefinition[] = [
  { id: "w1", label: "W1", sideAId: "seed-1", sideBId: "seed-2", outputNodeId: "wb-r2-a", advanceCount: 3, recruitLimit: 1, loserDestinationId: "lb-drop-a" },
  { id: "w2", label: "W2", sideAId: "seed-3", sideBId: "seed-4", outputNodeId: "wb-r2-b", advanceCount: 3, recruitLimit: 1, loserDestinationId: "lb-drop-b" },
  { id: "w3", label: "W3", sideAId: "seed-5", sideBId: "seed-6", outputNodeId: "wb-r2-c", advanceCount: 3, recruitLimit: 1, loserDestinationId: "lb-drop-c" },
  { id: "w4", label: "W4", sideAId: "seed-7", sideBId: "seed-8", outputNodeId: "wb-r2-d", advanceCount: 3, recruitLimit: 1, loserDestinationId: "lb-drop-d" },
  { id: "w5", label: "W5", sideAId: "wb-r2-a", sideBId: "wb-r2-b", outputNodeId: "wb-r3-a", advanceCount: 4, recruitLimit: 1, loserDestinationId: "lb-r2-a" },
  { id: "w6", label: "W6", sideAId: "wb-r2-c", sideBId: "wb-r2-d", outputNodeId: "wb-r3-b", advanceCount: 4, recruitLimit: 1, loserDestinationId: "lb-r2-d" },
  { id: "w7", label: "W7", sideAId: "wb-r3-a", sideBId: "wb-r3-b", outputNodeId: "wb-finalist", advanceCount: 4, recruitLimit: 0, loserDestinationId: "lb-r4-a" },

  { id: "l3", label: "L1", sideAId: "lb-r2-a", sideBId: "lb-r2-b", outputNodeId: "lb-r3-a", advanceCount: 3, recruitLimit: 1 },
  { id: "l4", label: "L2", sideAId: "lb-r2-c", sideBId: "lb-r2-d", outputNodeId: "lb-r3-b", advanceCount: 3, recruitLimit: 1 },
  { id: "l5", label: "L3", sideAId: "lb-r3-a", sideBId: "lb-r3-b", outputNodeId: "lb-r4-b", advanceCount: 4, recruitLimit: 1 },
  { id: "l6", label: "L4", sideAId: "lb-r4-a", sideBId: "lb-r4-b", outputNodeId: "lb-finalist", advanceCount: 4, recruitLimit: 0 },

  { id: "gf", label: "GF", sideAId: "wb-finalist", sideBId: "lb-finalist", outputNodeId: "champion", advanceCount: 4, recruitLimit: 0 },
];

export const MATCH_HOTSPOTS: Record<string, { x: number; y: number }> = {
  w1: { x: 312, y: 156 },
  w2: { x: 312, y: 318 },
  w3: { x: 312, y: 494 },
  w4: { x: 312, y: 656 },
  w5: { x: 692, y: 235 },
  w6: { x: 692, y: 573 },
  w7: { x: 1090, y: 404 },
  l3: { x: 692, y: 1035 },
  l4: { x: 692, y: 1245 },
  l5: { x: 1090, y: 1140 },
  l6: { x: 1482, y: 1060 },
  gf: { x: 1882, y: 730 },
};

export const LOSER_PAIRINGS = [
  { id: "pair-lb-ab", sourceNodeIds: ["lb-drop-a", "lb-drop-b"], outputNodeId: "lb-r2-b" },
  { id: "pair-lb-cd", sourceNodeIds: ["lb-drop-c", "lb-drop-d"], outputNodeId: "lb-r2-c" },
] as const;
