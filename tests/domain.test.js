import test from "node:test";
import assert from "node:assert/strict";
import {
  todayInSeoul,
  addDays,
  dayDifference,
  normalizeName,
  isOverdue,
  validateRental,
  filterRentals,
  itemHistory,
  escapeHtml,
  isValidDate,
} from "../src/domain.js";
const today = "2026-10-16";
const row = {
  id: "1",
  item_name: "노트북 01",
  borrower: "김민지",
  rental_date: "2026-10-15",
  due_date: today,
  returned_at: null,
  created_at: "2026-10-15T00:00:00Z",
};
test("한국 자정 경계는 UTC 날짜와 다르게 계산한다", () => {
  assert.equal(todayInSeoul(new Date("2026-10-15T14:59:59Z")), "2026-10-15");
  assert.equal(todayInSeoul(new Date("2026-10-15T15:00:00Z")), today);
});
test("월말과 윤년의 날짜를 계산한다", () => {
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(dayDifference("2026-09-30", today), 16);
});
test("예정일 당일은 정상이고 다음 날부터 연체, 반납 완료는 제외", () => {
  assert.equal(isOverdue(row, today), false);
  assert.equal(isOverdue(row, "2026-10-17"), true);
  assert.equal(isOverdue({ ...row, returned_at: today }, "2026-10-17"), false);
});
test("물품명의 앞뒤/여러 공백과 대소문자 중복을 차단한다", () => {
  assert.equal(normalizeName("  노트북   01 "), row.item_name);
  assert.match(
    validateRental({ ...row, item_name: " 노트북   01 " }, [row], today),
    /이미 대여 중/,
  );
  assert.match(
    validateRental(
      { ...row, item_name: "LAPTOP" },
      [{ ...row, item_name: "laptop" }],
      today,
    ),
    /이미 대여 중/,
  );
});
test("반납한 물품은 다시 대여할 수 있다", () => {
  assert.equal(
    validateRental(row, [{ ...row, returned_at: today }], today),
    "",
  );
});
test("미래 대여와 역전된 날짜, 비어 있는 입력을 거부한다", () => {
  assert.match(
    validateRental(
      { ...row, rental_date: "2026-10-17", due_date: "2026-10-18" },
      [],
      today,
    ),
    /오늘 또는 이전/,
  );
  assert.match(
    validateRental({ ...row, due_date: "2026-10-14" }, [], today),
    /빠를 수 없습니다/,
  );
  assert.match(
    validateRental({ ...row, borrower: "   " }, [], today),
    /대여자/,
  );
  assert.match(validateRental({ ...row, item_name: " " }, [], today), /물품명/);
});
test("실제 존재하지 않는 날짜는 거부한다", () => {
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2028-02-29"), true);
  assert.equal(isValidDate("2026-13-01"), false);
});
test("탭과 한글 검색으로 대여 기록을 걸러낸다", () => {
  const rows = [
    row,
    { ...row, id: "2", returned_at: today, borrower: "박서연" },
  ];
  assert.equal(filterRentals(rows, "active", "민지").length, 1);
  assert.equal(filterRentals(rows, "returned", "민지").length, 0);
  assert.equal(filterRentals(rows, "returned", "서연").length, 1);
});
test("물품 이력은 전체 상태를 포함하고 최근 대여일부터 보여준다", () => {
  const older = {
    ...row,
    id: "2",
    rental_date: "2026-09-01",
    returned_at: "2026-09-07",
  };
  assert.deepEqual(
    itemHistory(
      [older, { ...row, item_name: "카메라" }, row],
      row.item_name,
    ).map((r) => r.id),
    ["1", "2"],
  );
});
test("장부에 입력된 HTML과 속성 문자를 안전하게 표시한다", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
  assert.equal(escapeHtml("a&b'"), "a&amp;b&#39;");
});
