export function todayInSeoul(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function dayDifference(first, second) {
  return Math.round(
    (Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) /
      86400000,
  );
}
export function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}
export function isOverdue(row, today = todayInSeoul()) {
  return !row.returned_at && row.due_date < today;
}
export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function validateRental(input, rows = [], today = todayInSeoul()) {
  if (
    !normalizeName(input.item_name) ||
    normalizeName(input.item_name).length > 100
  )
    return "물품명을 1~100자로 입력해 주세요.";
  if (
    !normalizeName(input.borrower) ||
    normalizeName(input.borrower).length > 50
  )
    return "대여자를 1~50자로 입력해 주세요.";
  if (!isValidDate(input.rental_date) || !isValidDate(input.due_date))
    return "대여일과 반납 예정일을 확인해 주세요.";
  if (input.rental_date > today)
    return "대여일은 오늘 또는 이전 날짜로 입력해 주세요.";
  if (input.due_date < input.rental_date)
    return "반납 예정일은 대여일보다 빠를 수 없습니다.";
  const name = normalizeName(input.item_name).toLocaleLowerCase();
  if (
    rows.some(
      (r) =>
        !r.returned_at &&
        normalizeName(r.item_name).toLocaleLowerCase() === name,
    )
  )
    return "이미 대여 중인 물품입니다. 물품별 번호를 확인하거나 먼저 반납해 주세요.";
  return "";
}
export function filterRentals(rows, tab, query = "") {
  const term = normalizeName(query).toLocaleLowerCase();
  return rows.filter(
    (row) =>
      (tab === "active" ? !row.returned_at : !!row.returned_at) &&
      `${row.item_name} ${row.borrower}`.toLocaleLowerCase().includes(term),
  );
}
export function itemHistory(rows, name) {
  return rows
    .filter(
      (row) =>
        normalizeName(row.item_name).toLocaleLowerCase() ===
        normalizeName(name).toLocaleLowerCase(),
    )
    .sort(
      (a, b) =>
        b.rental_date.localeCompare(a.rental_date) ||
        b.created_at.localeCompare(a.created_at),
    );
}
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function friendlyError(error) {
  if (error?.code === "23505")
    return "다른 사용자가 먼저 대여했습니다. 새로 불러온 장부를 확인해 주세요.";
  if (error?.code === "42501")
    return "접근 권한이 없습니다. 다시 로그인하거나 관리자에게 문의해 주세요.";
  if (error?.code === "42P01" || error?.code === "PGRST205")
    return "장부 테이블이 없습니다. 관리자에게 Supabase 초기 설정을 요청해 주세요.";
  if (error?.message === "Invalid login credentials")
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (error?.message?.includes("Email not confirmed"))
    return "이메일 확인이 필요합니다. 관리자에게 계정 상태를 확인해 주세요.";
  if (/fetch|network/i.test(error?.message ?? ""))
    return "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
  return error?.message || "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
