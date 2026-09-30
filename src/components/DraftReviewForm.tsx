import {
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  checkApiReadiness,
  DraftReviewApiError,
  requestDraftReview,
} from '../api/draftReviewApi'
import { getDraftReviewFormField } from '../api/draftReviewFieldErrors'
import { toKoreanIso } from '../forms/dateTime'
import { DraftReviewResult } from './DraftReviewResult'
import {
  M4_SCHEMA_VERSION,
  type DraftReviewInput,
  type DraftReviewRequest,
  type DraftReviewResponse,
  type ReviewMode,
} from '../types/m4'

type NullableBoolean = '' | 'true' | 'false'

interface FormValues {
  mode: ReviewMode
  asOf: string
  topK: string
  noticeId: string
  noticeRound: string
  title: string
  bidMethod: DraftReviewInput['bid_method']
  organization: string
  contractMethod: string
  awardMethod: string
  serviceType: string
  procurementClassName: string
  procurementClassCode: string
  estimatedPriceKrw: string
  budgetKrw: string
  bidStartAt: string
  bidCloseAt: string
  industryRestricted: NullableBoolean
  jointRegionRestricted: NullableBoolean
  registrationRestricted: NullableBoolean
  vatKrw: string
  attachmentCount: string
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

interface SubmissionError {
  title: string
  message: string
  details: string[]
  requestId: string | null
}

interface DraftReviewFormProps {
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
}

const initialValues: FormValues = {
  mode: 'current',
  asOf: '',
  topK: '5',
  noticeId: '',
  noticeRound: '',
  title: '',
  bidMethod: '전자입찰',
  organization: '',
  contractMethod: '',
  awardMethod: '',
  serviceType: '',
  procurementClassName: '',
  procurementClassCode: '',
  estimatedPriceKrw: '',
  budgetKrw: '',
  bidStartAt: '',
  bidCloseAt: '',
  industryRestricted: '',
  jointRegionRestricted: '',
  registrationRestricted: '',
  vatKrw: '',
  attachmentCount: '',
}

const requiredFields: Array<[keyof FormValues, string]> = [
  ['title', '공고명을 입력해 주세요.'],
  ['organization', '공고기관명을 입력해 주세요.'],
  ['contractMethod', '계약방법을 입력해 주세요.'],
  ['awardMethod', '낙찰방법을 입력해 주세요.'],
  ['serviceType', '용역구분을 입력해 주세요.'],
  ['procurementClassName', '공공조달분류명을 입력해 주세요.'],
  ['bidStartAt', '입찰 시작일시를 입력해 주세요.'],
  ['bidCloseAt', '입찰 마감일시를 입력해 주세요.'],
]

const numberFields: Array<[keyof FormValues, string]> = [
  ['estimatedPriceKrw', '추정가격'],
  ['budgetKrw', '배정예산'],
  ['vatKrw', '부가세'],
  ['attachmentCount', '첨부 수'],
]

const toNullableNumber = (value: string) =>
  value.trim() === '' ? null : Number(value)

const toNullableBoolean = (value: NullableBoolean) =>
  value === '' ? null : value === 'true'

const displayValue = (value: unknown) => {
  if (value === null) return '입력하지 않음'
  if (value === true) return '예'
  if (value === false) return '아니요'
  return String(value)
}

const toSubmissionError = (error: unknown): SubmissionError => {
  if (!(error instanceof DraftReviewApiError)) {
    return {
      title: '검토 요청을 완료하지 못했습니다',
      message: '예상하지 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      details: [],
      requestId: null,
    }
  }

  const messages = {
    CONFIGURATION_ERROR: {
      title: 'API 주소 설정이 필요합니다',
      message: 'VITE_API_BASE_URL을 설정한 뒤 개발 서버를 다시 시작해 주세요.',
    },
    INVALID_REQUEST: {
      title: '입력 내용을 확인해 주세요',
      message: '서버가 요청 형식 또는 필수값 오류를 확인했습니다.',
    },
    UNSUPPORTED_AS_OF: {
      title: '선택한 기준시점을 사용할 수 없습니다',
      message: '재현 가능한 과거 시점인지 확인한 뒤 다시 요청해 주세요.',
    },
    ANALYSIS_UNAVAILABLE: {
      title: '현재 분석을 사용할 수 없습니다',
      message: '분석 자료 또는 모델을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    },
    NETWORK_ERROR: {
      title: '서버에 연결할 수 없습니다',
      message: '백엔드 실행 상태와 API 기본 주소를 확인해 주세요.',
    },
    INVALID_RESPONSE: {
      title: '서버 응답을 확인할 수 없습니다',
      message: '응답이 M4 계약과 일치하지 않습니다. 관리자에게 문의해 주세요.',
    },
    ABORTED: {
      title: '검토 요청이 취소되었습니다',
      message: '입력 내용은 유지됩니다.',
    },
  } satisfies Record<
    DraftReviewApiError['kind'],
    { title: string; message: string }
  >

  return {
    ...messages[error.kind],
    details: error.details.map(({ field, message }) => `${field}: ${message}`),
    requestId: error.requestId,
  }
}

function DraftReviewForm({ headingRef, onBack }: DraftReviewFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [request, setRequest] = useState<DraftReviewRequest | null>(null)
  const [result, setResult] = useState<DraftReviewResponse | null>(null)
  const [submissionError, setSubmissionError] =
    useState<SubmissionError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const requestControllerRef = useRef<AbortController | null>(null)

  const cancelRequest = () => {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setIsSubmitting(false)
  }

  useEffect(() => () => requestControllerRef.current?.abort(), [])

  const leaveReview = () => {
    cancelRequest()
    setSubmissionError(null)
    setResult(null)
    setRequest(null)
  }

  const leaveFlow = () => {
    cancelRequest()
    onBack()
  }

  const update = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const key = event.target.name as keyof FormValues
    const value = event.target.value
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSubmissionError(null)
  }

  const validate = () => {
    const nextErrors: FieldErrors = {}

    for (const [field, message] of requiredFields) {
      if (!values[field].trim()) nextErrors[field] = message
    }

    if (values.title.length > 300) {
      nextErrors.title = '공고명은 300자 이하로 입력해 주세요.'
    }

    if (values.mode === 'replay' && !values.asOf) {
      nextErrors.asOf = '재현 모드에서는 기준시점이 필요합니다.'
    }

    const topK = Number(values.topK)
    if (!Number.isInteger(topK) || topK < 1 || topK > 5) {
      nextErrors.topK = '유사사례 수는 1~5 사이의 정수여야 합니다.'
    }

    if (values.noticeRound && !/^\d{1,3}$/.test(values.noticeRound)) {
      nextErrors.noticeRound = '차수는 숫자 1~3자리로 입력해 주세요.'
    }

    for (const [field, label] of numberFields) {
      const rawValue = values[field]
      if (rawValue && (!/^\d+$/.test(rawValue) || Number(rawValue) < 0)) {
        nextErrors[field] = `${label}은 0 이상의 정수로 입력해 주세요.`
      }
    }

    if (
      values.bidStartAt &&
      values.bidCloseAt &&
      values.bidStartAt >= values.bidCloseAt
    ) {
      nextErrors.bidCloseAt = '마감일시는 시작일시보다 늦어야 합니다.'
    }

    setErrors(nextErrors)
    return nextErrors
  }

  const buildRequest = (): DraftReviewRequest => {
    const draft: DraftReviewInput = {
      notice_id: values.noticeId.trim() || null,
      notice_round: values.noticeRound
        ? values.noticeRound.padStart(3, '0')
        : null,
      title: values.title.trim(),
      bid_method: values.bidMethod,
      organization: values.organization.trim(),
      contract_method: values.contractMethod.trim(),
      award_method: values.awardMethod.trim(),
      service_type: values.serviceType.trim(),
      procurement_class_name: values.procurementClassName.trim(),
      procurement_class_code: values.procurementClassCode.trim() || null,
      estimated_price_krw: toNullableNumber(values.estimatedPriceKrw),
      budget_krw: toNullableNumber(values.budgetKrw),
      bid_start_at: toKoreanIso(values.bidStartAt),
      bid_close_at: toKoreanIso(values.bidCloseAt),
      industry_restricted: toNullableBoolean(values.industryRestricted),
      joint_region_restricted: toNullableBoolean(values.jointRegionRestricted),
      registration_restricted: toNullableBoolean(
        values.registrationRestricted,
      ),
      vat_krw: toNullableNumber(values.vatKrw),
      attachment_count: toNullableNumber(values.attachmentCount),
    }

    const common = {
      schema_version: M4_SCHEMA_VERSION,
      top_k: Number(values.topK),
      draft,
    }

    return values.mode === 'replay'
      ? {
          ...common,
          mode: 'replay',
          as_of: toKoreanIso(values.asOf),
        }
      : { ...common, mode: 'current', as_of: null }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate()

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = Object.keys(nextErrors)[0]
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstInvalidField}"]`)
        ?.focus()
      return
    }

    setRequest(buildRequest())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitReview = async () => {
    if (!request || isSubmitting) return

    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setSubmissionError(null)
    setResult(null)
    setIsSubmitting(true)

    try {
      await checkApiReadiness({ signal: controller.signal })
      const response = await requestDraftReview(request, {
        signal: controller.signal,
      })
      if (requestControllerRef.current !== controller) return
      setResult(response)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (
        requestControllerRef.current !== controller ||
        (error instanceof DraftReviewApiError && error.kind === 'ABORTED')
      ) {
        return
      }
      const nextSubmissionError = toSubmissionError(error)
      setSubmissionError(nextSubmissionError)

      if (
        error instanceof DraftReviewApiError &&
        error.kind === 'INVALID_REQUEST'
      ) {
        const mappedErrors: FieldErrors = {}
        for (const detail of error.details) {
          const field = getDraftReviewFormField(detail.field)
          if (field) mappedErrors[field] = detail.message
        }
        setErrors((current) => ({ ...current, ...mappedErrors }))
        setRequest(null)
        const firstField = Object.keys(mappedErrors)[0]
        if (firstField) {
          window.setTimeout(() => {
            formRef.current
              ?.querySelector<HTMLElement>(`[name="${firstField}"]`)
              ?.focus()
          }, 0)
        }
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null
        setIsSubmitting(false)
      }
    }
  }

  if (result) {
    return (
      <main className="app-shell">
        <AppHeader onBack={leaveFlow} />
        <DraftReviewResult response={result} onEdit={leaveReview} />
      </main>
    )
  }

  if (request) {
    const rows: Array<[string, unknown]> = [
      ['검토 기준', request.mode === 'current' ? '현재 시점' : '과거 시점 재현'],
      ['기준시점', request.as_of],
      ['유사사례 수', request.top_k],
      ['공고번호', request.draft.notice_id],
      ['공고차수', request.draft.notice_round],
      ['공고명', request.draft.title],
      ['입찰방식', request.draft.bid_method],
      ['공고기관명', request.draft.organization],
      ['계약방법', request.draft.contract_method],
      ['낙찰방법', request.draft.award_method],
      ['용역구분', request.draft.service_type],
      ['공공조달분류명', request.draft.procurement_class_name],
      ['공공조달분류번호', request.draft.procurement_class_code],
      ['추정가격', request.draft.estimated_price_krw],
      ['배정예산', request.draft.budget_krw],
      ['입찰 시작일시', request.draft.bid_start_at],
      ['입찰 마감일시', request.draft.bid_close_at],
      ['업종 제한', request.draft.industry_restricted],
      ['공동수급지역 제한', request.draft.joint_region_restricted],
      ['등록 제한', request.draft.registration_restricted],
      ['부가세', request.draft.vat_krw],
      ['첨부 수', request.draft.attachment_count],
    ]

    return (
      <main className="app-shell">
        <AppHeader onBack={leaveFlow} />
        <section className="review-page" aria-labelledby="review-title">
          <p className="step-label">요청 내용 확인</p>
          <h1 id="review-title">입력한 공고 초안을 확인해 주세요</h1>
          <p className="page-intro">
            아래 내용을 확인한 뒤 검토를 요청하세요.
          </p>
          <div className="review-card">
            <dl className="review-list">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{displayValue(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="review-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={leaveReview}
            >
              입력 내용 수정
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={isSubmitting}
              onClick={submitReview}
            >
              {isSubmitting ? '검토 요청 중…' : '검토 요청'}
            </button>
          </div>
          {submissionError && <RequestErrorPanel error={submissionError} />}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <AppHeader onBack={leaveFlow} />

      <section className="form-page" aria-labelledby="form-title">
        <div className="page-heading">
          <div>
            <p className="step-label">공고 초안 입력</p>
            <h1 id="form-title" ref={headingRef} tabIndex={-1}>
              검토할 공고 정보를 입력해 주세요
            </h1>
            <p className="page-intro">
              <span className="required-mark" aria-hidden="true">*</span> 표시는 필수 항목입니다. 선택 항목은 알 수 없다면 비워 두세요.
            </p>
          </div>
        </div>

        {submissionError && <RequestErrorPanel error={submissionError} />}

        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <fieldset className="form-section mode-section">
            <legend>검토 기준</legend>
            <div className="mode-options">
              <ModeCard mode="current" checked={values.mode === 'current'} onChange={update} title="현재 시점" description="서버의 현재 시각을 기준으로 검토" />
              <ModeCard mode="replay" checked={values.mode === 'replay'} onChange={update} title="과거 시점 재현" description="지정한 시점 이전 자료만 사용" />
            </div>
            <div className="field-grid compact-grid">
              {values.mode === 'replay' && (
                <Field label="기준시점" required error={errors.asOf} hint="한국시간 기준">
                  <input id="asOf" name="asOf" type="datetime-local" step="1" value={values.asOf} onChange={update} aria-invalid={Boolean(errors.asOf)} aria-describedby={errors.asOf ? 'asOf-error' : undefined} />
                </Field>
              )}
              <Field label="유사사례 수" error={errors.topK} hint="1~5건, 기본 5건">
                <input id="topK" name="topK" type="number" min="1" max="5" step="1" value={values.topK} onChange={update} aria-invalid={Boolean(errors.topK)} aria-describedby={errors.topK ? 'topK-error' : undefined} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>기본 정보</legend>
            <div className="field-grid">
              <Field label="공고명" required error={errors.title} wide hint={`${values.title.length}/300자`}>
                <input id="title" name="title" type="text" maxLength={300} value={values.title} onChange={update} placeholder="예: 2026년 공용차량 자동차보험 가입 용역" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined} />
              </Field>
              <Field label="입찰방식" required>
                <select id="bidMethod" name="bidMethod" value={values.bidMethod} onChange={update}>
                  <option>전자입찰</option><option>직찰</option><option>전자시담</option>
                </select>
              </Field>
              <Field label="공고기관명" required error={errors.organization}>
                <input id="organization" name="organization" type="text" value={values.organization} onChange={update} placeholder="예: 경상남도 창원시" aria-invalid={Boolean(errors.organization)} aria-describedby={errors.organization ? 'organization-error' : undefined} />
              </Field>
              <Field label="계약방법" required error={errors.contractMethod}>
                <input id="contractMethod" name="contractMethod" type="text" value={values.contractMethod} onChange={update} placeholder="예: 일반경쟁" aria-invalid={Boolean(errors.contractMethod)} aria-describedby={errors.contractMethod ? 'contractMethod-error' : undefined} />
              </Field>
              <Field label="낙찰방법" required error={errors.awardMethod}>
                <input id="awardMethod" name="awardMethod" type="text" value={values.awardMethod} onChange={update} placeholder="낙찰방법을 입력하세요" aria-invalid={Boolean(errors.awardMethod)} aria-describedby={errors.awardMethod ? 'awardMethod-error' : undefined} />
              </Field>
              <Field label="용역구분" required error={errors.serviceType}>
                <input id="serviceType" name="serviceType" type="text" value={values.serviceType} onChange={update} placeholder="예: 일반용역" aria-invalid={Boolean(errors.serviceType)} aria-describedby={errors.serviceType ? 'serviceType-error' : undefined} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>조달분류와 금액</legend>
            <div className="field-grid">
              <Field label="공공조달분류명" required error={errors.procurementClassName}>
                <input id="procurementClassName" name="procurementClassName" type="text" value={values.procurementClassName} onChange={update} placeholder="예: 자동차보험" aria-invalid={Boolean(errors.procurementClassName)} aria-describedby={errors.procurementClassName ? 'procurementClassName-error' : undefined} />
              </Field>
              <Field label="공공조달분류번호" hint="선택">
                <input id="procurementClassCode" name="procurementClassCode" type="text" value={values.procurementClassCode} onChange={update} placeholder="예: 84131503" />
              </Field>
              <NumberField id="estimatedPriceKrw" label="추정가격" value={values.estimatedPriceKrw} error={errors.estimatedPriceKrw} onChange={update} hint="원, 선택" />
              <NumberField id="budgetKrw" label="배정예산" value={values.budgetKrw} error={errors.budgetKrw} onChange={update} hint="원, 선택" />
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>입찰 일정</legend>
            <div className="field-grid">
              <Field label="입찰 시작일시" required error={errors.bidStartAt} hint="한국시간 기준">
                <input id="bidStartAt" name="bidStartAt" type="datetime-local" value={values.bidStartAt} onChange={update} aria-invalid={Boolean(errors.bidStartAt)} aria-describedby={errors.bidStartAt ? 'bidStartAt-error' : undefined} />
              </Field>
              <Field label="입찰 마감일시" required error={errors.bidCloseAt} hint="시작일시보다 이후">
                <input id="bidCloseAt" name="bidCloseAt" type="datetime-local" value={values.bidCloseAt} onChange={update} aria-invalid={Boolean(errors.bidCloseAt)} aria-describedby={errors.bidCloseAt ? 'bidCloseAt-error' : undefined} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>제한 조건</legend>
            <p className="section-help">모르는 항목은 ‘알 수 없음’으로 두세요.</p>
            <div className="field-grid three-columns">
              <BooleanField label="업종 제한" name="industryRestricted" value={values.industryRestricted} onChange={update} />
              <BooleanField label="공동수급지역 제한" name="jointRegionRestricted" value={values.jointRegionRestricted} onChange={update} />
              <BooleanField label="등록 제한" name="registrationRestricted" value={values.registrationRestricted} onChange={update} />
            </div>
          </fieldset>

          <details className="optional-section">
            <summary>추가 선택 정보</summary>
            <p>재현 실험이나 상세 검토에 필요한 경우에만 입력하세요.</p>
            <div className="field-grid">
              <Field label="공고번호" hint="선택">
                <input id="noticeId" name="noticeId" type="text" value={values.noticeId} onChange={update} placeholder="예: R26BK01259225" />
              </Field>
              <Field label="공고차수" error={errors.noticeRound} hint="선택, 숫자 1~3자리">
                <input id="noticeRound" name="noticeRound" type="text" inputMode="numeric" maxLength={3} value={values.noticeRound} onChange={update} placeholder="예: 0" aria-invalid={Boolean(errors.noticeRound)} aria-describedby={errors.noticeRound ? 'noticeRound-error' : undefined} />
              </Field>
              <NumberField id="vatKrw" label="부가세" value={values.vatKrw} error={errors.vatKrw} onChange={update} hint="원, 선택" />
              <NumberField id="attachmentCount" label="첨부 수" value={values.attachmentCount} error={errors.attachmentCount} onChange={update} hint="선택" />
            </div>
          </details>

          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={onBack}>처음으로</button>
            <button className="primary-button" type="submit">요청 내용 확인 <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
    </main>
  )
}

function RequestErrorPanel({ error }: { error: SubmissionError }) {
  return (
    <div className="request-error" role="alert">
      <strong>{error.title}</strong>
      <p>{error.message}</p>
      {error.details.length > 0 && (
        <ul>
          {error.details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      )}
      {error.requestId && (
        <label className="request-id">
          <span>요청 ID</span>
          <input
            aria-label="요청 ID"
            readOnly
            value={error.requestId}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </div>
  )
}

function AppHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={onBack}>
        <span className="brand-wordmark">
          <strong>BidLens</strong>
          <span>- 입찰 공고를 들여다보는 렌즈</span>
        </span>
      </button>
    </header>
  )
}

function ModeCard({ mode, checked, onChange, title, description }: { mode: ReviewMode; checked: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; title: string; description: string }) {
  return (
    <label className={checked ? 'mode-card selected' : 'mode-card'}>
      <input type="radio" name="mode" value={mode} checked={checked} onChange={onChange} />
      <span><strong>{title}</strong><small>{description}</small></span>
    </label>
  )
}

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  wide?: boolean
  children: ReactNode
}

function Field({ label, required, error, hint, wide, children }: FieldProps) {
  const child = children as ReactElement<{ id?: string }>
  const fieldId = child.props.id
  return (
    <div className={`field${wide ? ' field-wide' : ''}`}>
      <div className="field-label-row">
        <label htmlFor={fieldId}>{label}{required && <span className="required-mark" aria-label="필수">*</span>}</label>
        {hint && <span>{hint}</span>}
      </div>
      {children}
      {error && <p className="field-error" id={`${fieldId}-error`} role="alert">{error}</p>}
    </div>
  )
}

function NumberField({ id, label, value, error, onChange, hint }: { id: keyof FormValues; label: string; value: string; error?: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; hint: string }) {
  return (
    <Field label={label} error={error} hint={hint}>
      <input id={id} name={id} type="number" min="0" step="1" inputMode="numeric" value={value} onChange={onChange} placeholder="0 이상의 정수" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
    </Field>
  )
}

function BooleanField({ label, name, value, onChange }: { label: string; name: keyof FormValues; value: NullableBoolean; onChange: (event: ChangeEvent<HTMLSelectElement>) => void }) {
  return (
    <Field label={label} hint="선택">
      <select id={name} name={name} value={value} onChange={onChange}>
        <option value="">알 수 없음</option>
        <option value="true">예</option>
        <option value="false">아니요</option>
      </select>
    </Field>
  )
}

export default DraftReviewForm
