import type { GameState } from "@/lib/game/types";

export interface StoredSettings {
  lastPlayerNames: string[];
  lastCategoryId: string;
  lastCitizenRatio?: number;
  lastLiarRatio?: number;
  customCategoryLabel?: string;
  customKeywords?: string[];
}

export interface StoredSnapshot {
  savedAt: number;
  gameState: GameState;
}

const SETTINGS_KEY = "liar-game:settings";
const SNAPSHOT_KEY = "liar-game:snapshot";
const PHASES = new Set(["setup", "roleReveal", "hintTurn", "discussion", "vote", "liarGuess", "result"]);
const RESULT_REASONS = new Set(["wrong-vote", "liar-guessed-word", "liar-failed-guess"]);

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlayer(value: unknown): boolean {
  return isObject(value) && typeof value.id === "string" && typeof value.name === "string";
}

function isRoundConfig(value: unknown): boolean {
  return (
    isObject(value) &&
    Array.isArray(value.players) &&
    value.players.every(isPlayer) &&
    typeof value.categoryId === "string" &&
    typeof value.liarCount === "number" &&
    Number.isInteger(value.liarCount) &&
    value.liarCount >= 1 &&
    value.liarCount < value.players.length &&
    (value.customCategoryLabel === undefined || typeof value.customCategoryLabel === "string") &&
    (value.customWords === undefined ||
      (Array.isArray(value.customWords) && value.customWords.every((word) => typeof word === "string")))
  );
}

function isSecretAssignment(value: unknown): boolean {
  if (!isObject(value) || typeof value.playerId !== "string" || (value.role !== "citizen" && value.role !== "liar")) {
    return false;
  }

  if (value.word !== undefined && typeof value.word !== "string") {
    return false;
  }

  if (value.role === "citizen" && typeof value.word !== "string") {
    return false;
  }

  return true;
}

function isVoteBallot(value: unknown): boolean {
  return isObject(value) && typeof value.voterId === "string" && typeof value.targetId === "string";
}

function isRoundResult(value: unknown): boolean {
  if (
    !isObject(value) ||
    typeof value.votedPlayerId !== "string" ||
    typeof value.wasLiarCaught !== "boolean" ||
    (value.winner !== "citizens" && value.winner !== "liar") ||
    typeof value.reason !== "string" ||
    !RESULT_REASONS.has(value.reason)
  ) {
    return false;
  }

  return value.liarGuess === undefined || typeof value.liarGuess === "string";
}

function isGameState(value: unknown): value is GameState {
  if (
    !isObject(value) ||
    typeof value.phase !== "string" ||
    !PHASES.has(value.phase) ||
    (value.config !== null && value.config !== undefined && !isRoundConfig(value.config)) ||
    !Array.isArray(value.assignments) ||
    !value.assignments.every(isSecretAssignment) ||
    typeof value.currentTurnIndex !== "number" ||
    !Number.isInteger(value.currentTurnIndex) ||
    value.currentTurnIndex < 0 ||
    !Array.isArray(value.ballots) ||
    !value.ballots.every(isVoteBallot) ||
    (value.voteRound !== 1 && value.voteRound !== 2) ||
    !Array.isArray(value.eventLog) ||
    !value.eventLog.every((entry) => typeof entry === "string")
  ) {
    return false;
  }

  if (value.discussionStartedAt !== undefined && typeof value.discussionStartedAt !== "number") {
    return false;
  }

  if (value.eliminatedCandidateId !== undefined && typeof value.eliminatedCandidateId !== "string") {
    return false;
  }

  if (value.result !== undefined && !isRoundResult(value.result)) {
    return false;
  }

  if (
    value.tieCandidateIds !== undefined &&
    (!Array.isArray(value.tieCandidateIds) || !value.tieCandidateIds.every((candidateId) => typeof candidateId === "string"))
  ) {
    return false;
  }

  if (value.hostDecisionRequired !== undefined && typeof value.hostDecisionRequired !== "boolean") {
    return false;
  }

  return true;
}

export function loadSettings(): StoredSettings | null {
  if (!hasStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    if (!Array.isArray(parsed.lastPlayerNames) || typeof parsed.lastCategoryId !== "string") {
      return null;
    }

    return {
      lastPlayerNames: parsed.lastPlayerNames.filter((name): name is string => typeof name === "string"),
      lastCategoryId: parsed.lastCategoryId,
      lastCitizenRatio:
        typeof parsed.lastCitizenRatio === "number" && Number.isInteger(parsed.lastCitizenRatio)
          ? parsed.lastCitizenRatio
          : undefined,
      lastLiarRatio:
        typeof parsed.lastLiarRatio === "number" && Number.isInteger(parsed.lastLiarRatio) ? parsed.lastLiarRatio : undefined,
      customCategoryLabel: typeof parsed.customCategoryLabel === "string" ? parsed.customCategoryLabel : undefined,
      customKeywords: Array.isArray(parsed.customKeywords)
        ? parsed.customKeywords.filter((word): word is string => typeof word === "string")
        : undefined,
    };
  } catch {
    return null;
  }
}

export function saveSettings(settings: StoredSettings): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSnapshot(): StoredSnapshot | null {
  if (!hasStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (typeof parsed.savedAt !== "number" || !Number.isFinite(parsed.savedAt) || !isGameState(parsed.gameState)) {
      return null;
    }

    return {
      savedAt: parsed.savedAt,
      gameState: parsed.gameState,
    };
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: StoredSnapshot): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function clearSnapshot(): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(SNAPSHOT_KEY);
}
