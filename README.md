# 공용물품 대여 장부 — 모두의 물품

부서 공용물품을 누가 빌렸고 언제 돌려줄지 함께 보는 웹앱입니다.

GitHub 저장소: [kai-yong79/leaders](https://github.com/kai-yong79/leaders)

**주인님, 처음에는 아래 순서대로 따라 하세요.**

- 먼저 필요한 SQL: [supabase/setup.sql](supabase/setup.sql)
- 단계별 전체 안내: [docs/시작부터_배포까지.md](docs/시작부터_배포까지.md)
- 배포 후 확인표: [docs/확인표.md](docs/확인표.md)

## 먼저 알아둘 것

GitHub는 **코드 보관함**, Vercel은 **웹사이트 주소를 만드는 곳**, Supabase는 **로그인과 장부 데이터를 보관하는 곳**입니다.

완성된 코드와 설정 파일은 준비되어 있습니다. 실제 온라인 서비스로 사용하려면 본인 계정에서 GitHub 저장소·Vercel 프로젝트·Supabase 프로젝트를 만들고 주소/공개용 키를 연결해야 합니다.

## 내 컴퓨터에서 먼저 보기

VS Code에서 `C:\project\leader4` 폴더를 열고, 메뉴 **터미널 → 새 터미널**에서 실행합니다. 명령을 한 줄씩 입력하고 Enter를 누르세요.

```powershell
cd C:\project\leader4
npm.cmd install
npm.cmd run dev
```

터미널에 표시된 `http://127.0.0.1:5173` 주소를 엽니다. **체험 장부 열어보기**를 누르면 가상 데이터로 등록·반납·검색·이력을 확인할 수 있습니다. 체험 데이터는 실제 DB에 저장되지 않고 새로고침 시 초기화됩니다. 서버를 끄려면 터미널에서 `Ctrl+C`를 누릅니다.

HTML 파일 더블클릭 대신 위 명령으로 실행하세요. 이 앱은 환경변수를 읽고 빌드하는 Vite 프로젝트입니다.

## 기능

- 이메일·비밀번호 로그인, 로그인 유지, 로그아웃
- 물품명·대여자·대여일·반납 예정일로 대여 등록
- 대여 중 / 반납 완료 탭과 물품명·대여자 검색
- 반납 확인 후 한국 시간 오늘 날짜를 DB에 저장
- 예정일 다음 날부터 빨간색 연체 표시
- 물품명을 누르면 해당 물품의 전체 대여 이력 표시
- 같은 개별 물품의 중복 대여를 DB에서도 차단
- 모바일 화면, 로딩·빈 목록·오류·재시도 처리

로그인한 부서 구성원은 공동 장부를 조회·등록·반납할 수 있습니다. 등록자 본인만 사용하는 개인 장부가 아닙니다. 관리자 계정은 앱의 별도 역할이 아니라 Supabase 대시보드에서 계정을 발급하는 운영자를 말합니다. 물품 이름이 개별 물품 구분 기준입니다. 같은 노트북이 두 대면 `노트북 01`, `노트북 02`로 등록하세요. 잘못 입력한 기록의 편집·삭제는 현재 화면에서 지원하지 않습니다.

## Supabase 연결 값

프로젝트 폴더의 `.env.example`을 복사하여 같은 위치에 `.env.local`을 만들고 값을 입력합니다. 예제의 문구 대신 본인 프로젝트 값을 넣으세요.

```dotenv
VITE_SUPABASE_URL=https://내프로젝트주소.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_내공개용키
```

로컬 서버를 껐다가 다시 켭니다. Vercel에서는 같은 변수 2개를 **Settings → Environment Variables**에 입력한 후 **Redeploy**합니다.

`VITE_` 변수는 빌드 후 브라우저에 포함됩니다. 환경변수로 관리해도 공개용 키가 비밀이 되는 것은 아닙니다. **Publishable** 키만 사용하고 `Secret`, `service_role`, DB 비밀번호는 넣지 마세요. 구형 프로젝트의 `anon` 키도 지원하지만 새 연결은 Publishable 키를 사용하세요. 실제 접근 제한은 SQL의 RLS와 컬럼 권한으로 적용합니다.

## SQL과 권한

`supabase/setup.sql` 전체를 Supabase **SQL Editor**에 붙여넣고 실행합니다. 다른 앱 테이블은 변경하지 않고, 이 앱의 `rentals` 테이블·트리거·정책·권한을 만듭니다. 같은 앱에 다시 실행해도 대여 기록을 지우지 않습니다. 다른 구조의 기존 `rentals` 테이블이 있다면 별도 프로젝트에서 시작하세요.

| 컬럼 | 뜻 |
| --- | --- |
| `id` | DB가 만드는 기록 ID |
| `item_name` | 개별 물품명 |
| `borrower` | 대여자 이름 |
| `rental_date` | 대여일 |
| `due_date` | 반납 예정일 |
| `returned_at` | 반납일, 대여 중이면 비어 있음 |
| `created_by` | 등록한 로그인 계정 ID, DB 자동 기록 |
| `created_at` | 등록 시각, DB 자동 기록 |

| 사용자 | 조회 | 등록 | 반납 | 내용 변경·삭제 |
| --- | --- | --- | --- | --- |
| 비로그인 | 불가 | 불가 | 불가 | 불가 |
| 로그인한 부서 구성원 | 전체 | 가능 | 전체 미반납 기록 | 불가 |

반납일은 PC의 날짜가 아니라 DB가 `Asia/Seoul` 기준으로 결정합니다. `UPDATE`는 `returned_at` 컬럼만 가능하며 한 번 반납한 기록은 다시 변경할 수 없습니다.

## 개발 명령

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:ui
```

`test:ui`는 설치된 Edge 또는 Chrome으로 임시 서버를 실행하고 화면을 검사합니다. 테스트 브라우저 프로필과 스크린샷은 `.cache/`, `artifacts/`에 저장하며 Git에는 올리지 않습니다. 설치 경로가 다르면 `LEDGER_BROWSER_PATH` 환경변수로 실행 파일을 지정하세요.

## 파일 구조

```text
src/main.js          화면, 로그인, 대여 등록·반납, 이력
src/domain.js        한국 날짜, 입력 검증, 검색
src/supabase.js      환경변수 및 Supabase 연결
src/style.css       PC·모바일 화면
supabase/setup.sql  테이블·RLS·권한·DB 업무 규칙
supabase/verify.sql Supabase SQL Editor용 검증(마지막 롤백)
docs/               설치·배포 안내, 설계, 확인표
.env.example        환경변수 양식
vercel.json         Vercel 배포 설정
```

## 참고한 공식 문서

- [GitHub에 기존 프로젝트 올리기](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)
- [Vercel의 Vite 프로젝트 배포](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel 환경변수 설정 후 재배포](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables)
- [Supabase 공개용 키](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase 회원가입 설정](https://supabase.com/docs/guides/auth/general-configuration)

대시보드 메뉴 이름은 바뀔 수 있습니다. 메뉴 위치가 다르면 위 기능 이름으로 찾으세요.
