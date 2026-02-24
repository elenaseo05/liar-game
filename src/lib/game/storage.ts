import type { GameState } from "@/lib/game/types";

export interface StoredSettings {
  lastPlayerNames: string[];
  lastCategoryId: string;
}

export interface StoredSnapshot {
  savedAt: number;
  gameState: GameState;
}

const SETTINGS_KEY = "liar-game:settings";
const SNAPSHOT_KEY = "liar-game:snapshot";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
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
    if (typeof parsed.savedAt !== "number" || !parsed.gameState) {
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
