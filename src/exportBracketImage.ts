import {
  BRACKET_NODES,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
} from "./bracketConfig";
import type { BracketNodeDefinition, Player, Team, TournamentState } from "./types";

const EXPORT_BACKGROUND_SRC = "/bracket-reference.png";
const FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const normalizedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + normalizedRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, normalizedRadius);
  ctx.arcTo(x + width, y + height, x, y + height, normalizedRadius);
  ctx.arcTo(x, y + height, x, y, normalizedRadius);
  ctx.arcTo(x, y, x + width, y, normalizedRadius);
  ctx.closePath();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;
  const value = Number.parseInt(full, 16);

  if (Number.isNaN(value)) {
    return { r: 135, g: 146, b: 168 };
  }

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function alphaColor(color: string, alpha: number): string {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixColor(color: string, base: string, colorWeight: number): string {
  const foreground = hexToRgb(color);
  const background = hexToRgb(base);
  const baseWeight = 1 - colorWeight;

  return `rgb(${Math.round(foreground.r * colorWeight + background.r * baseWeight)}, ${Math.round(
    foreground.g * colorWeight + background.g * baseWeight,
  )}, ${Math.round(foreground.b * colorWeight + background.b * baseWeight)})`;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = 800,
) {
  let nextSize = size;
  ctx.font = `${weight} ${nextSize}px ${FONT_FAMILY}`;

  while (nextSize > 7 && ctx.measureText(text).width > maxWidth) {
    nextSize -= 1;
    ctx.font = `${weight} ${nextSize}px ${FONT_FAMILY}`;
  }

  ctx.fillText(text, x, y);
}

function nodeFontSize(node: BracketNodeDefinition): number {
  if (node.slotCount <= 1) {
    return Math.min(18, Math.max(12, node.height * 0.42));
  }

  return Math.min(16, Math.max(11, node.height / (node.slotCount + 1.1)));
}

function drawName(ctx: CanvasRenderingContext2D, player: Player, x: number, y: number, maxWidth: number, size: number) {
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = player.status === "eliminated" ? "rgba(241, 246, 252, 0.52)" : "#f6f8fb";
  drawText(ctx, player.username, x, y, maxWidth, size, 850);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function resolveNodeTeam(state: TournamentState, players: Player[], teamId?: string): Team | undefined {
  if (teamId && state.teams[teamId]) {
    return state.teams[teamId];
  }

  const firstTeamId = players[0]?.currentTeamId;
  if (firstTeamId && players.every((player) => player.currentTeamId === firstTeamId)) {
    return state.teams[firstTeamId];
  }

  return undefined;
}

function drawFallbackAvatar(ctx: CanvasRenderingContext2D, player: Player, x: number, y: number, size: number, color: string) {
  roundRect(ctx, x, y, size, size, 4);
  ctx.fillStyle = mixColor(color, "#18202b", 0.34);
  ctx.fill();
  ctx.strokeStyle = alphaColor(color, 0.7);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f5f8fb";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `850 ${Math.max(9, size * 0.52)}px ${FONT_FAMILY}`;
  ctx.fillText(player.username.slice(0, 1).toUpperCase(), x + size / 2, y + size / 2 + 0.5);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

async function drawAvatar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  x: number,
  y: number,
  size: number,
  color: string,
  avatarCache: Map<string, HTMLImageElement | null>,
) {
  let avatar = avatarCache.get(player.avatarUrl);

  if (avatar === undefined) {
    avatar = await loadImage(player.avatarUrl).catch(() => null);
    avatarCache.set(player.avatarUrl, avatar);
  }

  if (!avatar) {
    drawFallbackAvatar(ctx, player, x, y, size, color);
    return;
  }

  ctx.save();
  roundRect(ctx, x, y, size, size, 4);
  ctx.clip();
  ctx.drawImage(avatar, x, y, size, size);
  ctx.restore();

  roundRect(ctx, x, y, size, size, 4);
  ctx.strokeStyle = alphaColor(color, 0.72);
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

async function drawCompletedNode(
  ctx: CanvasRenderingContext2D,
  state: TournamentState,
  node: BracketNodeDefinition,
  avatarCache: Map<string, HTMLImageElement | null>,
) {
  const assignment = state.nodes[node.id];
  const players = assignment.playerIds.map((id) => state.players[id]).filter(Boolean).slice(0, node.slotCount);
  const team = resolveNodeTeam(state, players, assignment.teamId);
  const color = team?.color ?? assignment.color;

  if (players.length < node.slotCount) {
    return;
  }

  const borderWidth = node.section === "final" ? 4 : 3;
  const borderInset = borderWidth / 2;
  roundRect(
    ctx,
    node.x + borderInset,
    node.y + borderInset,
    node.width - borderWidth,
    node.height - borderWidth,
    6,
  );
  ctx.strokeStyle = color;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  ctx.shadowColor = alphaColor(color, 0.42);
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const paddingX = node.width <= 180 ? 7 : 10;
  const fontSize = nodeFontSize(node);
  const rowHeight = node.height / node.slotCount;
  const avatarSize = Math.max(14, Math.min(24, rowHeight - 7));
  const rowLineColor = alphaColor(color, 0.42);

  ctx.strokeStyle = rowLineColor;
  ctx.lineWidth = 1;
  for (let index = 1; index < node.slotCount; index += 1) {
    const y = node.y + rowHeight * index;
    ctx.beginPath();
    ctx.moveTo(node.x + 3, y);
    ctx.lineTo(node.x + node.width - 3, y);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const [index, player] of players.entries()) {
    const rowCenterY = node.y + rowHeight * index + rowHeight / 2;
    const avatarX = node.x + paddingX;
    const avatarY = rowCenterY - avatarSize / 2;
    await drawAvatar(ctx, player, avatarX, avatarY, avatarSize, color, avatarCache);
    drawName(
      ctx,
      player,
      avatarX + avatarSize + 7,
      rowCenterY,
      node.width - paddingX * 2 - avatarSize - 7,
      fontSize,
    );
  }
  ctx.textBaseline = "alphabetic";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Could not create PNG image."));
      }, "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

async function downloadCanvas(canvas: HTMLCanvasElement) {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `minecraft-tournament-bracket-${new Date().toISOString().slice(0, 10)}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportBracketImage(state: TournamentState): Promise<void> {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  const background = await loadImage(EXPORT_BACKGROUND_SRC);
  ctx.drawImage(background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const avatarCache = new Map<string, HTMLImageElement | null>();
  for (const node of BRACKET_NODES) {
    await drawCompletedNode(ctx, state, node, avatarCache);
  }

  await downloadCanvas(canvas);
}
