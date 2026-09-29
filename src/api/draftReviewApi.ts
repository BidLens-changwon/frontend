import { M4_SCHEMA_VERSION } from '../types/m4/common.ts'
import type { DraftReviewErrorCode, DraftReviewErrorDetail } from '../types/m4/error'
import type { DraftReviewRequest } from '../types/m4/request'
import type { DraftReviewResponse } from '../types/m4/response'

const DRAFT_REVIEW_PATH = '/api/v1/draft-reviews'
const READY_PATH = '/ready'

type FetchLike = typeof fetch

export type DraftReviewApiErrorKind =
  | DraftReviewErrorCode
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'ABORTED'

export class DraftReviewApiError extends Error {
  kind: DraftReviewApiErrorKind
  status: number | null
  details: DraftReviewErrorDetail[]
  requestId: string | null

  constructor(
    kind: DraftReviewApiErrorKind,
    message: string,
    options?: {
      status?: number
      details?: DraftReviewErrorDetail[]
      requestId?: string | null
    },
  ) {
    super(message)
    this.name = 'DraftReviewApiError'
    this.kind = kind
    this.status = options?.status ?? null
    this.details = options?.details ?? []
    this.requestId = options?.requestId ?? null
  }
}

interface RequestDraftReviewOptions {
  baseUrl?: string
  signal?: AbortSignal
  fetchImpl?: FetchLike
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const joinApiUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, '')}${path}`

const getHeaderRequestId = (response: Response) =>
  response.headers.get('X-Request-ID')

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw new DraftReviewApiError(
      'INVALID_RESPONSE',
      '서버 응답을 JSON 형식으로 읽을 수 없습니다.',
      { status: response.status, requestId: getHeaderRequestId(response) },
    )
  }
}

export const parseDraftReviewResponse = (
  payload: unknown,
): DraftReviewResponse => {
  if (!isRecord(payload) || payload.schema_version !== M4_SCHEMA_VERSION) {
    throw new DraftReviewApiError(
      'INVALID_RESPONSE',
      '지원하지 않는 API 응답 버전입니다.',
    )
  }

  const review = payload.review
  if (!isRecord(review) || !isRecord(review.input)) {
    throw new DraftReviewApiError(
      'INVALID_RESPONSE',
      '응답에 서버가 사용한 정규화 입력이 없습니다.',
    )
  }

  const priority = review.priority
  const search = review.search
  if (
    !isRecord(priority) ||
    !['AVAILABLE', 'UNAVAILABLE'].includes(String(priority.status)) ||
    !isRecord(search) ||
    !['OK', 'NO_PRECEDENT', 'UNAVAILABLE'].includes(String(search.status)) ||
    !Array.isArray(search.cases) ||
    !Array.isArray(review.warnings)
  ) {
    throw new DraftReviewApiError(
      'INVALID_RESPONSE',
      '응답이 M4 검토 결과 형식과 일치하지 않습니다.',
    )
  }

  return payload as unknown as DraftReviewResponse
}

const parseErrorResponse = async (
  response: Response,
): Promise<DraftReviewApiError> => {
  const payload = await readJson(response)
  const headerRequestId = getHeaderRequestId(response)
  if (
    !isRecord(payload) ||
    payload.schema_version !== M4_SCHEMA_VERSION ||
    !isRecord(payload.error)
  ) {
    return new DraftReviewApiError(
      'INVALID_RESPONSE',
      '서버 오류 응답이 M4 형식과 일치하지 않습니다.',
      { status: response.status, requestId: headerRequestId },
    )
  }

  const error = payload.error
  const expectedCodeByStatus: Partial<Record<number, DraftReviewErrorCode>> = {
    400: 'INVALID_REQUEST',
    422: 'UNSUPPORTED_AS_OF',
    503: 'ANALYSIS_UNAVAILABLE',
  }
  const expectedCode = expectedCodeByStatus[response.status]

  if (!expectedCode || error.code !== expectedCode) {
    return new DraftReviewApiError(
      'INVALID_RESPONSE',
      '서버 오류 상태와 오류 코드가 일치하지 않습니다.',
      { status: response.status, requestId: headerRequestId },
    )
  }

  const details = Array.isArray(error.details)
    ? error.details.filter(
        (detail): detail is DraftReviewErrorDetail =>
          isRecord(detail) &&
          typeof detail.field === 'string' &&
          typeof detail.message === 'string',
      )
    : []
  const bodyRequestId =
    typeof error.request_id === 'string' ? error.request_id : null

  return new DraftReviewApiError(
    expectedCode,
    typeof error.message === 'string' ? error.message : '검토 요청에 실패했습니다.',
    {
      status: response.status,
      details,
      requestId: headerRequestId ?? bodyRequestId,
    },
  )
}

export const checkApiReadiness = async (
  options: RequestDraftReviewOptions = {},
): Promise<void> => {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? ''

  try {
    const response = await fetchImpl(joinApiUrl(baseUrl, READY_PATH), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    })
    const requestId = getHeaderRequestId(response)

    if (!response.ok) {
      throw new DraftReviewApiError(
        'ANALYSIS_UNAVAILABLE',
        '백엔드 준비 상태를 확인할 수 없습니다.',
        { status: response.status, requestId },
      )
    }

    const payload = await readJson(response)
    const components = isRecord(payload) ? payload.components : null
    if (
      !isRecord(components) ||
      components.m1 !== true ||
      components.m2 !== true ||
      components.m3 !== true
    ) {
      throw new DraftReviewApiError(
        'ANALYSIS_UNAVAILABLE',
        '분석 구성요소가 아직 준비되지 않았습니다.',
        { status: response.status, requestId },
      )
    }
  } catch (error) {
    if (error instanceof DraftReviewApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DraftReviewApiError('ABORTED', '준비 상태 확인이 취소되었습니다.')
    }
    throw new DraftReviewApiError(
      'NETWORK_ERROR',
      '백엔드 준비 상태를 확인할 수 없습니다.',
    )
  }
}

export const requestDraftReview = async (
  request: DraftReviewRequest,
  options: RequestDraftReviewOptions = {},
): Promise<DraftReviewResponse> => {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl ?? import.meta.env?.VITE_API_BASE_URL ?? ''

  try {
    const response = await fetchImpl(joinApiUrl(baseUrl, DRAFT_REVIEW_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: options.signal,
    })

    if (!response.ok) throw await parseErrorResponse(response)
    try {
      return parseDraftReviewResponse(await readJson(response))
    } catch (error) {
      if (error instanceof DraftReviewApiError && !error.requestId) {
        error.requestId = getHeaderRequestId(response)
      }
      throw error
    }
  } catch (error) {
    if (error instanceof DraftReviewApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new DraftReviewApiError('ABORTED', '검토 요청이 취소되었습니다.')
    }
    throw new DraftReviewApiError(
      'NETWORK_ERROR',
      '서버에 연결할 수 없습니다. API 실행 상태와 주소를 확인해 주세요.',
    )
  }
}
