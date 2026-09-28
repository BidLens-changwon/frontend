import type { M4SchemaVersion } from './common'

export type DraftReviewErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_AS_OF'
  | 'ANALYSIS_UNAVAILABLE'

export interface DraftReviewErrorDetail {
  field: string
  message: string
}

export interface DraftReviewError {
  code: DraftReviewErrorCode
  message: string
  details?: DraftReviewErrorDetail[]
}

export interface DraftReviewErrorResponse {
  schema_version: M4SchemaVersion
  error: DraftReviewError
}
