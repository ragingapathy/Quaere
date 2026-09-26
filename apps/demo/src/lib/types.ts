import type {
  ChallengeType,
  CounterfactMove,
  JuryTally,
  NarrowingRuling,
  Verdict,
} from "@quaere/rules";

export type CertaintyStage = "opening" | "interim" | "final";

export interface ChallengeResponse {
  text: string;
  mode: CounterfactMove | "";
  source: string;
  narrowed: string;
}

export interface DemoChallenge {
  id: string;
  type: ChallengeType;
  upvotes: number;
  hidden: boolean;
  author: string;
  text: string;
  round: 1 | 2 | null;
  resp: ChallengeResponse;
  tally: JuryTally;
  /** Set once the audience has ruled on a narrowing response for this
   * challenge (Decision Log: a narrowing is either a valid refinement or a
   * retreat, and the ruling is what caps the swing score, not the act of
   * narrowing itself). */
  narrowingRuling: NarrowingRuling | null;
}

export interface PollState {
  votes: number[];
  sealed: boolean;
}

export interface PastCase {
  claim: string;
  verdict: Verdict;
  opening: number;
  final: number;
}

export interface Handlers {
  setTopic: (topic: string) => void;
  setAmount: (amount: number) => void;
  postBounty: () => void;
  setClaimText: (text: string) => void;
  lockCertainty: (stage: CertaintyStage) => void;
  setDraft: (stage: CertaintyStage, value: number) => void;
  setVote: (stage: CertaintyStage, jurorIndex: number, value: number) => void;
  simulatePoll: (stage: CertaintyStage) => void;
  sealPoll: (stage: CertaintyStage) => void;
  toggleSelect: (round: 1 | 2, id: string) => void;
  upvote: (id: string) => void;
  setNewChallengeField: (field: "text" | "type" | "hidden", value: string | boolean) => void;
  addChallenge: () => void;
  buyRound: (round: 1 | 2) => void;
  setRespText: (id: string, text: string) => void;
  setRespMode: (id: string, mode: CounterfactMove) => void;
  setRespSource: (id: string, source: string) => void;
  setRespNarrowed: (id: string, text: string) => void;
  setNarrowingRuling: (id: string, ruling: NarrowingRuling) => void;
  adjustTally: (id: string, field: string, delta: 1 | -1) => void;
  simulateTally: (id: string) => void;
  closeRound: (round: 1 | 2) => void;
  go: (stage: number) => void;
  advance: () => void;
  setView: (view: "play" | "record") => void;
  reveal: () => void;
  newCaseOnSameClaim: () => void;
  resetAll: () => void;
}

export interface DemoState {
  stage: number;
  maxStage: number;
  view: "play" | "record";
  bounty: { topic: string; amount: number; posted: boolean };
  patron: { name: string; balance: number };
  claimantName: string;
  claim: {
    original: string;
    current: string;
    history: { round: 1 | 2; text: string; by: string }[];
  };
  draft: Record<CertaintyStage, number>;
  cert: Record<CertaintyStage, number | null>;
  polls: Record<CertaintyStage, PollState>;
  challenges: DemoChallenge[];
  selection: Record<1 | 2, string[]>;
  revealed: boolean;
  priorCases: PastCase[];
  newChallengeDraft: { text: string; type: ChallengeType; hidden: boolean };
}
