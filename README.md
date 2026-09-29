# BidLens frontend

BidLens - 입찰 공고를 들여다보는 렌즈의 프론트엔드 프로젝트입니다.
공고 게시 전에 입력 가능한 정보를 바탕으로 검토를 지원합니다.

## 로컬 실행

Node.js와 npm을 설치한 뒤 저장소 루트에서 실행합니다.

### Windows PowerShell

```powershell
Copy-Item .env.example .env.local
notepad .env.local
npm.cmd install
npm.cmd run test
npm.cmd run dev
```

PowerShell 실행 정책에 따라 `npm` 스크립트가 차단되면 정책을 변경하지 않고 `npm.cmd`를 사용합니다. bash용 `source` 또는 `export` 명령은 PowerShell에서 실행하지 않습니다.

### macOS와 Linux

```bash
cp .env.example .env.local
npm install
npm run test
npm run dev
```

터미널에 표시되는 로컬 주소를 브라우저에서 열어 시작 화면을 확인합니다.

## API 설정

`.env.example`을 참고해 저장소 루트에 `.env.local`을 만들고 백엔드 기본 주소를 설정합니다.

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
```

값을 비워 두면 프론트와 같은 origin의 `/api/v1/draft-reviews`를 호출합니다. 환경변수에는 `/api/v1/draft-reviews` 경로를 포함하지 않습니다.

프론트는 검토 요청 전에 `${VITE_API_BASE_URL}/ready`를 확인합니다. 응답이 HTTP 200이고 `components.m1`, `components.m2`, `components.m3`가 모두 `true`인 경우에만 `POST /api/v1/draft-reviews`를 호출합니다. 준비 상태 확인이 실패해도 샘플 응답으로 대체하지 않습니다.

## 검증

```bash
npm run lint
npm run test
npm run build
```
