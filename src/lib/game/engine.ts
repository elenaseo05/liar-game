import { pickOne, randomInt } from "@/lib/game/random";
import { WORD_CATEGORIES, WORD_CATEGORY_MAP } from "@/lib/game/word-bank";
import type {
  GameState,
  Player,
  Role,
  RoundConfig,
  SecretAssignment,
  VoteBallot,
} from "@/lib/game/types";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 15;
export const MIN_ROLE_RATIO = 1;
export const MAX_ROLE_RATIO = 20;
export const DEFAULT_CITIZEN_RATIO = 4;
export const DEFAULT_LIAR_RATIO = 1;

export function createPlayerId(index: number): string {
  return `p-${Date.now().toString(36)}-${index}-${randomInt(100000)}`;
}

export function buildPlayers(names: string[]): Player[] {
  const usedNames = new Set<string>();

  return names.map((name, index) => {
    const trimmedName = name.trim();
    const defaultName = `플레이어 ${index + 1}`;
    let resolvedName = trimmedName || defaultName;
    let suffix = 2;

    while (usedNames.has(resolvedName.toLowerCase())) {
      resolvedName = `${trimmedName || defaultName} (${suffix})`;
      suffix += 1;
    }

    usedNames.add(resolvedName.toLowerCase());

    return {
      id: createPlayerId(index + 1),
      name: resolvedName,
    };
  });
}

export function validatePlayerNames(names: string[]): string | null {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    return `플레이어는 ${MIN_PLAYERS}명 이상 ${MAX_PLAYERS}명 이하여야 합니다.`;
  }

  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  const unique = new Set(trimmed.map((name) => name.toLowerCase()));
  if (unique.size !== trimmed.length) {
    return "중복된 플레이어 이름은 사용할 수 없습니다.";
  }

  return null;
}

export function validateRoleRatio(citizenRatio: number, liarRatio: number): string | null {
  if (
    !Number.isInteger(citizenRatio) ||
    !Number.isInteger(liarRatio) ||
    citizenRatio < MIN_ROLE_RATIO ||
    liarRatio < MIN_ROLE_RATIO ||
    citizenRatio > MAX_ROLE_RATIO ||
    liarRatio > MAX_ROLE_RATIO
  ) {
    return `시민:라이어 비율은 ${MIN_ROLE_RATIO}~${MAX_ROLE_RATIO} 사이의 정수로 입력해주세요.`;
  }

  return null;
}

export function getCategoryById(categoryId: string) {
  return WORD_CATEGORY_MAP.get(categoryId);
}

export function pickWordByCategory(categoryId: string, customWords?: string[]): string {
  if (categoryId === "custom") {
    const words = (customWords ?? []).map((word) => word.trim()).filter(Boolean);
    if (words.length === 0) {
      throw new Error("직접 입력 카테고리의 키워드가 비어 있습니다.");
    }

    return pickOne(words);
  }

  const category = getCategoryById(categoryId) ?? WORD_CATEGORIES[0];
  if (!category || category.words.length === 0) {
    throw new Error("사용 가능한 단어가 없습니다.");
  }

  return pickOne(category.words);
}

export function resolveLiarCountByRatio(
  playerCount: number,
  citizenRatio: number,
  liarRatio: number,
): number {
  if (playerCount <= 1) {
    return 1;
  }

  const totalRatio = citizenRatio + liarRatio;
  if (totalRatio <= 0) {
    return 1;
  }

  const estimated = Math.round((playerCount * liarRatio) / totalRatio);
  return Math.min(Math.max(estimated, 1), playerCount - 1);
}

function pickLiarIndices(playerCount: number, liarCount: number): Set<number> {
  const cappedLiarCount = Math.min(Math.max(liarCount, 1), Math.max(1, playerCount - 1));
  const indices = Array.from({ length: playerCount }, (_, index) => index);

  for (let index = 0; index < cappedLiarCount; index += 1) {
    const swapIndex = index + randomInt(playerCount - index);
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }

  return new Set(indices.slice(0, cappedLiarCount));
}

export function createAssignments(
  players: Player[],
  word: string,
  liarCount: number,
): SecretAssignment[] {
  const liarIndices = pickLiarIndices(players.length, liarCount);

  return players.map((player, index) => {
    const role: Role = liarIndices.has(index) ? "liar" : "citizen";

    return {
      playerId: player.id,
      role,
      word: role === "citizen" ? word : undefined,
    };
  });
}

export function createInitialRoundState(params: {
  players: Player[];
  categoryId: string;
  liarCount: number;
  customCategoryLabel?: string;
  customWords?: string[];
}): GameState {
  const resolvedLiarCount = Math.min(
    Math.max(Math.trunc(params.liarCount), 1),
    Math.max(1, params.players.length - 1),
  );

  const config: RoundConfig = {
    players: params.players,
    categoryId: params.categoryId,
    liarCount: resolvedLiarCount,
    customCategoryLabel: params.customCategoryLabel,
    customWords: params.customWords,
  };

  const word = pickWordByCategory(params.categoryId, params.customWords);
  const assignments = createAssignments(params.players, word, resolvedLiarCount);

  return {
    phase: "roleReveal",
    config,
    assignments,
    currentTurnIndex: 0,
    ballots: [],
    voteRound: 1,
    eventLog: ["새 라운드가 시작되었습니다."],
  };
}

export function getLiarIds(assignments: SecretAssignment[]): string[] {
  return assignments
    .filter((assignment) => assignment.role === "liar")
    .map((assignment) => assignment.playerId);
}

export function getCitizenWord(assignments: SecretAssignment[]): string | undefined {
  return assignments.find((assignment) => assignment.role === "citizen")?.word;
}

export function tallyVotes(ballots: VoteBallot[]): Map<string, number> {
  const result = new Map<string, number>();

  for (const ballot of ballots) {
    const prev = result.get(ballot.targetId) ?? 0;
    result.set(ballot.targetId, prev + 1);
  }

  return result;
}

export function getTopVotedCandidates(votes: Map<string, number>): string[] {
  let maxVote = 0;
  let candidates: string[] = [];

  for (const [candidateId, vote] of votes.entries()) {
    if (vote > maxVote) {
      maxVote = vote;
      candidates = [candidateId];
      continue;
    }

    if (vote === maxVote) {
      candidates.push(candidateId);
    }
  }

  return candidates;
}

export function normalizeWord(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}

export const initialGameState: GameState = {
  phase: "setup",
  config: null,
  assignments: [],
  currentTurnIndex: 0,
  ballots: [],
  voteRound: 1,
  eventLog: [],
};
