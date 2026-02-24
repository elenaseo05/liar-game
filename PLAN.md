# PLAN.md 초안: Liar Game MVP 개발 계획 (Pass-and-Play, Local-Only)

## 요약
이 문서는 현재 Plan Mode에서 작성한 `PLAN.md`용 결정 완료 스펙입니다.  
목표는 **단일 기기 패스앤플레이 기반의 라이어게임 1판을 완주 가능한 MVP**를 Next.js(App Router)로 구현하는 것입니다.  
확정된 방향은 다음 3가지입니다: **핵심 MVP**, **패스앤플레이 우선**, **로컬 저장(localStorage)만 사용**.

## 목표와 성공 기준
1. 플레이어 3~8명이 한 기기에서 라운드를 진행할 수 있어야 한다.
2. 기본 룰 흐름(역할 배정 → 힌트 → 토론 → 투표 → 라이어 추측 → 결과)이 끊김 없이 동작해야 한다.
3. 라이어/시민 승패 판정이 룰 문서와 일치해야 한다.
4. 다크·서스펜스 톤앤매너가 디자인 시스템(`design-system/liar-game/MASTER.md`)과 일치해야 한다.
5. 새로고침 후에도 최소 상태(설정/최근 게임 상태)가 로컬에 유지되어야 한다.

## 범위 (In Scope)
1. 단일 라운드 플레이 완주.
2. 플레이어 등록(이름), 인원 검증(3~8명).
3. 라이어 1명 랜덤 지정, 시민 공통 제시어 노출.
4. 힌트 턴 순서 관리, 토론 단계 진입.
5. 투표 및 동표 처리.
6. 라이어 최종 추측 1회.
7. 결과 화면(승리 진영/핵심 로그).
8. 기본 카테고리+단어 뱅크.
9. 반응형 UI(모바일 우선) + 접근성 최소 기준.

## 제외 범위 (Out of Scope)
1. 실시간 온라인 멀티플레이.
2. 계정/인증/서버 DB.
3. 누적 점수 리더보드.
4. 커스텀 카테고리 편집 UI.
5. 다국어(i18n) 및 고급 통계.
6. 3인 특별 룰(라이어 추측 2회) 토글.

## 기술/아키텍처
1. 프레임워크: Next.js 16 + React 19 + TypeScript.
2. 상태 관리: `useReducer` 기반 단일 게임 상태 머신.
3. 데이터 저장: `localStorage`(설정 + 최근 게임 스냅샷).
4. 랜덤성: `crypto.getRandomValues` 우선, 불가 시 `Math.random`.
5. 스타일: Tailwind v4 + `MASTER.md` 토큰 반영.
6. 구조: UI와 게임 로직 분리(순수 함수 엔진 + 프레젠테이션 컴포넌트).

## Public Interfaces / Types 변경 사항
```ts
// src/lib/game/types.ts
export type Role = "citizen" | "liar";
export type Phase = "setup" | "roleReveal" | "hintTurn" | "discussion" | "vote" | "liarGuess" | "result";

export interface Player {
  id: string;
  name: string;
}

export interface RoundConfig {
  players: Player[];
  categoryId: string;
  liarCount: 1; // MVP 고정
}

export interface SecretAssignment {
  playerId: string;
  role: Role;
  word?: string; // liar는 undefined
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
}
```

```ts
// src/lib/game/storage.ts
export interface StoredSettings {
  lastPlayerNames: string[];
  lastCategoryId: string;
}
export interface StoredSnapshot {
  savedAt: number;
  gameState: GameState;
}
```

## 화면/플로우 설계
1. `/` 단일 페이지에서 phase 기반 렌더링.
2. Setup 화면: 플레이어명 입력, 카테고리 선택, 시작 버튼.
3. Role Reveal 화면: 플레이어별 순차 공개(기기 전달 오버레이 포함).
4. Hint Turn 화면: 발언 순서 안내 + 다음 플레이어 버튼.
5. Discussion 화면: 토론 타이머(옵션형, 기본 3분 프리셋).
6. Vote 화면: 1인 1표, 중복/자기투표 불가.
7. Liar Guess 화면: 지목된 라이어에게 제시어 추측 1회 입력.
8. Result 화면: 승리 진영, 이유, 다음 라운드/초기화.

## 게임 룰 엔진 결정 사항
1. 라이어 수는 MVP에서 고정 1명.
2. 시민은 동일 제시어 1개 공유.
3. 동표 처리: 동점자끼리 1회 재투표, 다시 동표면 첫 플레이어(host) 결정.
4. 라이어 추측 기회: 항상 1회.
5. 승패 규칙:
6. 투표에서 라이어 미검거 시 즉시 라이어 승.
7. 라이어 검거 후 추측 성공 시 라이어 승.
8. 라이어 검거 후 추측 실패 시 시민 승.

## 데이터 설계
1. 단어 뱅크: `src/lib/game/word-bank.ts`.
2. 초기 데이터: 카테고리 8개, 카테고리당 단어 20개 이상.
3. 단어 선택: 카테고리 내부에서 균등 랜덤.
4. 금칙: 빈 카테고리, 중복 단어, 지나치게 난해한 단어는 제외.

## 구현 단계
1. 단계 1: 프로젝트 구조 정리 + 타입/엔진 함수 뼈대 작성.
2. 단계 2: Setup/Role Reveal/Hint Turn UI 구현.
3. 단계 3: Vote/Liar Guess/Result 및 판정 로직 완성.
4. 단계 4: localStorage 복원/초기화 + 예외 처리.
5. 단계 5: 디자인 토큰 반영 + 접근성/반응형 보정.
6. 단계 6: 테스트 작성 및 안정화.

## 테스트 케이스 및 시나리오
1. 단위 테스트:
2. 플레이어 N명에서 라이어 정확히 1명 배정.
3. 라이어에게 제시어 미노출.
4. 각 phase 전이 유효성 검증(잘못된 전이 차단).
5. 동표 재투표 및 host 결정 규칙 검증.
6. 승패 판정 3경로 전부 검증.
7. 컴포넌트 테스트:
8. 역할 공개 시 이전 플레이어 정보가 다음 플레이어에 노출되지 않음.
9. 투표 UI에서 중복 제출/자기투표 차단.
10. 결과 화면에 판정 이유가 정확히 표시됨.
11. E2E:
12. 시민 승리 플로우 1개.
13. 라이어 추측 성공 승리 플로우 1개.
14. 라이어 미검거 승리 플로우 1개.

## 수용 기준 (Acceptance Criteria)
1. 사용자가 앱 첫 진입 후 5분 내 1라운드 완료 가능.
2. 룰 문서(`docs/liar-game-rules.md`)와 승패 결과가 일치.
3. 모바일(375px)과 데스크톱(1440px)에서 기능 동등.
4. 핵심 인터랙션에 키보드 포커스 표시 존재.
5. 주요 경로(시작/투표/결과)에서 치명 오류 없이 완료.

## 가정 및 기본값
1. UI 언어는 MVP에서 한국어 단일.
2. 플레이어는 같은 공간에서 한 기기를 공유한다.
3. 서버/계정 없이 로컬 저장만 사용한다.
4. 타이머는 기본 3분, 사용자가 건너뛸 수 있다.
5. 디자인은 `MASTER.md`의 다크 서스펜스 톤을 기준으로 고정한다.
