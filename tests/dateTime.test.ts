import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { toKoreanIso } from '../src/forms/dateTime.ts'

const readSample = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`../docs/m4/${name}`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>

const localDateTimeValue = (iso: string) => iso.replace(/\+09:00$/, '')

test('Q08 재현 기준시점의 초와 한국시간 오프셋을 보존한다', () => {
  const sample = readSample('sample_no_precedent.json') as {
    review: { effective_as_of: string }
  }
  const asOf = sample.review.effective_as_of

  assert.equal(
    toKoreanIso(localDateTimeValue(asOf)),
    '2026-03-06T09:33:09+09:00',
  )
})

test('Q01 재현 기준시점의 초와 한국시간 오프셋을 보존한다', () => {
  const sample = readSample('sample_request.json') as { as_of: string }

  assert.equal(
    toKoreanIso(localDateTimeValue(sample.as_of)),
    '2026-01-05T17:33:39+09:00',
  )
})

test('분 단위 입력에는 00초를 보완하고 빈 값은 유지한다', () => {
  assert.equal(
    toKoreanIso('2026-03-06T09:33'),
    '2026-03-06T09:33:00+09:00',
  )
  assert.equal(toKoreanIso(''), '')
})
