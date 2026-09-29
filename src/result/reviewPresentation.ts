import type { PrecedentSearch, ReviewPriority } from '../types/m4/response.ts'

const missingFieldLabels: Record<string, string> = {
  estimated_price_krw: '추정가격',
  budget_krw: '배정예산',
  vat_krw: '부가세',
  attachment_count: '첨부 수',
  bid_start_at: '입찰 시작일시',
  bid_close_at: '입찰 마감일시',
}

const missingReasonPrefix = 'M2 필수 입력이 누락되었습니다:'

export const informationOr = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '정보 없음'
  if (value === true) return '예'
  if (value === false) return '아니요'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const priorityDisplay = (priority: ReviewPriority) =>
  priority.status === 'AVAILABLE'
    ? {
        state: '검토 우선순위 제공',
        detail: priority.label ?? '정보 없음',
      }
    : {
        state: '검토 우선순위 제공 불가',
        detail: priority.reason ?? '제공 불가 사유가 없습니다.',
      }

export const priorityReasonDisplay = (reason: string | null) => {
  if (!reason) {
    return { summary: '제공 불가 사유가 없습니다.', original: null }
  }

  if (!reason.startsWith(missingReasonPrefix)) {
    return { summary: reason, original: null }
  }

  const fields = reason
    .slice(missingReasonPrefix.length)
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean)
  const labels = fields.map((field) => missingFieldLabels[field] ?? field)

  return {
    summary: `검토 우선순위 산정에 필요한 값이 부족합니다: ${labels.join(', ')}`,
    original: reason,
  }
}

export const formatKoreanDateTime = (value: string) =>
  value.replace(/(T\d{2}:\d{2}:\d{2})\.\d+(?=(?:[+-]\d{2}:\d{2}|Z)$)/, '$1')

export const statusLabel = {
  priority: {
    AVAILABLE: '우선순위 제공',
    UNAVAILABLE: '우선순위 미제공',
  },
  search: {
    OK: '유사사례 있음',
    NO_PRECEDENT: '선례 부족',
    UNAVAILABLE: '검색 미제공',
  },
} as const

export const searchDisplay = (search: PrecedentSearch) => {
  if (search.status === 'OK') {
    return { kind: 'cases' as const, title: null, message: null }
  }

  return {
    kind: 'empty' as const,
    title:
      search.status === 'NO_PRECEDENT'
        ? '비교 가능한 선례 부족'
        : '유사사례 검색 결과를 제공할 수 없습니다',
    message:
      search.message && search.message !== '비교 가능한 선례 부족'
        ? search.message
        : null,
  }
}
