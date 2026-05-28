import {
  Check,
  Download,
  Edit3,
  FileImage,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  Shield,
  Swords,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BRACKET_NODES,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MATCH_HOTSPOTS,
  MATCHES,
} from "./bracketConfig";
import { exportBracketImage } from "./exportBracketImage";
import { loadTournamentState, resetTournamentState, saveTournamentState } from "./storage";
import {
  addPlayerToTeamNode,
  applyMatchResult,
  createInitialState,
  createPlayer,
  deletePlayer,
  getNodeDefinition,
  getRosterCounts,
  movePlayerToTeam,
  resetBracketProgress,
  setNodePlayers,
  updateTeam,
} from "./tournamentLogic";
import type {
  BracketNodeDefinition,
  LoserDecision,
  MatchDefinition,
  MatchSide,
  Player,
  Team,
  TournamentState,
} from "./types";

const BRACKET_BACKGROUND = "/bracket-reference.png";
const POLL_INTERVAL = 5000;
type ResetMode = "bracket" | "all";

function minecraftAvatarUrl(username: string): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/64/nohelm.png`;
}

function nodeStyle(node: BracketNodeDefinition): React.CSSProperties {
  return {
    left: `${(node.x / CANVAS_WIDTH) * 100}%`,
    top: `${(node.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(node.width / CANVAS_WIDTH) * 100}%`,
    height: `${(node.height / CANVAS_HEIGHT) * 100}%`,
  };
}

function hotspotStyle(point: { x: number; y: number }): React.CSSProperties {
  return {
    left: `${(point.x / CANVAS_WIDTH) * 100}%`,
    top: `${(point.y / CANVAS_HEIGHT) * 100}%`,
  };
}

function playerSort(a: Player, b: Player): number {
  return a.username.localeCompare(b.username, undefined, { sensitivity: "base" });
}

function AppAvatar({ player, size = 26 }: { player: Player; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = player.username.slice(0, 1).toUpperCase();

  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {!failed && (
        <img
          src={player.avatarUrl}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {failed && <span>{initial}</span>}
    </span>
  );
}

function PlayerChip({ player, color, compact = false }: { player: Player; color: string; compact?: boolean }) {
  return (
    <span className={`player-chip player-chip--${player.status} ${compact ? "player-chip--compact" : ""}`} title={player.username}>
      <AppAvatar player={player} size={compact ? 14 : 18} />
      <span className="player-chip__name">{player.username}</span>
      <span className="player-chip__accent" style={{ background: color }} />
    </span>
  );
}

function EmptySlot() {
  return <span className="empty-slot">Empty</span>;
}

function BracketNode({
  node,
  state,
  isAdmin,
  onEdit,
}: {
  node: BracketNodeDefinition;
  state: TournamentState;
  isAdmin: boolean;
  onEdit: (nodeId: string) => void;
}) {
  const assignment = state.nodes[node.id];
  const players = assignment.playerIds.map((id) => state.players[id]).filter(Boolean);
  const slots = Array.from({ length: node.slotCount }, (_, index) => players[index]);

  return (
    <button
      className={`bracket-node bracket-node--${node.section}`}
      style={{
        ...nodeStyle(node),
        borderColor: assignment.color,
        "--node-color": assignment.color,
      } as React.CSSProperties}
      onClick={() => isAdmin && onEdit(node.id)}
      type="button"
      aria-label={isAdmin ? `Edit ${node.label}` : node.label}
    >
      <span className="bracket-node__label">{node.label}</span>
      <span className="bracket-node__slots">
        {slots.map((player, index) =>
          player ? (
            <PlayerChip key={player.id} player={player} color={assignment.color} compact />
          ) : (
            <EmptySlot key={`${node.id}-${index}`} />
          ),
        )}
      </span>
    </button>
  );
}

function RosterPanel({
  state,
  isAdmin,
  setState,
  setMessage,
}: {
  state: TournamentState;
  isAdmin: boolean;
  setState: (state: TournamentState) => void;
  setMessage: (message: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [bulkUsernames, setBulkUsernames] = useState("");
  const [teamId, setTeamId] = useState(Object.keys(state.teams)[0] ?? "");
  const teams = Object.values(state.teams);
  const players = Object.values(state.players).sort(playerSort);
  const counts = getRosterCounts(state);

  function findOpenStartingTeam(nextState: TournamentState): Team | undefined {
    return teams.find((team) => {
      const node = nextState.nodes[team.seedNodeId];
      if (!node) {
        return false;
      }

      const definition = getNodeDefinition(team.seedNodeId);
      return node.playerIds.length < definition.slotCount;
    });
  }

  function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const trimmed = username.trim();

    if (!trimmed) {
      setMessage("Enter a Minecraft username.");
      return;
    }

    const duplicate = players.some((player) => player.username.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setMessage(`${trimmed} is already in the roster.`);
      return;
    }

    const player = createPlayer(trimmed, teamId, minecraftAvatarUrl(trimmed));
    const result = addPlayerToTeamNode(state, player);
    if (!result.ok || !result.value) {
      setMessage(result.error ?? "Could not add player.");
      return;
    }

    setState(result.value);
    setUsername("");
    setMessage(`${trimmed} added.`);
  }

  function bulkAddPlayers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAdmin) return;
    const usernames = bulkUsernames
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (usernames.length === 0) {
      setMessage("Paste at least one username.");
      return;
    }

    let nextState = state;
    let added = 0;
    let duplicates = 0;
    let full = 0;
    const knownNames = new Set(players.map((player) => player.username.toLowerCase()));
    const pastedNames = new Set<string>();

    for (const nextUsername of usernames) {
      const normalized = nextUsername.toLowerCase();
      if (knownNames.has(normalized) || pastedNames.has(normalized)) {
        duplicates += 1;
        continue;
      }
      pastedNames.add(normalized);

      const nextTeam = findOpenStartingTeam(nextState);
      if (!nextTeam) {
        full += 1;
        continue;
      }

      const player = createPlayer(nextUsername, nextTeam.id, minecraftAvatarUrl(nextUsername));
      const result = addPlayerToTeamNode(nextState, player);
      if (!result.ok || !result.value) {
        full += 1;
        continue;
      }

      nextState = result.value;
      knownNames.add(normalized);
      added += 1;
    }

    if (added > 0) {
      setState(nextState);
      setBulkUsernames("");
    }

    const details = [
      `${added} imported`,
      duplicates > 0 ? `${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : "",
      full > 0 ? `${full} skipped; starting slots full` : "",
    ].filter(Boolean);
    setMessage(details.join(". "));
  }

  function changePlayerTeam(playerId: string, nextTeamId: string) {
    if (!isAdmin) return;
    const result = movePlayerToTeam(state, playerId, nextTeamId);
    if (!result.ok || !result.value) {
      setMessage(result.error ?? "Could not move player.");
      return;
    }

    setState(result.value);
    setMessage("Player moved.");
  }

  return (
    <aside className="side-panel side-panel--left">
      <section className="panel-section">
        <div className="section-title">
          <Users size={18} />
          <h2>Roster</h2>
        </div>
        {isAdmin ? (
          <>
            <form className="add-player-form" onSubmit={addPlayer}>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Minecraft username"
                autoComplete="off"
              />
              <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button className="primary-button" type="submit">
                <Plus size={16} />
                Add
              </button>
            </form>
            <form className="bulk-player-form" onSubmit={bulkAddPlayers}>
              <textarea
                value={bulkUsernames}
                onChange={(event) => setBulkUsernames(event.target.value)}
                placeholder="One username per line"
                rows={5}
              />
              <button type="submit">
                <Upload size={16} />
                Bulk Add
              </button>
            </form>
          </>
        ) : null}
        <div className="roster-counts">
          <span>{counts.active} active</span>
          <span>{counts.queued} queued</span>
          <span>{counts.eliminated} out</span>
        </div>
      </section>

      <section className="panel-section player-list">
        {players.length === 0 && <p className="empty-copy">No players yet.</p>}
        {players.map((player) => {
          const team = state.teams[player.initialTeamId];
          return (
            <div className="player-row" key={player.id}>
              <AppAvatar player={player} />
              <div className="player-row__main">
                <strong>{player.username}</strong>
                <span className={`status-pill status-pill--${player.status}`}>{player.status}</span>
              </div>
              {isAdmin ? (
                <>
                  <select value={player.initialTeamId} onChange={(event) => changePlayerTeam(player.id, event.target.value)}>
                    {teams.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    type="button"
                    title={`Remove ${player.username}`}
                    onClick={() => {
                      setState(deletePlayer(state, player.id));
                      setMessage(`${player.username} removed.`);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              ) : (
                <span className="team-dot" style={{ background: team?.color ?? "#8792a8" }} />
              )}
              {isAdmin && <span className="team-dot" style={{ background: team?.color ?? "#8792a8" }} />}
            </div>
          );
        })}
      </section>
    </aside>
  );
}

function TeamsAndBackupPanel({
  state,
  isAdmin,
  setState,
  setMessage,
  onOpenMatch,
  onRequestReset,
}: {
  state: TournamentState;
  isAdmin: boolean;
  setState: (state: TournamentState) => void;
  setMessage: (message: string) => void;
  onOpenMatch: (matchId: string) => void;
  onRequestReset: (mode: ResetMode) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportingImage, setExportingImage] = useState(false);
  const teams = Object.values(state.teams);

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `minecraft-tournament-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    if (!isAdmin) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<TournamentState>;
        const fallback = createInitialState();
        setState({
          ...fallback,
          ...parsed,
          players: parsed.players ?? fallback.players,
          teams: { ...fallback.teams, ...(parsed.teams ?? {}) },
          nodes: { ...fallback.nodes, ...(parsed.nodes ?? {}) },
          results: parsed.results ?? {},
          loserQueue: parsed.loserQueue ?? [],
        });
        setMessage("Tournament imported.");
      } catch {
        setMessage("Import failed. Choose a valid tournament JSON file.");
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  }

  async function exportImage() {
    setExportingImage(true);
    setMessage("Rendering bracket image...");

    try {
      await exportBracketImage(state);
      setMessage("Bracket image exported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not export bracket image.");
    } finally {
      setExportingImage(false);
    }
  }

  return (
    <aside className="side-panel side-panel--right">
      <section className="panel-section">
        <div className="section-title">
          <Edit3 size={18} />
          <h2>Teams</h2>
        </div>
        <div className="team-list">
          {teams.map((team) => (
            <label className="team-editor" key={team.id}>
              {isAdmin ? (
                <>
                  <input
                    type="color"
                    value={team.color}
                    onChange={(event) => setState(updateTeam(state, { ...team, color: event.target.value }))}
                  />
                  <input
                    value={team.name}
                    onChange={(event) => setState(updateTeam(state, { ...team, name: event.target.value }))}
                  />
                </>
              ) : (
                <>
                  <span className="team-dot" style={{ background: team.color, width: 38, height: 38, borderRadius: 7, display: "inline-block" }} />
                  <span style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>{team.name}</span>
                </>
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title">
          <Swords size={18} />
          <h2>Matches</h2>
        </div>
        <div className="match-list">
          {MATCHES.map((match) => {
            const completed = Boolean(state.results[match.id]);
            const sideACount = state.nodes[match.sideAId]?.playerIds.length ?? 0;
            const sideBCount = state.nodes[match.sideBId]?.playerIds.length ?? 0;
            return (
              <button
                className={`match-row ${completed ? "match-row--complete" : ""}`}
                key={match.id}
                onClick={() => isAdmin && onOpenMatch(match.id)}
                type="button"
                disabled={!isAdmin}
                style={!isAdmin ? { cursor: "default", opacity: 1 } : undefined}
              >
                <span>{match.label}</span>
                <small>
                  {sideACount}v{sideBCount} to {state.nodes[match.outputNodeId]?.label}
                </small>
                {completed && <Check size={15} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-title">
          <Trophy size={18} />
          <h2>Backups</h2>
        </div>
        <div className="backup-actions">
          <button type="button" onClick={exportJson}>
            <Download size={16} />
            JSON
          </button>
          <button type="button" onClick={exportImage} disabled={exportingImage}>
            <FileImage size={16} />
            {exportingImage ? "Rendering" : "Image"}
          </button>
          {isAdmin && (
            <>
              <button type="button" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                Import
              </button>
              <button type="button" onClick={() => onRequestReset("bracket")}>
                <RotateCcw size={16} />
                Bracket
              </button>
              <button type="button" onClick={() => onRequestReset("all")}>
                <RotateCcw size={16} />
                All
              </button>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              importJson(file);
            }
          }}
        />
        {state.loserQueue.length > 0 && (
          <div className="queue-list">
            <h3>Queue</h3>
            {state.loserQueue.map((playerId) => {
              const player = state.players[playerId];
              return player ? <PlayerChip key={playerId} player={player} color="#9ca3af" /> : null;
            })}
          </div>
        )}
      </section>
    </aside>
  );
}

function ConfirmResetModal({
  mode,
  onCancel,
  onConfirm,
}: {
  mode: ResetMode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal--confirm">
        <header className="modal-header">
          <div>
            <h2>Are you sure?</h2>
            <p>{mode === "bracket" ? "Reset bracket progress and keep players." : "Reset everything."}</p>
          </div>
        </header>
        <footer className="modal-actions">
          <button type="button" onClick={onCancel}>
            No
          </button>
          <button className="primary-button" type="button" onClick={onConfirm}>
            <RotateCcw size={16} />
            Yes
          </button>
        </footer>
      </div>
    </div>
  );
}

function AdminLoginModal({
  onLogin,
  onClose,
}: {
  onLogin: (password: string) => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onLogin(password);
      } else {
        setError("Wrong password.");
      }
    } catch {
      setError("Could not reach server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal--confirm">
        <header className="modal-header">
          <div>
            <h2>Admin Login</h2>
            <p>Enter the admin password to edit the bracket.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit} style={{ padding: 18, display: "grid", gap: 10 }}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          {error && <p className="modal-error" style={{ margin: 0 }}>{error}</p>}
          <footer className="modal-actions" style={{ padding: 0, borderTop: 0 }}>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={loading}>
              <Lock size={16} />
              {loading ? "Checking..." : "Login"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function BracketBoard({
  state,
  isAdmin,
  onOpenMatch,
  onEditNode,
}: {
  state: TournamentState;
  isAdmin: boolean;
  onOpenMatch: (matchId: string) => void;
  onEditNode: (nodeId: string) => void;
}) {
  return (
    <main className="board-shell">
      <div className="board-scroll">
        <div className="bracket-board" aria-label="Tournament bracket">
          <img className="bracket-background" src={BRACKET_BACKGROUND} alt="" />
          {BRACKET_NODES.map((node) => (
            <BracketNode key={node.id} node={node} state={state} isAdmin={isAdmin} onEdit={onEditNode} />
          ))}
          {MATCHES.map((match) => {
            const point = MATCH_HOTSPOTS[match.id];
            if (!point) {
              return null;
            }
            const completed = Boolean(state.results[match.id]);
            return (
              <button
                key={match.id}
                className={`match-hotspot ${completed ? "match-hotspot--complete" : ""}`}
                style={hotspotStyle(point)}
                onClick={() => isAdmin && onOpenMatch(match.id)}
                type="button"
                title={isAdmin ? `Resolve ${match.label}` : match.label}
              >
                {completed ? <Check size={14} /> : <Swords size={14} />}
                <span>{match.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function MatchModal({
  match,
  state,
  onApply,
  onClose,
}: {
  match: MatchDefinition;
  state: TournamentState;
  onApply: (state: TournamentState, message: string) => void;
  onClose: () => void;
}) {
  const [winnerSide, setWinnerSide] = useState<MatchSide>("a");
  const [recruitedIds, setRecruitedIds] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, LoserDecision>>({});
  const [error, setError] = useState("");

  const sideA = state.nodes[match.sideAId];
  const sideB = state.nodes[match.sideBId];
  const sideAPlayers = sideA.playerIds.map((id) => state.players[id]).filter(Boolean);
  const sideBPlayers = sideB.playerIds.map((id) => state.players[id]).filter(Boolean);
  const winnerPlayers = winnerSide === "a" ? sideAPlayers : sideBPlayers;
  const loserPlayers = winnerSide === "a" ? sideBPlayers : sideAPlayers;
  const requiredRecruitCount = Math.max(0, Math.min(match.recruitLimit, match.advanceCount - winnerPlayers.length));
  const loserDestination = match.loserDestinationId ? state.nodes[match.loserDestinationId] : undefined;
  const unchosenLosers = loserPlayers.filter((player) => !recruitedIds.includes(player.id));

  useEffect(() => {
    setRecruitedIds([]);
    setDecisions({});
    setError("");
  }, [winnerSide, match.id]);

  function toggleRecruit(playerId: string) {
    setRecruitedIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= requiredRecruitCount) {
        return current;
      }
      return [...current, playerId];
    });
  }

  function submit() {
    const result = applyMatchResult(state, match, {
      winnerSide,
      recruitedPlayerIds: recruitedIds,
      loserDecisions: decisions,
    });

    if (!result.ok || !result.value) {
      setError(result.error ?? "Match could not be resolved.");
      return;
    }

    onApply(result.value, `${match.label} resolved.`);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <div>
            <h2>{match.label}</h2>
            <p>
              {state.nodes[match.sideAId].label} vs {state.nodes[match.sideBId].label}
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </header>

        <div className="match-modal-grid">
          <button
            className={`match-side ${winnerSide === "a" ? "match-side--winner" : ""}`}
            style={{ borderColor: sideA.color }}
            type="button"
            onClick={() => setWinnerSide("a")}
          >
            <strong>{sideA.label}</strong>
            {sideAPlayers.map((player) => (
              <PlayerChip key={player.id} player={player} color={sideA.color} />
            ))}
            {sideAPlayers.length === 0 && <EmptySlot />}
          </button>
          <button
            className={`match-side ${winnerSide === "b" ? "match-side--winner" : ""}`}
            style={{ borderColor: sideB.color }}
            type="button"
            onClick={() => setWinnerSide("b")}
          >
            <strong>{sideB.label}</strong>
            {sideBPlayers.map((player) => (
              <PlayerChip key={player.id} player={player} color={sideB.color} />
            ))}
            {sideBPlayers.length === 0 && <EmptySlot />}
          </button>
        </div>

        <section className="modal-section">
          <h3>Recruit</h3>
          <div className="choice-list">
            {loserPlayers.length === 0 && <p className="empty-copy">No defeated players.</p>}
            {loserPlayers.map((player) => {
              const selected = recruitedIds.includes(player.id);
              const disabled = !selected && recruitedIds.length >= requiredRecruitCount;
              return (
                <label className={`checkbox-row ${disabled ? "checkbox-row--disabled" : ""}`} key={player.id}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled || requiredRecruitCount === 0}
                    onChange={() => toggleRecruit(player.id)}
                  />
                  <PlayerChip player={player} color={winnerSide === "a" ? sideA.color : sideB.color} />
                </label>
              );
            })}
          </div>
          <p className="modal-meta">
            {recruitedIds.length}/{requiredRecruitCount} selected, {match.advanceCount} advance
          </p>
        </section>

        <section className="modal-section">
          <h3>Defeated</h3>
          <div className="choice-list">
            {unchosenLosers.length === 0 && <p className="empty-copy">No remaining defeated players.</p>}
            {unchosenLosers.map((player) => (
              <div className="decision-row" key={player.id}>
                <PlayerChip player={player} color={winnerSide === "a" ? sideB.color : sideA.color} />
                <div className="segmented">
                  <button
                    type="button"
                    className={decisions[player.id] === "loser" ? "selected" : ""}
                    onClick={() => setDecisions((current) => ({ ...current, [player.id]: "loser" }))}
                  >
                    {loserDestination ? loserDestination.label : "Queue"}
                  </button>
                  <button
                    type="button"
                    className={decisions[player.id] === "eliminate" ? "selected" : ""}
                    onClick={() => setDecisions((current) => ({ ...current, [player.id]: "eliminate" }))}
                  >
                    Out
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="modal-error">{error}</p>}

        <footer className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={submit}>
            <Check size={16} />
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}

function NodeEditorModal({
  node,
  state,
  onApply,
  onClose,
}: {
  node: BracketNodeDefinition;
  state: TournamentState;
  onApply: (state: TournamentState, message: string) => void;
  onClose: () => void;
}) {
  const assignment = state.nodes[node.id];
  const [selectedIds, setSelectedIds] = useState<string[]>(assignment.playerIds);
  const [teamId, setTeamId] = useState(assignment.teamId ?? "");
  const [color, setColor] = useState(assignment.color);
  const [error, setError] = useState("");
  const players = Object.values(state.players).sort(playerSort);
  const teams = Object.values(state.teams);

  function togglePlayer(playerId: string) {
    setSelectedIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= node.slotCount) {
        return current;
      }
      return [...current, playerId];
    });
  }

  function save() {
    const result = setNodePlayers(state, node.id, selectedIds, color, teamId || null);
    if (!result.ok || !result.value) {
      setError(result.error ?? "Could not save node.");
      return;
    }

    onApply(result.value, `${node.label} saved.`);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal--node">
        <header className="modal-header">
          <div>
            <h2>{node.label}</h2>
            <p>
              {selectedIds.length}/{node.slotCount} slots
            </p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </header>

        <div className="node-editor-controls">
          <label>
            <span>Team</span>
            <select
              value={teamId}
              onChange={(event) => {
                const nextTeamId = event.target.value;
                setTeamId(nextTeamId);
                if (nextTeamId) {
                  setColor(state.teams[nextTeamId].color);
                }
              }}
            >
              <option value="">Group</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Color</span>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
        </div>

        <div className="player-picker">
          {players.length === 0 && <p className="empty-copy">No roster players.</p>}
          {players.map((player) => {
            const selected = selectedIds.includes(player.id);
            const disabled = !selected && selectedIds.length >= node.slotCount;
            return (
              <label className={`checkbox-row ${disabled ? "checkbox-row--disabled" : ""}`} key={player.id}>
                <input type="checkbox" checked={selected} disabled={disabled} onChange={() => togglePlayer(player.id)} />
                <PlayerChip player={player} color={state.teams[player.currentTeamId]?.color ?? color} />
              </label>
            );
          })}
        </div>

        {error && <p className="modal-error">{error}</p>}

        <footer className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={save}>
            <Check size={16} />
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}

export function App() {
  const [state, setStateRaw] = useState<TournamentState>(() => createInitialState());
  const [message, setMessage] = useState("");
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<ResetMode | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  useEffect(() => {
    loadTournamentState().then((s) => {
      setStateRaw(s);
      setLoaded(true);
    });
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isAdmin) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    pollRef.current = setInterval(async () => {
      const s = await loadTournamentState();
      setStateRaw(s);
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAdmin]);

  const setState = useCallback(
    (next: TournamentState) => {
      setStateRaw(next);
      if (adminToken) {
        saveTournamentState(next, adminToken);
      }
    },
    [adminToken],
  );

  useEffect(() => {
    if (!message) {
      return;
    }
    const timeout = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const activeMatch = useMemo(
    () => MATCHES.find((match) => match.id === activeMatchId) ?? null,
    [activeMatchId],
  );
  const editingNode = useMemo(
    () => BRACKET_NODES.find((node) => node.id === editingNodeId) ?? null,
    [editingNodeId],
  );

  function applyState(nextState: TournamentState, nextMessage: string) {
    setState(nextState);
    setMessage(nextMessage);
  }

  function applyReset(mode: ResetMode) {
    setActiveMatchId(null);
    setEditingNodeId(null);
    setResetMode(null);

    if (mode === "bracket") {
      setState(resetBracketProgress(state));
      setMessage("Bracket reset.");
      return;
    }

    const fresh = resetTournamentState();
    setStateRaw(fresh);
    saveTournamentState(fresh, adminToken);
    setMessage("Tournament reset.");
  }

  function handleLogin(password: string) {
    setAdminToken(password);
    setIsAdmin(true);
    setShowLogin(false);
    setMessage("Admin mode enabled.");
  }

  function handleLogout() {
    setAdminToken(null);
    setIsAdmin(false);
    setActiveMatchId(null);
    setEditingNodeId(null);
    setMessage("Logged out.");
  }

  if (!loaded) {
    return (
      <div className="app-shell" style={{ display: "grid", placeItems: "center" }}>
        <p style={{ color: "#8795a5" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="admin-bar">
        {isAdmin ? (
          <button className="admin-button admin-button--active" type="button" onClick={handleLogout}>
            <Shield size={16} />
            Admin
            <LogOut size={14} />
          </button>
        ) : (
          <button className="admin-button" type="button" onClick={() => setShowLogin(true)}>
            <Lock size={16} />
            Admin Login
          </button>
        )}
      </div>

      <RosterPanel state={state} isAdmin={isAdmin} setState={setState} setMessage={setMessage} />
      <BracketBoard state={state} isAdmin={isAdmin} onOpenMatch={setActiveMatchId} onEditNode={setEditingNodeId} />
      <TeamsAndBackupPanel
        state={state}
        isAdmin={isAdmin}
        setState={setState}
        setMessage={setMessage}
        onOpenMatch={setActiveMatchId}
        onRequestReset={setResetMode}
      />

      {message && <div className="toast">{message}</div>}
      {showLogin && <AdminLoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}
      {resetMode && (
        <ConfirmResetModal
          mode={resetMode}
          onCancel={() => setResetMode(null)}
          onConfirm={() => applyReset(resetMode)}
        />
      )}
      {activeMatch && isAdmin && (
        <MatchModal match={activeMatch} state={state} onApply={applyState} onClose={() => setActiveMatchId(null)} />
      )}
      {editingNode && isAdmin && (
        <NodeEditorModal node={editingNode} state={state} onApply={applyState} onClose={() => setEditingNodeId(null)} />
      )}
    </div>
  );
}
