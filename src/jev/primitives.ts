/**
 * TypeSafe System One question and answer primitives.
 */

export interface ChoiceQuestion {
  type: "choice";
  instructions: string | Record<string, unknown> | unknown[];
  criteria: Record<string, string | Record<string, unknown> | unknown[] | null>;
}

export interface NoulQuestion {
  type: "noul";
  instructions: string | Record<string, unknown> | unknown[];
  criteria?: {
    true?: string | Record<string, unknown> | unknown[];
    false?: string | Record<string, unknown> | unknown[];
  };
}

export interface ScoreQuestion {
  type: "score";
  instructions: string | Record<string, unknown> | unknown[];
  criteria: Array<string | Record<string, unknown> | unknown[]>;
}

export type Question = ChoiceQuestion | NoulQuestion | ScoreQuestion;

export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface NoulAnswer {
  type: "noul";
  noul: number;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  probabilities: number[];
  confidence: number;
}

export type Answer = ChoiceAnswer | NoulAnswer | ScoreAnswer;

export interface SystemOneRequest<Q extends Record<string, Question> = Record<string, Question>> {
  state: string | Record<string, unknown> | unknown[];
  model?: string;
  questions: Q;
}

export interface SystemOneResponse<Q extends Record<string, Question> = Record<string, Question>> {
  model: string;
  answers: { [K in keyof Q]: Answer };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Creates a Choice question: picks one category from a defined set of options.
 */
export function choice(
  instructions: string | Record<string, unknown> | unknown[],
  criteria: Record<string, string | Record<string, unknown> | unknown[] | null>,
): ChoiceQuestion {
  return { type: "choice", instructions, criteria };
}

/**
 * Creates a Noul question: returns calibrated probability [0.0 - 1.0] of a condition being true.
 */
export function noul(
  instructions: string | Record<string, unknown> | unknown[],
  criteria?: {
    true?: string | Record<string, unknown>;
    false?: string | Record<string, unknown>;
  },
): NoulQuestion {
  return { type: "noul", instructions, criteria };
}

/**
 * Creates a Score question: evaluates position along an ordered scale of levels.
 */
export function score(
  instructions: string | Record<string, unknown> | unknown[],
  criteria: Array<string | Record<string, unknown> | unknown[]>,
): ScoreQuestion {
  return { type: "score", instructions, criteria };
}
