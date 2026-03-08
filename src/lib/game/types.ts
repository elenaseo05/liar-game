export type Role = "citizen" | "liar";

export type Phase =
  | "setup"
  | "roleReveal"
  | "hintTurn"
  | "discussion"
  | "vote"
  | "liarGuess"
  | "result";

export interface Player {
  id: string;
  name: string;
}

export interface RoundConfig {
  players: Player[];
  categoryId: string;
  liarCount: number;
  customCategoryLabel?: string;
  customWords?: string[];
}

export interface SecretAssignment {
  playerId: string;
  role: Role;
  word?: string;
}

export interface VoteBallot {
  voterId: string;
  targetId: string;
}

export interface RoundResult {
  votedPlayerId: string;
  wasLiarCaught: boolean;
  liarGuess?: string;
  winner: "citizens" | "liar";
  reason: "wrong-vote" | "liar-guessed-word" | "liar-failed-guess";
}

export interface GameState {
  phase: Phase;
  config: RoundConfig | null;
  assignments: SecretAssignment[];
  currentTurnIndex: number;
  discussionStartedAt?: number;
  ballots: VoteBallot[];
  eliminatedCandidateId?: string;
  result?: RoundResult;
  voteRound: 1 | 2;
  tieCandidateIds?: string[];
  hostDecisionRequired?: boolean;
  eventLog: string[];
}
