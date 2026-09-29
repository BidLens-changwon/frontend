import type { ReactNode } from 'react'
import type {
  DraftReviewInput,
  DraftReviewResponse,
  PrecedentCase,
  ReviewPriority,
} from '../types/m4'
import {
  informationOr,
  formatKoreanDateTime,
  priorityDisplay,
  priorityReasonDisplay,
  searchDisplay,
  statusLabel,
} from '../result/reviewPresentation'

interface DraftReviewResultProps {
  response: DraftReviewResponse
  onEdit: () => void
}

const inputLabels: Array<[keyof DraftReviewInput, string]> = [
  ['notice_id', '공고번호'],
  ['notice_round', '공고차수'],
  ['title', '공고명'],
  ['bid_method', '입찰방식'],
  ['organization', '공고기관명'],
  ['contract_method', '계약방법'],
  ['award_method', '낙찰방법'],
  ['service_type', '용역구분'],
  ['procurement_class_name', '공공조달분류명'],
  ['procurement_class_code', '공공조달분류번호'],
  ['estimated_price_krw', '추정가격'],
  ['budget_krw', '배정예산'],
  ['bid_start_at', '입찰 시작일시'],
  ['bid_close_at', '입찰 마감일시'],
  ['industry_restricted', '업종 제한'],
  ['joint_region_restricted', '공동수급지역 제한'],
  ['registration_restricted', '등록 제한'],
  ['vat_krw', '부가세'],
  ['attachment_count', '첨부 수'],
]

const moneyFields = new Set<keyof DraftReviewInput>([
  'estimated_price_krw',
  'budget_krw',
  'vat_krw',
])

const coreInputKeys = new Set<keyof DraftReviewInput>([
  'title',
  'bid_method',
  'organization',
  'procurement_class_name',
  'estimated_price_krw',
  'budget_krw',
  'bid_start_at',
  'bid_close_at',
])

const dateTimeInputKeys = new Set<keyof DraftReviewInput>([
  'bid_start_at',
  'bid_close_at',
])

const referenceLabels: Record<string, string> = {
  cohort: '비교집단',
  historical_count: '과거 공고 수',
  ranked_count: '순위 산정 건수',
  effective_as_of: '산정 기준시점',
  model_version: '모델 버전',
  model_role: '모델 역할',
  training_period: '학습 기간',
  training_data_cutoff: '학습자료 마감시점',
}

function DefinitionGrid({ children }: { children: ReactNode }) {
  return <dl className="result-definition-grid">{children}</dl>
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function PriorityPanel({ priority }: { priority: ReviewPriority }) {
  const display = priorityDisplay(priority)

  if (priority.status === 'UNAVAILABLE') {
    const reason = priorityReasonDisplay(priority.reason)
    return (
      <section className="result-panel priority-panel" aria-labelledby="priority-title">
        <div className="result-section-heading">
          <div>
            <p className="section-eyebrow">M2 검토 우선순위</p>
            <h2 id="priority-title">{display.state}</h2>
          </div>
          <span className="status-badge status-muted">
            {statusLabel.priority.UNAVAILABLE}
          </span>
        </div>
        <p className="unavailable-reason">{reason.summary}</p>
        {reason.original && (
          <details className="reason-details">
            <summary>서버 원문 사유 확인</summary>
            <p>{reason.original}</p>
          </details>
        )}
        <p className="section-footnote">
          제공되지 않은 점수·등급·순위는 0으로 대체하지 않습니다.
        </p>
      </section>
    )
  }

  const referenceEntries = Object.entries(priority.reference ?? {})

  return (
    <section className="result-panel priority-panel" aria-labelledby="priority-title">
      <div className="result-section-heading">
        <div>
          <p className="section-eyebrow">M2 검토 우선순위</p>
          <h2 id="priority-title">{display.detail}</h2>
        </div>
        <span className="status-badge status-ready">
          {statusLabel.priority.AVAILABLE}
        </span>
      </div>
      <DefinitionGrid>
        <Definition label="검토 우선순위" value={informationOr(priority.label)} />
        <Definition
          label="상대점수"
          value={priority.relative_score === null ? '정보 없음' : `${priority.relative_score} / 100`}
        />
        <Definition label="비교집단 내 순번" value={informationOr(priority.rank)} />
      </DefinitionGrid>
      <div className="reference-block">
        <h3>비교 기준</h3>
        {referenceEntries.length > 0 ? (
          <DefinitionGrid>
            {referenceEntries.map(([key, value]) => (
              <Definition
                key={key}
                label={referenceLabels[key] ?? key}
                value={
                  key.includes('as_of') || key.includes('cutoff')
                    ? formatKoreanDateTime(informationOr(value))
                    : informationOr(value)
                }
              />
            ))}
          </DefinitionGrid>
        ) : (
          <p className="empty-copy">정보 없음</p>
        )}
      </div>
      <p className="section-footnote">
        상대점수는 같은 비교집단 안의 검토 우선순위이며 무응찰 확률이 아닙니다.
      </p>
    </section>
  )
}

function CaseCard({ item }: { item: PrecedentCase }) {
  return (
    <article className="precedent-card">
      <div className="precedent-rank" aria-label={`반환 순서 ${item.rank}`}>
        {String(item.rank).padStart(2, '0')}
      </div>
      <div className="precedent-content">
        <div className="precedent-heading">
          <div>
            <p>{item.task_type}</p>
            <h3>{item.title}</h3>
          </div>
          <span className="review-status">{item.review_status}</span>
        </div>
        <DefinitionGrid>
          <Definition label="공고번호·차수" value={`${item.notice_id} · ${item.notice_round}`} />
          <Definition label="첫 개찰 상태" value={informationOr(item.opening_status)} />
          <Definition label="첫 개찰 참가업체 수" value={informationOr(item.first_bidder_count)} />
          <Definition label="공고 기록시각" value={formatKoreanDateTime(item.notice_published_at)} />
          <Definition label="첫 결과 기록시각" value={formatKoreanDateTime(item.first_result_recorded_at)} />
        </DefinitionGrid>
        <div className="case-evidence">
          <div>
            <h4>유사 근거</h4>
            <p>{item.similar_reason}</p>
          </div>
          <div>
            <h4>조건 차이</h4>
            <p>{item.different_conditions}</p>
          </div>
        </div>
        {item.notice_url && (
          <a
            className="source-link"
            href={item.notice_url}
            target="_blank"
            rel="noreferrer"
          >
            원문 근거 열기 <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </article>
  )
}

function SearchPanel({ review }: { review: DraftReviewResponse['review'] }) {
  const { search } = review
  const display = searchDisplay(search)

  return (
    <section className="result-section" aria-labelledby="precedent-title">
      <div className="result-section-heading search-heading">
        <div>
          <p className="section-eyebrow">M3 과거 유사사례</p>
          <h2 id="precedent-title">검토 참고자료</h2>
        </div>
        <span className={`status-badge ${search.status === 'OK' ? 'status-ready' : 'status-muted'}`}>
          {statusLabel.search[search.status]}
        </span>
      </div>
      {display.kind === 'cases' ? (
        <div className="precedent-list">
          {search.cases.map((item) => (
            <CaseCard key={`${item.notice_id}-${item.notice_round}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty-state" role="status">
          <strong>{display.title}</strong>
          {display.message && <p>{display.message}</p>}
        </div>
      )}
      <p className="section-footnote">
        과거 유사사례는 검토 참고자료이며 조건 변경 효과의 증거가 아닙니다.
      </p>
    </section>
  )
}

function InputPanel({ input }: { input: DraftReviewInput }) {
  const renderInputDefinition = ([key, label]: [keyof DraftReviewInput, string]) => {
    const value = input[key]
    const rendered =
      moneyFields.has(key) && typeof value === 'number'
        ? `${new Intl.NumberFormat('ko-KR').format(value)}원`
        : dateTimeInputKeys.has(key) && typeof value === 'string'
          ? formatKoreanDateTime(value)
          : informationOr(value)
    return <Definition key={key} label={label} value={rendered} />
  }
  const coreFields = inputLabels.filter(([key]) => coreInputKeys.has(key))
  const detailFields = inputLabels.filter(([key]) => !coreInputKeys.has(key))

  return (
    <section className="result-panel input-panel" aria-labelledby="normalized-input-title">
      <div className="result-section-heading">
        <div>
          <p className="section-eyebrow">서버 정규화 입력</p>
          <h2 id="normalized-input-title">분석에 사용된 공고 정보</h2>
        </div>
      </div>
      <p className="section-description">
        아래 값은 사용자가 입력한 원문이 아니라 서버가 분석에 실제 사용한 정규화 값입니다.
      </p>
      <DefinitionGrid>
        {coreFields.map(renderInputDefinition)}
      </DefinitionGrid>
      <details className="input-details">
        <summary>상세 입력값 확인</summary>
        <DefinitionGrid>{detailFields.map(renderInputDefinition)}</DefinitionGrid>
      </details>
    </section>
  )
}

export function DraftReviewResult({ response, onEdit }: DraftReviewResultProps) {
  const { review } = response

  return (
    <section className="result-page" aria-labelledby="result-title">
      <div className="result-hero">
        <p className="step-label">검토 결과</p>
        <h1 id="result-title">{review.input_title}</h1>
        <p>
          게시 전 공고 초안을 기준으로 검토 우선순위와 과거 유사사례를 확인했습니다.
        </p>
        <div className="time-summary">
          <div>
            <span>조회 기준시점</span>
            <strong>{formatKoreanDateTime(review.effective_as_of)}</strong>
            <small>이 시점 이전 범위에서 분석했습니다.</small>
          </div>
          <div>
            <span>사용 자료의 최종 기록시점</span>
            <strong>
              {review.data_cutoff
                ? formatKoreanDateTime(review.data_cutoff)
                : '정보 없음'}
            </strong>
            <small>실제 사용한 자료 중 가장 늦은 기록시점입니다.</small>
          </div>
        </div>
      </div>

      <div className="result-layout">
        <div className="result-main">
          <PriorityPanel priority={review.priority} />
          <SearchPanel review={review} />
          <InputPanel input={review.input} />
        </div>
        <aside className="result-aside" aria-labelledby="warning-title">
          <div className="warning-panel">
            <p className="section-eyebrow">해석 시 유의사항</p>
            <h2 id="warning-title">반드시 확인해 주세요</h2>
            <ol>
              {review.warnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ol>
          </div>
          <button className="secondary-button result-edit-button" type="button" onClick={onEdit}>
            입력 수정 후 재검토
          </button>
        </aside>
      </div>
    </section>
  )
}
