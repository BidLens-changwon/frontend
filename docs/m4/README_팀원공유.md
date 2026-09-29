# M4 프론트·백엔드 인터페이스 확정안 v1

기준: M1_통합본, M2_통합본 v3, M3_통합본. 지윤: 프론트/UX, 팀원: 분석 API/백엔드. 이 문서는 구현 계약이며 M3의 최종 채택 검색 방식은 `M3/02_search_cases.py`와 `M3_결과/M3_통합_최종검색결과.csv`다. `팀원안_원본`의 응답 예시는 비교 보존 자료이며 그대로 서비스 결과에 쓰지 않는다.

## 사용자 흐름

공고 초안 입력 → 사전 검토 요청 → M2 검토 우선순위와 M3 과거 사례 확인 → 입력 조건 수정 → 재조회. 나라장터 게시 기능은 만들지 않는다. 과거 사례는 업무 유사성과 조건 차이를 검토하는 근거이지 조건을 바꾸면 무응찰이 줄어든다는 뜻이 아니다.

## API

- `POST /api/v1/draft-reviews` (JSON UTF-8). 요청/정상 응답 `schema_version: "m4-review-v1"`.
- 로컬 프론트는 `VITE_API_BASE_URL`로 백엔드 기본 주소를 받고, 기본 개발 주소는 `http://127.0.0.1:8000`이다. 검토 요청 전에 `GET /ready`가 HTTP 200이고 `components.m1`, `components.m2`, `components.m3`가 모두 `true`인지 확인한다.
- 한 요청은 초안 하나. 수정 후 같은 API 재호출. 서버에 자동 저장하지 않음. 프론트에서 입력과 이전 결과를 보존하며 진행 중 요청은 취소할 수 있다.
- 프론트는 금액을 정수 원화, 시간을 `YYYY-MM-DDTHH:mm:ss+09:00` ISO 8601, 제한 여부를 boolean으로 보낸다. 알 수 없는 선택 필드는 `null`; 빈 문자열, `0`, `N`을 결측 대용으로 쓰지 않는다.
- `mode: "replay"`는 고정된 과거 시점 실험으로 `as_of`가 필수. `mode: "current"`는 서버 시각을 기준으로 하며 `as_of: null`. 백엔드가 유효 기준시점(`effective_as_of`)을 응답한다. 서버는 같은 공고의 후속 정보와 기준시점 이후 공고·첫 결과를 M3에서 제외한다.
- `draft.notice_id`, `notice_round`는 재현 실험의 자기참조 제외용으로 선택. 실제 미게시 초안은 둘 다 `null`. 고정 Q01 예시에는 원 공고번호가 있으나, 이 값이 학습 특징이나 화면상의 예측 근거가 되면 안 된다.

| draft 키 | 뜻 | 필수 | 형식 |
|---|---|---|---|
| `title` | 공고명 | 예 | 1~300자 |
| `bid_method` | 입찰방식 | 예 | `전자입찰`/`직찰`/`전자시담` |
| `organization` | 공고기관명 | 예 | 문자열 |
| `contract_method`, `award_method`, `service_type` | 계약방법·낙찰방법·용역구분 | 예 | 문자열 |
| `procurement_class_name`, `procurement_class_code` | 공공조달분류명·번호 | 이름 필수 | 코드 선택 문자열 |
| `estimated_price_krw`, `budget_krw` | 추정가격·배정예산 | 선택 | `null` 또는 0 이상 정수 |
| `bid_start_at`, `bid_close_at` | 입찰 시작·마감 | 예 | ISO 8601 한국시간; 시작 < 마감 |
| `industry_restricted`, `joint_region_restricted`, `registration_restricted` | 업종·공동수급지역·등록 제한 | 선택 | boolean 또는 null |
| `vat_krw`, `attachment_count` | 부가세·첨부 수 | 선택 | null 또는 0 이상 정수 |

프론트 입력 최소 화면에는 공고명, 방식, 기관, 계약·낙찰·용역 구분, 조달분류, 금액, 시작·마감, 두 제한 여부를 둔다. 나머지 선택 필드는 접거나 비워도 된다. 공고번호가 없는 사용자의 실제 초안도 입력 가능해야 한다. 값이 없으면 백엔드는 결측으로 처리하거나 모델 제공 불가 사유를 응답하며 임의의 0으로 치환했다고 가장하지 않는다.

## 정상 응답

`review`에는 실제 사용한 정규화 입력 `input`과 `model_version`, `priority`, `search`, `warnings`, `data_cutoff`를 포함한다. `data_cutoff`는 실제 사용한 자료의 가장 늦은 기록시각이며 `effective_as_of`와 다르다. 사용 자료가 없어 산정 불가능한 예시는 null로 표시한다. `priority.status`: `AVAILABLE`/`UNAVAILABLE`; `priority.label`: `우선검토`/`참고`/`일반` 또는 null. `priority.reference`는 비교 집단, 건수, 시점, 모델 버전을 명시한다. 신규 초안의 순위 또는 0~100 상대 점수는 비교 집단이 정해지고 동일 모형으로 산정된 경우에만 표시한다. 과거 2026년 223건 파일의 `검토순위`, `상대위험점수_0_100`을 신규 초안 점수로 복사하지 않는다. 모델이 준비되지 않았거나 방식이 직찰·전자시담이면 `UNAVAILABLE`, 점수·등급·순위 null, 사유 제공. 참가업체 수/개찰 결과는 M2 입력으로 보내거나 사용하지 않는다.

`search.status`: `OK`/`NO_PRECEDENT`/`UNAVAILABLE`. `OK`일 때 `cases` 1~5건, `NO_PRECEDENT`일 때 `cases: []`와 `message: "비교 가능한 선례 부족"`. 비교 부족은 오류가 아니다. 각 사례의 `notice_id`, `notice_round`, `title`, `task_type`, `similar_reason`, `different_conditions`, `first_bidder_count`, `opening_status`, `notice_url`, `notice_published_at`, `first_result_recorded_at`, `review_status`를 제공. 원문을 직접 읽지 않은 자동 결과의 `review_status`는 `잠정 판정·원문 확인 필요`. URL은 원자료의 나라장터 링크를 그대로 반환하고 조립해 만든 다른 링크나 실체 없는 결과 URL을 만들지 않는다. 출처 시점은 첫 결과 입력일시이며 실제 공개시각의 완전한 증명으로 표현하지 않는다. `opening_status`는 원자료 `첫개찰_상태`를 그대로 표시한다.

`warnings`에 항상 `공개된 과거 공고를 기준으로 한 상대적인 검토 우선순위입니다. 무응찰 발생확률이나 조건 변경 효과를 뜻하지 않습니다.`와 `유사 사례의 과업지시서 원문은 독립 검증 전입니다.`를 포함한다. 과거 사례의 첫 개찰 참가업체 수는 증거 표시 전용.

## 오류 및 상태

- `400 INVALID_REQUEST`: 형식/필수값/날짜 순서 오류. `details: [{field, message}]` 반환. 입력 보존.
- `422 UNSUPPORTED_AS_OF`: 재현 시점의 유효성 문제. 입력 보존.
- `503 ANALYSIS_UNAVAILABLE`: 분석 자료/모형 로딩 실패. 입력 보존 및 재시도 버튼.
- 오류 추적 ID는 `X-Request-ID` 응답 헤더 또는 `error.request_id`로 제공할 수 있으며 프론트는 사용자가 복사할 수 있게 표시한다.
- `200`과 `priority.status=UNAVAILABLE`: 방식 미지원 또는 기준시점의 학습 표본 부족. M3 검색은 가능한 범위에서 별도 처리.
- `200`과 `search.status=NO_PRECEDENT`: Q04/Q08 같은 비교 선례 부족. 빈 카드 대신 부족 안내.
- 외부 나라장터 링크 실패는 API 분석 실패와 구분. 링크 열림 자체는 사용자의 브라우저에서 외부 사이트 사정에 좌우됨.

## 구현/검증 순서

1. 아래 JSON 세 개를 프론트 mock/백엔드 계약 시험의 공통 샘플로 사용한다. `sample_success.json`의 Q01은 **M3 사례만 검증된 예시**이며 M2 점수는 임의 생성하지 않았다.
2. 프론트는 정상·선례 부족·미지원·오류·로딩 화면을 mock으로 구현하고 입력 수정 후 재조회가 되도록 한다.
3. 백엔드는 채택 M2 모형, M3 검색기를 연결한다. replay 모델은 `as_of` 이후 정답으로 학습하거나 미래 사례를 반환하지 않도록 검사한다. current에는 이용 가능한 전자입찰 모형을 적용한다.
4. 두 사람이 동일 샘플을 실제 API로 호출해 응답 필드, 원문 URL, 첫 개찰 업체 수, 시점 제한, 재조회, 오류를 대조한다. 문서 변경 시 버전과 양쪽 mock/테스트를 함께 갱신한다.
