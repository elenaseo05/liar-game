import {
  createInitialRoundState,
  getCitizenWord,
  getLiarId,
  getTopVotedCandidates,
  initialGameState,
  normalizeWord,
  tallyVotes,
} from "@/lib/game/engine";
import type { GameState, Player, RoundResult, VoteBallot } from "@/lib/game/types";

export type GameAction =
  | { type: "HYDRATE"; payload: GameState }
  | {
      type: "START_GAME";
      payload: {
        players: Player[];
        categoryId: string;
      };
    }
  | { type: "NEXT_ROLE_REVEAL" }
  | { type: "NEXT_HINT_TURN" }
  | { type: "END_DISCUSSION" }
  | { type: "SUBMIT_VOTE"; payload: { targetId: string } }
  | { type: "HOST_DECIDE"; payload: { targetId: string } }
  | { type: "SUBMIT_LIAR_GUESS"; payload: { guess: string } }
  | { type: "NEXT_ROUND" }
  | { type: "RESET_TO_SETUP" };

function appendEvent(state: GameState, message: string): string[] {
  return [...state.eventLog, message];
}

function resolveVoteOutcome(state: GameState, eliminatedCandidateId: string): GameState {
  const players = state.config?.players ?? [];
  const eliminatedPlayer = players.find((player) => player.id === eliminatedCandidateId);
  const liarId = getLiarId(state.assignments);

  if (!liarId) {
    return {
      ...state,
      phase: "result",
      eliminatedCandidateId,
      result: {
        votedPlayerId: eliminatedCandidateId,
        wasLiarCaught: false,
        winner: "liar",
        reason: "wrong-vote",
      },
      eventLog: appendEvent(state, "오류: 라이어 정보를 찾을 수 없습니다."),
    };
  }

  if (eliminatedCandidateId !== liarId) {
    const result: RoundResult = {
      votedPlayerId: eliminatedCandidateId,
      wasLiarCaught: false,
      winner: "liar",
      reason: "wrong-vote",
    };

    return {
      ...state,
      phase: "result",
      eliminatedCandidateId,
      result,
      eventLog: appendEvent(
        state,
        `${eliminatedPlayer?.name ?? "플레이어"} 지목 실패로 라이어 승리입니다.`,
      ),
    };
  }

  return {
    ...state,
    phase: "liarGuess",
    eliminatedCandidateId,
    eventLog: appendEvent(state, "라이어가 지목되었습니다. 최종 제시어 추측을 진행합니다."),
  };
}

function processFinishedBallots(state: GameState, ballots: VoteBallot[]): GameState {
  const voteMap = tallyVotes(ballots);
  const topCandidates = getTopVotedCandidates(voteMap);
  const [topCandidate] = topCandidates;

  if (!topCandidate) {
    return state;
  }

  if (topCandidates.length <= 1) {
    return resolveVoteOutcome(state, topCandidate);
  }

  if (state.voteRound === 1) {
    return {
      ...state,
      ballots: [],
      currentTurnIndex: 0,
      voteRound: 2,
      tieCandidateIds: topCandidates,
      hostDecisionRequired: false,
      eventLog: appendEvent(state, "동표 발생: 동점자 재투표를 진행합니다."),
    };
  }

  return {
    ...state,
    ballots,
    currentTurnIndex: 0,
    hostDecisionRequired: true,
    tieCandidateIds: topCandidates,
    eventLog: appendEvent(
      state,
      "재투표도 동표입니다. 첫 번째 플레이어(진행자)가 최종 지목을 선택합니다.",
    ),
  };
}

function submitVote(state: GameState, targetId: string): GameState {
  const players = state.config?.players ?? [];
  const voter = players[state.currentTurnIndex];

  if (!voter || voter.id === targetId) {
    return state;
  }

  const candidatePool =
    state.voteRound === 2 && state.tieCandidateIds && state.tieCandidateIds.length > 0
      ? state.tieCandidateIds
      : players.map((player) => player.id);

  if (!candidatePool.includes(targetId)) {
    return state;
  }

  const nextBallots = [...state.ballots, { voterId: voter.id, targetId }];

  if (state.currentTurnIndex < players.length - 1) {
    return {
      ...state,
      ballots: nextBallots,
      currentTurnIndex: state.currentTurnIndex + 1,
    };
  }

  return processFinishedBallots(
    {
      ...state,
      ballots: nextBallots,
    },
    nextBallots,
  );
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "HYDRATE": {
      return action.payload;
    }
    case "START_GAME": {
      return createInitialRoundState({
        players: action.payload.players,
        categoryId: action.payload.categoryId,
      });
    }
    case "NEXT_ROLE_REVEAL": {
      if (state.phase !== "roleReveal") {
        return state;
      }

      const playerCount = state.config?.players.length ?? 0;

      if (state.currentTurnIndex < playerCount - 1) {
        return {
          ...state,
          currentTurnIndex: state.currentTurnIndex + 1,
        };
      }

      return {
        ...state,
        phase: "hintTurn",
        currentTurnIndex: 0,
        eventLog: appendEvent(state, "모든 역할 공개 완료. 힌트 발언을 시작합니다."),
      };
    }
    case "NEXT_HINT_TURN": {
      if (state.phase !== "hintTurn") {
        return state;
      }

      const playerCount = state.config?.players.length ?? 0;
      if (state.currentTurnIndex < playerCount - 1) {
        return {
          ...state,
          currentTurnIndex: state.currentTurnIndex + 1,
        };
      }

      return {
        ...state,
        phase: "discussion",
        currentTurnIndex: 0,
        discussionStartedAt: Date.now(),
        eventLog: appendEvent(state, "힌트 발언 종료. 토론을 시작합니다."),
      };
    }
    case "END_DISCUSSION": {
      if (state.phase !== "discussion") {
        return state;
      }

      return {
        ...state,
        phase: "vote",
        currentTurnIndex: 0,
        ballots: [],
        voteRound: 1,
        tieCandidateIds: undefined,
        hostDecisionRequired: false,
        eventLog: appendEvent(state, "토론 종료. 투표를 시작합니다."),
      };
    }
    case "SUBMIT_VOTE": {
      if (state.phase !== "vote" || state.hostDecisionRequired) {
        return state;
      }

      return submitVote(state, action.payload.targetId);
    }
    case "HOST_DECIDE": {
      if (state.phase !== "vote" || !state.hostDecisionRequired) {
        return state;
      }

      if (!state.tieCandidateIds?.includes(action.payload.targetId)) {
        return state;
      }

      return resolveVoteOutcome(state, action.payload.targetId);
    }
    case "SUBMIT_LIAR_GUESS": {
      if (state.phase !== "liarGuess" || !state.eliminatedCandidateId) {
        return state;
      }

      const secretWord = getCitizenWord(state.assignments);
      const normalizedGuess = normalizeWord(action.payload.guess);
      const wasCorrect = secretWord ? normalizeWord(secretWord) === normalizedGuess : false;

      const result: RoundResult = {
        votedPlayerId: state.eliminatedCandidateId,
        wasLiarCaught: true,
        liarGuess: action.payload.guess.trim(),
        winner: wasCorrect ? "liar" : "citizens",
        reason: wasCorrect ? "liar-guessed-word" : "liar-failed-guess",
      };

      return {
        ...state,
        phase: "result",
        result,
        eventLog: appendEvent(
          state,
          wasCorrect
            ? "라이어가 제시어를 맞혔습니다. 라이어 승리입니다."
            : "라이어가 제시어를 못 맞혔습니다. 시민 승리입니다.",
        ),
      };
    }
    case "NEXT_ROUND": {
      if (!state.config) {
        return initialGameState;
      }

      return createInitialRoundState({
        players: state.config.players,
        categoryId: state.config.categoryId,
      });
    }
    case "RESET_TO_SETUP": {
      return initialGameState;
    }
    default: {
      return state;
    }
  }
}
