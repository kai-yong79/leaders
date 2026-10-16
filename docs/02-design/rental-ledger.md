# 공용물품 대여 장부 설계

- 단일 부서 장부. 관리자가 Supabase Auth에서 만든 이메일/비밀번호 계정만 로그인. 공개 회원가입 끄기.
- 로그인 전에는 장부 데이터 숨김. 구성원 모두 등록/조회/반납 가능. 삭제/내용수정 기능 없음.
- React 없이 Vite + JavaScript, Supabase JS SDK. GitHub 저장, Vercel 정적 빌드, Supabase DB/Auth.
- rentals: item_name, borrower, rental_date, due_date, returned_at, created_by, created_at, id.
- 대여 중/반납 완료 탭, 검색, 물품별 전체 이력 모달, 통계 카드, 새로 불러오기.
- 한국(Asia/Seoul) 날짜. 예정일 당일까지 정상, 다음 날부터 연체. 반납일은 DB가 오늘로 강제.
- 물품 이름은 개별 물품 식별자 역할. 여러 노트북은 노트북 01/02처럼 구분. DB에서 동시 중복 대여 차단.
- 등록/반납 성공 후 서버 데이터를 재조회. 반납 확인 모달, 중복 클릭 차단, 빈 화면/오류/로딩 처리.
- 환경변수 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY. 미설정 시 연결 안내와 메모리 전용 체험 모드.
- 체험 모드는 실제 로그인/DB 저장 없음, 새로고침 시 초기화. 운영 연결과 명확히 구분.
- 이름/대여자 등 사용자 입력은 textContent로 출력해 스크립트 삽입 차단.
- npm cache/브라우저 프로필/스크린샷 등 생성물도 프로젝트 내부. 비밀키/환경파일은 Git 제외.
- 검증: 날짜/검색/검증 로직 Node 테스트, Vite build, 브라우저에서 체험 등록/반납/탭/이력/모바일.
- 실제 Supabase 계정/키 미제공 시 실DB/인증/RLS 검증은 별도 실행 필요. SQL 검증 파일 제공.
