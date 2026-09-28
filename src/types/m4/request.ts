import type {
  DraftReviewInput,
  IsoDateTime,
  M4SchemaVersion,
  ReviewMode,
} from './common'

interface DraftReviewRequestBase {
  schema_version: M4SchemaVersion
  top_k?: number
  draft: DraftReviewInput
}

export interface CurrentDraftReviewRequest extends DraftReviewRequestBase {
  mode: 'current'
  as_of: null
}

export interface ReplayDraftReviewRequest extends DraftReviewRequestBase {
  mode: 'replay'
  as_of: IsoDateTime
}

export type DraftReviewRequest =
  | CurrentDraftReviewRequest
  | ReplayDraftReviewRequest

export type DraftReviewRequestMode = ReviewMode
