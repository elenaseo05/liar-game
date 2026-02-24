"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  buildPlayers,
  getCitizenWord,
  getLiarId,
  initialGameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  validatePlayerNames,
} from "@/lib/game/engine";
import { gameReducer } from "@/lib/game/reducer";
import {
  clearSnapshot,
  loadSettings,
  loadSnapshot,
  saveSettings,
  saveSnapshot,
} from "@/lib/game/storage";
import type { SecretAssignment } from "@/lib/game/types";
import { WORD_CATEGORIES } from "@/lib/game/word-bank";

const DEFAULT_DISCUSSION_SECONDS = 180;

function resolveReasonText(reason: string): string {
  if (reason === "wrong-vote") {
    return "시민이 라이어를 찾지 못해 라이어가 즉시 승리했습니다.";
  }

  if (reason === "liar-guessed-word") {
    return "라이어가 지목된 뒤 제시어 추측에 성공했습니다.";
  }

  return "라이어가 지목됐지만 제시어 추측에 실패했습니다.";
}

function formatRemaining(seconds: number): string {
  const minute = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const second = (seconds % 60).toString().padStart(2, "0");
  return `${minute}:${second}`;
}

function resolveSetupNames(lastNames: string[] | undefined): string[] {
  const names = (lastNames ?? []).map((name) => name.trim()).filter(Boolean).slice(0, MAX_PLAYERS);
  if (names.length >= MIN_PLAYERS) {
    return names;
  }

  return ["", "", ""];
}

export default function Home() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [setupNames, setSetupNames] = useState<string[]>(["", "", ""]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(WORD_CATEGORIES[0].id);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [remainingDiscussionSeconds, setRemainingDiscussionSeconds] = useState(
    DEFAULT_DISCUSSION_SECONDS,
  );
  const [liarGuess, setLiarGuess] = useState("");

  useEffect(() => {
    const settings = loadSettings();
    const snapshot = loadSnapshot();

    const timerId = window.setTimeout(() => {
      if (settings) {
        setSetupNames(resolveSetupNames(settings.lastPlayerNames));
        const hasCategory = WORD_CATEGORIES.some(
          (category) => category.id === settings.lastCategoryId,
        );
        if (hasCategory) {
          setSelectedCategoryId(settings.lastCategoryId);
        }
      }

      if (snapshot?.gameState) {
        dispatch({ type: "HYDRATE", payload: snapshot.gameState });
      }

      setHasBootstrapped(true);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (!hasBootstrapped) {
      return;
    }

    saveSnapshot({
      savedAt: Date.now(),
      gameState: state,
    });
  }, [hasBootstrapped, state]);

  useEffect(() => {
    if (state.phase !== "discussion") {
      return;
    }

    const resetTimerId = window.setTimeout(() => {
      setRemainingDiscussionSeconds(DEFAULT_DISCUSSION_SECONDS);
    }, 0);

    return () => window.clearTimeout(resetTimerId);
  }, [state.phase, state.discussionStartedAt]);

  useEffect(() => {
    if (state.phase !== "discussion") {
      return;
    }

    if (remainingDiscussionSeconds <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setRemainingDiscussionSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [state.phase, remainingDiscussionSeconds]);

  const players = useMemo(() => state.config?.players ?? [], [state.config]);

  const currentPlayer = players[state.currentTurnIndex];
  const liarId = getLiarId(state.assignments);
  const liarPlayer = players.find((player) => player.id === liarId);
  const citizenWord = getCitizenWord(state.assignments);

  const eliminatedPlayer = players.find((player) => player.id === state.eliminatedCandidateId);

  const currentAssignment: SecretAssignment | undefined = state.assignments.find(
    (assignment) => assignment.playerId === currentPlayer?.id,
  );

  const handleSetupNameChange = (index: number, value: string) => {
    setSetupNames((prev) => prev.map((name, i) => (i === index ? value : name)));
  };

  const handleAddPlayerInput = () => {
    setSetupNames((prev) => {
      if (prev.length >= MAX_PLAYERS) {
        return prev;
      }
      return [...prev, ""];
    });
  };

  const handleRemovePlayerInput = () => {
    setSetupNames((prev) => {
      if (prev.length <= MIN_PLAYERS) {
        return prev;
      }
      return prev.slice(0, -1);
    });
  };

  const handleStartGame = () => {
    const trimmedNames = setupNames.map((name) => name.trim()).filter(Boolean);
    const validationError = validatePlayerNames(trimmedNames);

    if (validationError) {
      setSetupError(validationError);
      return;
    }

    const playersForRound = buildPlayers(trimmedNames);

    saveSettings({
      lastPlayerNames: trimmedNames,
      lastCategoryId: selectedCategoryId,
    });

    dispatch({
      type: "START_GAME",
      payload: {
        players: playersForRound,
        categoryId: selectedCategoryId,
      },
    });

    setIsSecretVisible(false);
    setSetupError(null);
  };

  const handleResetToSetup = () => {
    clearSnapshot();
    dispatch({ type: "RESET_TO_SETUP" });
    setIsSecretVisible(false);
    setLiarGuess("");
  };

  const renderSetup = () => (
    <section className="panel">
      <h1 className="title">Liar Game</h1>
      <p className="subtitle">한 기기 패스앤플레이로 라이어를 찾아보세요.</p>

      <div className="stack-md">
        <div className="section-title-row">
          <h2>플레이어 등록</h2>
          <div className="row-gap-sm">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRemovePlayerInput}
              disabled={setupNames.length <= MIN_PLAYERS}
            >
              1명 줄이기
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddPlayerInput}
              disabled={setupNames.length >= MAX_PLAYERS}
            >
              1명 추가
            </button>
          </div>
        </div>

        {setupNames.map((name, index) => (
          <label key={`player-input-${index}`} className="stack-xs">
            <span className="field-label">플레이어 {index + 1}</span>
            <input
              className="input"
              value={name}
              onChange={(event) => handleSetupNameChange(index, event.target.value)}
              maxLength={16}
              placeholder={`이름 ${index + 1}`}
            />
          </label>
        ))}
      </div>

      <div className="stack-md top-space-lg">
        <label className="stack-xs">
          <span className="field-label">카테고리</span>
          <select
            className="input"
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
          >
            {WORD_CATEGORIES.map((category) => (
              <option value={category.id} key={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        {setupError ? <p className="error-text">{setupError}</p> : null}

        <button type="button" className="btn-primary" onClick={handleStartGame}>
          게임 시작
        </button>
      </div>
    </section>
  );

  const renderRoleReveal = () => {
    if (!currentPlayer || !currentAssignment) {
      return null;
    }

    const isLiar = currentAssignment.role === "liar";
    const isLastReveal = state.currentTurnIndex === players.length - 1;

    return (
      <section className="panel">
        <h2 className="phase-title">역할 공개</h2>
        <p className="phase-guide">
          기기를 <strong>{currentPlayer.name}</strong>님께 전달하고 아래 버튼으로 본인 정보만 확인하세요.
        </p>

        {!isSecretVisible ? (
          <button type="button" className="btn-primary" onClick={() => setIsSecretVisible(true)}>
            역할 공개하기
          </button>
        ) : (
          <div className="secret-card">
            <p className="secret-player">{currentPlayer.name}</p>
            <p className="secret-role">{isLiar ? "당신은 라이어입니다." : "당신은 시민입니다."}</p>
            <p className="secret-word">{isLiar ? "제시어가 없습니다." : `제시어: ${currentAssignment.word}`}</p>
          </div>
        )}

        <div className="top-space-lg">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setIsSecretVisible(false);
              dispatch({ type: "NEXT_ROLE_REVEAL" });
            }}
            disabled={!isSecretVisible}
          >
            {isLastReveal ? "확인 완료, 힌트 단계로" : "확인 완료, 다음 플레이어"}
          </button>
        </div>
      </section>
    );
  };

  const renderHintTurn = () => {
    if (!currentPlayer) {
      return null;
    }

    const isLastHint = state.currentTurnIndex === players.length - 1;

    return (
      <section className="panel">
        <h2 className="phase-title">힌트 발언</h2>
        <p className="phase-guide">
          <strong>{currentPlayer.name}</strong>님 차례입니다. 제시어를 직접 말하지 말고 짧은 힌트만 남겨주세요.
        </p>
        <p className="muted-text">
          진행: {state.currentTurnIndex + 1} / {players.length}
        </p>

        <button type="button" className="btn-primary top-space-lg" onClick={() => dispatch({ type: "NEXT_HINT_TURN" })}>
          {isLastHint ? "발언 완료, 토론 시작" : "발언 완료, 다음 플레이어"}
        </button>
      </section>
    );
  };

  const renderDiscussion = () => (
    <section className="panel">
      <h2 className="phase-title">토론</h2>
      <p className="phase-guide">누가 라이어인지 자유롭게 토론하세요.</p>
      <p className={`timer ${remainingDiscussionSeconds === 0 ? "timer-end" : ""}`}>
        {formatRemaining(remainingDiscussionSeconds)}
      </p>

      <button type="button" className="btn-primary top-space-lg" onClick={() => dispatch({ type: "END_DISCUSSION" })}>
        {remainingDiscussionSeconds === 0 ? "시간 종료, 투표 시작" : "토론 종료, 투표 시작"}
      </button>
    </section>
  );

  const renderVote = () => {
    if (players.length === 0) {
      return null;
    }

    const candidateIds =
      state.voteRound === 2 && state.tieCandidateIds && state.tieCandidateIds.length > 0
        ? state.tieCandidateIds
        : players.map((player) => player.id);

    if (state.hostDecisionRequired) {
      const host = players[0];
      const tiePlayers = players.filter((player) => state.tieCandidateIds?.includes(player.id));

      return (
        <section className="panel">
          <h2 className="phase-title">최종 지목</h2>
          <p className="phase-guide">
            재투표도 동점입니다. 진행자 <strong>{host?.name}</strong>님이 최종 지목을 선택하세요.
          </p>

          <div className="grid-buttons top-space-lg">
            {tiePlayers.map((player) => (
              <button
                type="button"
                key={player.id}
                className="btn-secondary"
                onClick={() => dispatch({ type: "HOST_DECIDE", payload: { targetId: player.id } })}
              >
                {player.name}
              </button>
            ))}
          </div>
        </section>
      );
    }

    const currentVoter = players[state.currentTurnIndex];
    const candidates = players.filter(
      (player) => candidateIds.includes(player.id) && player.id !== currentVoter?.id,
    );

    if (!currentVoter) {
      return null;
    }

    return (
      <section className="panel">
        <h2 className="phase-title">투표 {state.voteRound === 2 ? "(재투표)" : ""}</h2>
        <p className="phase-guide">
          기기를 <strong>{currentVoter.name}</strong>님께 전달하고 가장 수상한 사람을 선택하세요.
        </p>
        <p className="muted-text">
          진행: {state.currentTurnIndex + 1} / {players.length}
        </p>

        {state.voteRound === 2 ? (
          <p className="muted-text top-space-sm">재투표 대상: 동점자만 선택 가능합니다.</p>
        ) : null}

        <div className="grid-buttons top-space-lg">
          {candidates.map((player) => (
            <button
              type="button"
              key={player.id}
              className="btn-secondary"
              onClick={() => dispatch({ type: "SUBMIT_VOTE", payload: { targetId: player.id } })}
            >
              {player.name}
            </button>
          ))}
        </div>
      </section>
    );
  };

  const renderLiarGuess = () => (
    <section className="panel">
      <h2 className="phase-title">라이어 최종 추측</h2>
      <p className="phase-guide">
        <strong>{eliminatedPlayer?.name ?? "지목된 플레이어"}</strong>님, 제시어를 한 번만 입력할 수 있습니다.
      </p>

      <div className="stack-sm top-space-lg">
        <input
          className="input"
          value={liarGuess}
          onChange={(event) => setLiarGuess(event.target.value)}
          placeholder="제시어 입력"
          maxLength={30}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (!liarGuess.trim()) {
              return;
            }
            dispatch({ type: "SUBMIT_LIAR_GUESS", payload: { guess: liarGuess } });
            setLiarGuess("");
          }}
        >
          추측 제출
        </button>
      </div>
    </section>
  );

  const renderResult = () => {
    const result = state.result;

    if (!result) {
      return null;
    }

    return (
      <section className="panel">
        <h2 className="phase-title">결과</h2>
        <p className="result-winner">
          {result.winner === "citizens" ? "시민 승리" : "라이어 승리"}
        </p>
        <p className="phase-guide">{resolveReasonText(result.reason)}</p>

        <div className="stack-sm top-space-lg">
          <p className="muted-text">지목된 플레이어: {eliminatedPlayer?.name ?? "알 수 없음"}</p>
          <p className="muted-text">라이어: {liarPlayer?.name ?? "알 수 없음"}</p>
          <p className="muted-text">제시어: {citizenWord ?? "알 수 없음"}</p>
          {result.liarGuess ? <p className="muted-text">라이어 추측: {result.liarGuess}</p> : null}
        </div>

        {state.eventLog.length > 0 ? (
          <div className="top-space-lg">
            <h3 className="section-small-title">핵심 로그</h3>
            <ul className="log-list">
              {state.eventLog.map((entry, index) => (
                <li key={`event-${index}`}>{entry}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="row-gap-sm top-space-lg">
          <button type="button" className="btn-primary" onClick={() => dispatch({ type: "NEXT_ROUND" })}>
            같은 설정으로 다음 라운드
          </button>
          <button type="button" className="btn-secondary" onClick={handleResetToSetup}>
            설정 화면으로 이동
          </button>
        </div>
      </section>
    );
  };

  const renderByPhase = () => {
    switch (state.phase) {
      case "setup":
        return renderSetup();
      case "roleReveal":
        return renderRoleReveal();
      case "hintTurn":
        return renderHintTurn();
      case "discussion":
        return renderDiscussion();
      case "vote":
        return renderVote();
      case "liarGuess":
        return renderLiarGuess();
      case "result":
        return renderResult();
      default:
        return null;
    }
  };

  return (
    <main className="app-shell">
      <div className="background-glow" aria-hidden="true" />
      <div className="content-wrap">
        {renderByPhase()}

        {state.phase !== "setup" ? (
          <button type="button" className="link-button top-space-lg" onClick={handleResetToSetup}>
            라운드 종료 후 초기 설정으로 돌아가기
          </button>
        ) : null}

        {!hasBootstrapped ? <p className="muted-text top-space-sm">로컬 상태를 불러오는 중...</p> : null}
      </div>
    </main>
  );
}
