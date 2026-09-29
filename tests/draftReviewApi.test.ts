import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  checkApiReadiness,
  DraftReviewApiError,
  parseDraftReviewResponse,
  requestDraftReview,
} from '../src/api/draftReviewApi.ts'
import { getDraftReviewFormField } from '../src/api/draftReviewFieldErrors.ts'
import { M4_SCHEMA_VERSION } from '../src/types/m4/common.ts'
import type { DraftReviewRequest } from '../src/types/m4/request.ts'

const request: DraftReviewRequest = {
  schema_version: M4_SCHEMA_VERSION,
  mode: 'current',
  as_of: null,
  top_k: 5,
  draft: {
    notice_id: null,
    notice_round: null,
    title: '테스트 공고',
    bid_method: '전자입찰',
    organization: '테스트 기관',
    contract_method: '일반경쟁',
    award_method: '적격심사',
    service_type: '일반용역',
    procurement_class_name: '테스트 용역',
    procurement_class_code: null,
    estimated_price_krw: null,
    budget_krw: null,
    bid_start_at: '2026-10-01T10:00:00+09:00',
    bid_close_at: '2026-10-02T10:00:00+09:00',
    industry_restricted: null,
    joint_region_restricted: null,
    registration_restricted: null,
    vat_krw: null,
    attachment_count: null,
  },
}

const successPayload = {
  schema_version: M4_SCHEMA_VERSION,
  review: {
    effective_as_of: '2026-09-29T12:00:00+09:00',
    mode: 'current',
    input_title: request.draft.title,
    model_version: null,
    priority: {
      status: 'UNAVAILABLE',
      label: null,
      rank: null,
      relative_score: null,
      reference: null,
      reason: '모델 연결 전',
    },
    search: {
      status: 'NO_PRECEDENT',
      message: '비교 가능한 선례 부족',
      cases: [],
    },
    data_cutoff: null,
    warnings: ['경고 1', '경고 2'],
    input: request.draft,
  },
}

test('M4 JSON 샘플이 파싱되고 스키마 버전과 정상 응답 계약이 일치한다', () => {
  const sampleNames = [
    'sample_request.json',
    'sample_success.json',
    'sample_no_precedent.json',
    'sample_error.json',
  ]
  const samples = new Map(
    sampleNames.map((name) => {
      const url = new URL(`../docs/m4/${name}`, import.meta.url)
      const payload: unknown = JSON.parse(readFileSync(url, 'utf8'))
      assert.equal(
        (payload as { schema_version?: unknown }).schema_version,
        M4_SCHEMA_VERSION,
      )
      return [name, payload]
    }),
  )

  parseDraftReviewResponse(samples.get('sample_success.json'))
  parseDraftReviewResponse(samples.get('sample_no_precedent.json'))
})

test('POST 요청을 M4 경로와 JSON 본문으로 구성한다', async () => {
  let calledUrl = ''
  let calledInit: RequestInit | undefined
  const fetchImpl: typeof fetch = async (input, init) => {
    calledUrl = String(input)
    calledInit = init
    return Response.json(successPayload)
  }

  await requestDraftReview(request, {
    baseUrl: 'http://127.0.0.1:8000/',
    fetchImpl,
  })

  assert.equal(calledUrl, 'http://127.0.0.1:8000/api/v1/draft-reviews')
  assert.equal(calledInit?.method, 'POST')
  assert.equal(calledInit?.body, JSON.stringify(request))
  assert.deepEqual(calledInit?.headers, { 'Content-Type': 'application/json' })
})

test('NO_PRECEDENT 정상 응답을 오류 없이 보관한다', () => {
  const parsed = parseDraftReviewResponse(successPayload)
  assert.equal(parsed.review.search.status, 'NO_PRECEDENT')
  assert.deepEqual(parsed.review.search.cases, [])
  assert.equal(parsed.review.search.message, '비교 가능한 선례 부족')
  assert.equal(parsed.review.input.title, request.draft.title)
})

test('priority와 search의 UNAVAILABLE을 정상 부분 응답으로 처리한다', () => {
  const payload = {
    ...successPayload,
    review: {
      ...successPayload.review,
      search: { status: 'UNAVAILABLE', message: '검색 자료 준비 중', cases: [] },
    },
  }
  const parsed = parseDraftReviewResponse(payload)
  assert.equal(parsed.review.priority.status, 'UNAVAILABLE')
  assert.equal(parsed.review.priority.relative_score, null)
  assert.equal(parsed.review.search.status, 'UNAVAILABLE')
  assert.deepEqual(parsed.review.search.cases, [])
})

test('/ready의 M1·M2·M3가 모두 true일 때만 준비 완료로 처리한다', async () => {
  let calledUrl = ''
  const readyFetch: typeof fetch = async (input, init) => {
    calledUrl = String(input)
    assert.equal(init?.method, 'GET')
    return Response.json({ components: { m1: true, m2: true, m3: true } })
  }
  await checkApiReadiness({
    baseUrl: 'http://127.0.0.1:8000',
    fetchImpl: readyFetch,
  })
  assert.equal(calledUrl, 'http://127.0.0.1:8000/ready')

  const notReadyFetch: typeof fetch = async () =>
    Response.json({ components: { m1: true, m2: false, m3: true } })
  await assert.rejects(
    checkApiReadiness({ fetchImpl: notReadyFetch }),
    (error: unknown) =>
      error instanceof DraftReviewApiError &&
      error.kind === 'ANALYSIS_UNAVAILABLE',
  )
})

test('schema_version 또는 review.input이 잘못된 응답을 거부한다', () => {
  assert.throws(
    () => parseDraftReviewResponse({ ...successPayload, schema_version: 'old' }),
    (error: unknown) =>
      error instanceof DraftReviewApiError && error.kind === 'INVALID_RESPONSE',
  )

  const reviewWithoutInput: Record<string, unknown> = { ...successPayload.review }
  Reflect.deleteProperty(reviewWithoutInput, 'input')
  assert.throws(
    () => parseDraftReviewResponse({ ...successPayload, review: reviewWithoutInput }),
    (error: unknown) =>
      error instanceof DraftReviewApiError && error.kind === 'INVALID_RESPONSE',
  )
})

for (const [status, code] of [
  [400, 'INVALID_REQUEST'],
  [422, 'UNSUPPORTED_AS_OF'],
  [503, 'ANALYSIS_UNAVAILABLE'],
] as const) {
  test(`${status} 응답을 ${code} 오류로 구분한다`, async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        {
          schema_version: M4_SCHEMA_VERSION,
          error: { code, message: `${code} 메시지`, details: [] },
        },
        { status },
      )

    await assert.rejects(
      requestDraftReview(request, { fetchImpl }),
      (error: unknown) =>
        error instanceof DraftReviewApiError &&
        error.kind === code &&
        error.status === status,
    )
  })
}

test('연결 실패를 NETWORK_ERROR로 구분하고 샘플로 대체하지 않는다', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError('fetch failed')
  }

  await assert.rejects(
    requestDraftReview(request, { fetchImpl }),
    (error: unknown) =>
      error instanceof DraftReviewApiError && error.kind === 'NETWORK_ERROR',
  )
})

test('헤더 또는 오류 본문의 요청 ID를 보존한다', async () => {
  const headerFetch: typeof fetch = async () =>
    Response.json(
      {
        schema_version: M4_SCHEMA_VERSION,
        error: { code: 'INVALID_REQUEST', message: '입력 오류', details: [] },
      },
      { status: 400, headers: { 'X-Request-ID': 'header-request-id' } },
    )
  await assert.rejects(
    requestDraftReview(request, { fetchImpl: headerFetch }),
    (error: unknown) =>
      error instanceof DraftReviewApiError &&
      error.requestId === 'header-request-id',
  )

  const bodyFetch: typeof fetch = async () =>
    Response.json(
      {
        schema_version: M4_SCHEMA_VERSION,
        error: {
          code: 'UNSUPPORTED_AS_OF',
          message: '시점 오류',
          request_id: 'body-request-id',
        },
      },
      { status: 422 },
    )
  await assert.rejects(
    requestDraftReview(request, { fetchImpl: bodyFetch }),
    (error: unknown) =>
      error instanceof DraftReviewApiError &&
      error.requestId === 'body-request-id',
  )
})

test('서버 필드 경로를 해당 폼 필드로 연결한다', () => {
  assert.equal(getDraftReviewFormField('draft.bid_close_at'), 'bidCloseAt')
  assert.equal(getDraftReviewFormField('draft.title'), 'title')
  assert.equal(getDraftReviewFormField('as_of'), 'asOf')
  assert.equal(getDraftReviewFormField('unknown'), null)
})

test('취소 신호를 전달하고 ABORTED로 구분한다', async () => {
  const controller = new AbortController()
  controller.abort()
  const fetchImpl: typeof fetch = async (_input, init) => {
    assert.equal(init?.signal, controller.signal)
    throw new DOMException('aborted', 'AbortError')
  }

  await assert.rejects(
    requestDraftReview(request, {
      fetchImpl,
      signal: controller.signal,
    }),
    (error: unknown) =>
      error instanceof DraftReviewApiError && error.kind === 'ABORTED',
  )
})
