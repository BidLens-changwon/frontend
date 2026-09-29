import type {
  DraftReviewInput,
  IsoDateTime,
  M4SchemaVersion,
  ReviewMode,
} from './common'

export type PriorityStatus = 'AVAILABLE' | 'UNAVAILABLE'
export type PriorityLabel = '우선검토' | '참고' | '일반'
export type SearchStatus = 'OK' | 'NO_PRECEDENT' | 'UNAVAILABLE'

export interface ReviewPriority {
  status: PriorityStatus
  label: PriorityLabel | null
  rank: number | null
  relative_score: number | null
  reference: Record<string, unknown> | null
  reason: string | null
}

export interface PrecedentCase {
  rank: number
  notice_id: string
  notice_round: string
  title: string
  task_type: string
  similar_reason: string
  different_conditions: string
  first_bidder_count: number | null
  opening_status: string
  notice_url: string | null
  notice_published_at: IsoDateTime
  first_result_recorded_at: IsoDateTime
  review_status: string
}

export interface PrecedentSearch {
  status: SearchStatus
  message: string | null
  cases: PrecedentCase[]
}

export interface DraftReview {
  effective_as_of: IsoDateTime
  mode: ReviewMode
  input_title: string
  model_version: string | null
  priority: ReviewPriority
  search: PrecedentSearch
  data_cutoff: IsoDateTime | null
  warnings: string[]
  input?: DraftReviewInput
}

export interface DraftReviewResponse {
  schema_version: M4SchemaVersion
  review: DraftReview
}
