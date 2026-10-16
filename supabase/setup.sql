-- 공용물품 대여 장부 / Supabase SQL Editor에서 전체 실행
-- 이 앱은 한 부서가 함께 쓰는 장부입니다. 로그인한 모든 사용자가
-- 모든 대여 이력을 보고, 대여를 등록하고, 다른 사람의 물품도 반납할 수 있습니다.
-- 먼저 Authentication 설정에서 신규 공개 회원가입을 끄고 관리자가 계정을 만드세요.
-- 기존 대여 데이터는 삭제하지 않습니다. 실패하면 트랜잭션 전체가 취소됩니다.

begin;

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  borrower text not null,
  rental_date date not null,
  due_date date not null,
  returned_at date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint rentals_item_name_length check (char_length(item_name) between 1 and 100),
  constraint rentals_borrower_length check (char_length(borrower) between 1 and 60),
  constraint rentals_due_after_rental check (due_date >= rental_date),
  constraint rentals_return_after_rental check (returned_at is null or returned_at >= rental_date)
);

comment on table public.rentals is '부서 공동 대여 장부. 인증 사용자만 조회·등록·반납 가능';
comment on column public.rentals.due_date is '반납 예정일. 한국 오늘 날짜보다 이전이고 미반납이면 연체';
comment on column public.rentals.returned_at is '실제 반납일. 반납 처리 시 DB가 한국 오늘 날짜로 저장';

-- 등록 내용을 정리하고 반납일 조작을 막습니다. SECURITY INVOKER가 기본값입니다.
-- 기존 등록 정보 변경이나 반납 취소·재반납은 지원하지 않습니다.
create or replace function public.enforce_rental_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  korea_today date := (pg_catalog.now() at time zone 'Asia/Seoul')::date;
begin
  if tg_op = 'INSERT' then
    new.item_name := pg_catalog.btrim(pg_catalog.regexp_replace(new.item_name, '[[:space:]]+', ' ', 'g'));
    new.borrower := pg_catalog.btrim(pg_catalog.regexp_replace(new.borrower, '[[:space:]]+', ' ', 'g'));
    if new.rental_date > korea_today then
      raise exception using errcode = '23514', message = '대여일은 오늘 이후로 지정할 수 없습니다.';
    end if;
    if new.returned_at is not null then
      raise exception using errcode = '23514', message = '새 대여 기록의 반납일은 비어 있어야 합니다.';
    end if;
    if auth.uid() is null or new.created_by is distinct from auth.uid() then
      raise exception using errcode = '42501', message = '로그인한 사용자가 대여를 등록해야 합니다.';
    end if;
    new.created_at := pg_catalog.now();
  else
    if old.returned_at is not null then
      raise exception using errcode = '23514', message = '이미 반납 완료한 기록입니다.';
    end if;
    if row(new.id, new.item_name, new.borrower, new.rental_date, new.due_date, new.created_by, new.created_at)
      is distinct from row(old.id, old.item_name, old.borrower, old.rental_date, old.due_date, old.created_by, old.created_at) then
      raise exception using errcode = '42501', message = '대여 기록은 반납 처리만 할 수 있습니다.';
    end if;
    -- 클라이언트가 보낸 날짜 대신 DB의 한국 오늘 날짜를 저장합니다.
    new.returned_at := korea_today;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_rental_lifecycle() from public, anon, authenticated;
drop trigger if exists rentals_lifecycle on public.rentals;
create trigger rentals_lifecycle
before insert or update on public.rentals
for each row execute function public.enforce_rental_lifecycle();

-- 대소문자·앞뒤/연속 공백 차이를 무시합니다.
-- 같은 물품의 동시 등록도 DB가 차단합니다. 반납 후에는 같은 물품을 다시 빌릴 수 있습니다.
-- 같은 모델의 실물 여러 대는 '노트북 01', '노트북 02'처럼 구별해 등록하세요.
create unique index if not exists rentals_one_active_item
on public.rentals (lower(btrim(regexp_replace(item_name, '[[:space:]]+', ' ', 'g'))))
where returned_at is null;
create index if not exists rentals_rental_date_idx on public.rentals (rental_date desc, created_at desc);
create index if not exists rentals_item_history_idx on public.rentals (item_name, rental_date desc);

alter table public.rentals enable row level security;

-- 이 앱이 소유한 rentals의 예전 정책을 제거하여 넓은 정책이 남지 않게 합니다.
-- 다른 테이블의 정책/권한은 변경하지 않습니다.
do $$
declare existing_policy record;
begin
  for existing_policy in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'rentals'
  loop
    execute format('drop policy %I on public.rentals', existing_policy.policyname);
  end loop;
end;
$$;

-- RLS와 별개로 SQL 권한을 제한합니다. service_role 키는 앱에 넣지 마세요.
revoke all on table public.rentals from public, anon, authenticated;
-- 과거에 컬럼 단위 권한을 부여한 경우도 제거합니다.
revoke all (id, item_name, borrower, rental_date, due_date, returned_at, created_by, created_at)
on table public.rentals from public, anon, authenticated;
grant select on public.rentals to authenticated;
grant insert (item_name, borrower, rental_date, due_date) on public.rentals to authenticated;
grant update (returned_at) on public.rentals to authenticated;

create policy rentals_read_authenticated on public.rentals
for select to authenticated using ((select auth.uid()) is not null);

create policy rentals_insert_authenticated on public.rentals
for insert to authenticated
with check ((select auth.uid()) = created_by and returned_at is null);

create policy rentals_return_authenticated on public.rentals
for update to authenticated
using ((select auth.uid()) is not null and returned_at is null)
with check ((select auth.uid()) is not null and returned_at = (now() at time zone 'Asia/Seoul')::date);

-- DELETE 정책/권한 없음: 브라우저에서는 기록을 지울 수 없습니다.
notify pgrst, 'reload schema';
commit;
