import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  informationOr,
  formatKoreanDateTime,
  priorityDisplay,
  priorityReasonDisplay,
  searchDisplay,
  statusLabel,
} from '../src/result/reviewPresentation.ts'
import type { DraftReviewResponse, ReviewPriority } from '../src/types/m4/response.ts'

const loadResponse = (name: string): DraftReviewResponse =>
  JSON.parse(
    readFileSync(new URL(`../docs/m4/${name}`, import.meta.url), 'utf8'),
  ) as DraftReviewResponse

test('Q01은 서버 순서의 사례와 우선순위 제공 불가 사유를 유지한다', () => {
  const response = loadResponse('sample_success.json')
  const priority = priorityDisplay(response.review.priority)
  const search = searchDisplay(response.review.search)

  assert.equal(priority.state, '검토 우선순위 제공 불가')
  assert.equal(priority.detail, response.review.priority.reason)
  assert.equal(search.kind, 'cases')
  assert.deepEqual(
    response.review.search.cases.map(({ notice_id }) => notice_id),
    ['R25BK00579683'],
  )
})

test('Q08은 사례 카드를 만들지 않는 선례 부족 상태다', () => {
  const response = loadResponse('sample_no_precedent.json')
  const display = searchDisplay(response.review.search)

  assert.equal(display.kind, 'empty')
  assert.equal(display.title, '비교 가능한 선례 부족')
  assert.equal(display.message, null)
  assert.deepEqual(response.review.search.cases, [])
})

test('적용 불가 상태는 점수 대신 서버 사유와 검색 메시지를 표시한다', () => {
  const priority: ReviewPriority = {
    status: 'UNAVAILABLE',
    label: null,
    rank: null,
    relative_score: null,
    reference: null,
    reason: '직찰은 검토 우선순위를 제공하지 않습니다.',
  }
  const priorityState = priorityDisplay(priority)
  const searchState = searchDisplay({
    status: 'UNAVAILABLE',
    message: '직찰의 과거 사례 검색을 제공하지 않습니다.',
    cases: [],
  })

  assert.equal(priorityState.detail, priority.reason)
  assert.equal(searchState.kind, 'empty')
  assert.equal(searchState.message, '직찰의 과거 사례 검색을 제공하지 않습니다.')
  assert.equal(informationOr(priority.relative_score), '정보 없음')
})

test('AVAILABLE 상대점수는 백분율로 변환하지 않고 계약 값을 유지한다', () => {
  const priority: ReviewPriority = {
    status: 'AVAILABLE',
    label: '참고',
    rank: 8,
    relative_score: 62.5,
    reference: { cohort: '동일 연도 전자입찰 공고', ranked_count: 20 },
    reason: null,
  }

  assert.equal(priorityDisplay(priority).detail, '참고')
  assert.equal(informationOr(priority.relative_score), '62.5')
  assert.equal(informationOr(priority.reference?.ranked_count), '20')
})

test('결측값과 boolean은 0으로 치환하지 않는다', () => {
  assert.equal(informationOr(null), '정보 없음')
  assert.equal(informationOr(false), '아니요')
  assert.equal(informationOr(0), '0')
})

test('내부 상태값은 사용자용 한국어 배지로 표시한다', () => {
  assert.equal(statusLabel.priority.UNAVAILABLE, '우선순위 미제공')
  assert.equal(statusLabel.search.NO_PRECEDENT, '선례 부족')
  assert.equal(statusLabel.search.OK, '유사사례 있음')
})

test('M2 누락 필드를 한국어로 안내하고 서버 원문을 보존한다', () => {
  const original =
    'M2 필수 입력이 누락되었습니다: estimated_price_krw, vat_krw, attachment_count'
  const display = priorityReasonDisplay(original)

  assert.equal(
    display.summary,
    '검토 우선순위 산정에 필요한 값이 부족합니다: 추정가격, 부가세, 첨부 수',
  )
  assert.equal(display.original, original)
})

test('시각은 초 이하 소수만 줄이고 시간대는 보존한다', () => {
  assert.equal(
    formatKoreanDateTime('2026-09-29T10:12:13.987654+09:00'),
    '2026-09-29T10:12:13+09:00',
  )
  assert.equal(
    formatKoreanDateTime('2026-09-29T10:12:13+09:00'),
    '2026-09-29T10:12:13+09:00',
  )
})
