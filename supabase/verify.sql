-- 선택 사항: setup.sql 실행 후 Supabase SQL Editor에서 전체 실행하세요.
-- Authentication > Users에 관리자 계정이 1명 이상 있어야 합니다.
-- SQL Editor의 기본 postgres 역할로 실행합니다.
-- 테스트 중 만든 데이터는 마지막 ROLLBACK으로 모두 취소됩니다.
-- 오류가 나면 같은 편집기에서 ROLLBACK; 을 실행하고 오류 내용을 확인하세요.

begin;

do $$
declare
  member_id uuid;
  member_two_id uuid;
  sample_id uuid;
  sample_item text := '__검증용 ' || gen_random_uuid()::text;
  korea_today date := (now() at time zone 'Asia/Seoul')::date;
  actual_date date;
  affected integer;
  row_count_before bigint;
  row_count_after bigint;
  denied boolean;
  test_case record;
begin
  select id into member_id from auth.users order by created_at limit 1;
  if member_id is null then
    raise exception '먼저 Authentication > Users에서 사용자 계정을 1명 이상 만드세요. 테스트 데이터는 저장되지 않았습니다.';
  end if;
  select id into member_two_id from auth.users where id <> member_id order by created_at limit 1;
  select count(*) into row_count_before from public.rentals;

  -- 브라우저의 비로그인 역할은 모든 작업이 권한 오류(42501)여야 합니다.
  perform set_config('request.jwt.claims', '{}', true);
  execute 'set local role anon';
  for test_case in select * from (values
    ('비로그인 조회', 'select * from public.rentals'),
    ('비로그인 등록', format('insert into public.rentals (item_name, borrower, rental_date, due_date) values (%L, %L, %L, %L)', sample_item, '검증자', korea_today, korea_today)),
    ('비로그인 반납', 'update public.rentals set returned_at = current_date where false'),
    ('비로그인 삭제', 'delete from public.rentals where false')
  ) as cases(test_name, statement)
  loop
    denied := false;
    begin
      execute test_case.statement;
    exception when insufficient_privilege then
      denied := true;
    end;
    if not denied then raise exception 'FAIL: %가 허용되었습니다.', test_case.test_name; end if;
    raise notice 'PASS: % 차단', test_case.test_name;
  end loop;
  execute 'reset role';

  -- 실제 사용자 UUID를 가진 로그인 세션을 흉내 냅니다.
  perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from public.rentals' into row_count_after;
  if row_count_before <> row_count_after then raise exception 'FAIL: 로그인 사용자의 공동 장부 조회 실패'; end if;
  raise notice 'PASS: 로그인 사용자 공동 조회';

  execute format('insert into public.rentals (item_name, borrower, rental_date, due_date) values (%L, %L, %L, %L) returning id', '  ' || sample_item || '  ', ' 검증자 ', korea_today, korea_today + 7) into sample_id;
  execute format('select count(*) from public.rentals where id = %L and item_name = %L and borrower = %L and created_by = %L and returned_at is null', sample_id, sample_item, '검증자', member_id) into row_count_after;
  if row_count_after <> 1 then raise exception 'FAIL: 등록·공백 정리·작성자 자동 저장 실패'; end if;
  raise notice 'PASS: 대여 등록 / 공백 정리 / 작성자 자동 저장';

  for test_case in select * from (values
    ('중복 대여', format('insert into public.rentals (item_name, borrower, rental_date, due_date) values (%L, %L, %L, %L)', upper(replace(sample_item, ' ', '   ')), '검증자', korea_today, korea_today), '23505'),
    ('미래 대여일', format('insert into public.rentals (item_name, borrower, rental_date, due_date) values (%L, %L, %L, %L)', sample_item || ' 미래', '검증자', korea_today + 1, korea_today + 2), '23514'),
    ('잘못된 예정일', format('insert into public.rentals (item_name, borrower, rental_date, due_date) values (%L, %L, %L, %L)', sample_item || ' 날짜', '검증자', korea_today, korea_today - 1), '23514'),
    ('빈 물품명', format('insert into public.rentals (item_name, borrower, rental_date, due_date) values (%L, %L, %L, %L)', '   ', '검증자', korea_today, korea_today), '23514'),
    ('작성자 위조', format('insert into public.rentals (item_name, borrower, rental_date, due_date, created_by) values (%L, %L, %L, %L, %L)', sample_item || ' 위조', '검증자', korea_today, korea_today, member_id), '42501'),
    ('등록과 동시 반납', format('insert into public.rentals (item_name, borrower, rental_date, due_date, returned_at) values (%L, %L, %L, %L, %L)', sample_item || ' 반납', '검증자', korea_today, korea_today, korea_today), '42501'),
    ('대여 정보 수정', format('update public.rentals set borrower = %L where id = %L', '다른 사람', sample_id), '42501'),
    ('기록 삭제', format('delete from public.rentals where id = %L', sample_id), '42501')
  ) as cases(test_name, statement, expected_state)
  loop
    denied := false;
    begin
      execute test_case.statement;
    exception when others then
      if sqlstate = test_case.expected_state then denied := true;
      else raise exception 'FAIL: % 예상 상태 %, 실제 상태 %, 오류 %', test_case.test_name, test_case.expected_state, sqlstate, sqlerrm;
      end if;
    end;
    if not denied then raise exception 'FAIL: %가 허용되었습니다.', test_case.test_name; end if;
    raise notice 'PASS: % 차단', test_case.test_name;
  end loop;

  -- 두 번째 계정이 있으면 다른 구성원도 반납할 수 있는지 함께 확인합니다.
  if member_two_id is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', member_two_id, 'role', 'authenticated')::text, true);
  end if;
  execute format('update public.rentals set returned_at = %L where id = %L returning returned_at', korea_today - 100, sample_id) into actual_date;
  if actual_date is distinct from korea_today then raise exception 'FAIL: 반납일이 DB 한국 오늘 날짜와 다릅니다.'; end if;
  raise notice 'PASS: 반납일 DB 강제 / %', case when member_two_id is null then '두 번째 계정이 없어 다른 구성원 반납 검사는 생략' else '다른 구성원도 반납 가능' end;

  execute format('update public.rentals set returned_at = %L where id = %L', korea_today + 1, sample_id);
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: 반납 완료 행의 재반납이 허용되었습니다.'; end if;
  execute format('update public.rentals set returned_at = null where id = %L', sample_id);
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: 반납 취소가 허용되었습니다.'; end if;
  raise notice 'PASS: 반납 완료 수정 / 반납 취소 차단';

  execute format('insert into public.rentals (item_name, borrower, rental_date, due_date) values (%L, %L, %L, %L)', sample_item, '재대여자', korea_today, korea_today + 7);
  execute format('select count(*) from public.rentals where item_name = %L', sample_item) into row_count_after;
  if row_count_after <> 2 then raise exception 'FAIL: 반납 후 재대여 또는 이력 보존 실패'; end if;
  raise notice 'PASS: 반납 후 재대여 / 물품별 이력 보존';
  execute 'reset role';
  raise notice '모든 검사가 통과했습니다. 마지막 ROLLBACK으로 테스트 기록을 취소합니다.';
exception when others then
  execute 'reset role';
  raise;
end;
$$;

rollback;
