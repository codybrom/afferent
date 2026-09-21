import { choice, noul } from "./primitives.js";
import type { Answer, Question, SystemOneRequest } from "./primitives.js";
import type { CrossPageCandidatePair } from "../continuations/types.js";
import type { SpatialEngineOptions } from "../types.js";

export interface ContinuationEvaluationResult {
  isContinuation: boolean;
  probability: number;
  continuationType: "descriptionContinuation" | "titlePriceSplit" | "packageOptionsSplit" | "none";
}

/**
 * Standard System One evaluation function signature.
 * Compatible with TypeSafe's client.systemOne(...) or custom evaluate(...) methods.
 */
export type SystemOneEvaluateFn = (request: SystemOneRequest<Record<string, Question>>) => Promise<{
  answers: Record<string, Answer>;
  model?: string;
  usage?: { input_tokens: number; output_tokens: number };
}>;

/**
 * Client interface for TypeSafe System One.
 * Accepts either `@typesafe-ai/sdk` (which provides `systemOne`)
 * or custom clients (which provide `evaluate` or `systemOne`).
 */
export interface SystemOneClient {
  evaluate?: SystemOneEvaluateFn;
  systemOne?: SystemOneEvaluateFn;
}

/**
 * Function signature for evaluating whether a candidate pair is a continuation.
 */
export type ContinuationEvaluator = (
  candidate: CrossPageCandidatePair,
) => Promise<ContinuationEvaluationResult>;

/**
 * Builds the standard TypeSafe System One request for a cross-page boundary candidate.
 */
export function buildContinuationRequest(
  candidate: CrossPageCandidatePair,
  options?: SpatialEngineOptions<unknown>,
): SystemOneRequest {
  const tail = candidate.pageN.block;
  const head = candidate.pageNPlusOne.block;

  const tailText = (tail.description ? `${tail.title} ${tail.description}` : tail.title).trim();
  const headText = (head.description ? `${head.title} ${head.description}` : head.title).trim();

  const docContext = options?.documentContext ?? "catalog, service rate sheet, or price list";

  return {
    state: {
      document_type: docContext,
      page_n_tail_text: tailText,
      page_n_tail_title: tail.title,
      page_n_tail_price: tail.price,
      page_n_tail_value: tail.rawValueText ?? tail.rawPriceText,
      page_n1_head_text: headText,
      page_n1_head_title: head.title,
      page_n1_head_price: head.price,
      page_n1_head_value: head.rawValueText ?? head.rawPriceText,
    },
    questions: {
      isContinuation: noul(
        "Does the text at the top of page N+1 continue the item, description, attributes, or options from the bottom of page N, rather than being an independent offering?",
        {
          true: "The text at the top of page N+1 is an incomplete sentence fragment, inclusion continuation, specification, or attribute belonging to the item started at the bottom of page N",
          false:
            "The text at the top of page N+1 is a distinct independent offering, section header, or unrelated line item",
        },
      ),
      continuationType: choice("What type of cross-page continuation is this?", {
        descriptionContinuation:
          "Description narrative, specifications, or included attributes continue across the page break",
        titlePriceSplit:
          "Title was started on page N and value/price or closing title words are on page N+1",
        packageOptionsSplit:
          "Package sub-options, tiers, or attribute lists continue across the page break",
        none: "Not a continuation (distinct independent items)",
      }),
    },
  };
}

/**
 * Creates a ContinuationEvaluator function given a TypeSafe client or evaluation function.
 */
export function createContinuationEvaluator(
  clientOrFn: SystemOneClient | SystemOneEvaluateFn,
  options?: SpatialEngineOptions<unknown>,
): ContinuationEvaluator {
  const evalFn: SystemOneEvaluateFn =
    typeof clientOrFn === "function"
      ? clientOrFn
      : clientOrFn.systemOne
        ? clientOrFn.systemOne.bind(clientOrFn)
        : clientOrFn.evaluate
          ? clientOrFn.evaluate.bind(clientOrFn)
          : undefined!;

  if (!evalFn) {
    throw new Error(
      "Invalid System One client: must be a function or an object implementing .systemOne(...) or .evaluate(...)",
    );
  }

  return async (candidate: CrossPageCandidatePair): Promise<ContinuationEvaluationResult> => {
    const request = buildContinuationRequest(candidate, options);
    const response = await evalFn(request);

    const isContAnswer = response.answers?.isContinuation;
    const prob = isContAnswer && isContAnswer.type === "noul" ? isContAnswer.noul : 0.5;

    const typeAnswer = response.answers?.continuationType;
    const contType =
      typeAnswer && typeAnswer.type === "choice"
        ? (typeAnswer.choice as
            "descriptionContinuation" | "titlePriceSplit" | "packageOptionsSplit" | "none")
        : "none";

    return {
      isContinuation: prob >= 0.65 && contType !== "none",
      probability: prob,
      continuationType: contType,
    };
  };
}
