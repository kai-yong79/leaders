import { chromium } from "playwright-core";
import { createServer } from "vite";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { todayInSeoul, addDays } from "../src/domain.js";
const root = path.resolve(import.meta.dirname, "..");
const browserPaths = [
  process.env.LEDGER_BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);
let executablePath;
for (const candidate of browserPaths) {
  try {
    await fs.access(candidate);
    executablePath = candidate;
    break;
  } catch {}
}
if (!executablePath)
  throw new Error(
    "Edge 또는 Chrome이 필요합니다. LEDGER_BROWSER_PATH에 브라우저 경로를 지정하세요.",
  );
await fs.mkdir(path.join(root, "artifacts"), { recursive: true });
await fs.mkdir(path.join(root, ".cache/browser-profile"), { recursive: true });
const server = process.env.LEDGER_TEST_URL
  ? null
  : await createServer({
      server: { port: 5173, strictPort: true, host: "127.0.0.1" },
    });
await server?.listen();
const context = await chromium.launchPersistentContext(
  path.join(root, ".cache/browser-profile"),
  {
    executablePath,
    headless: true,
    viewport: { width: 1440, height: 1080 },
    locale: "ko-KR",
    args: ["--no-first-run", "--disable-crash-reporter", "--disable-breakpad"],
  },
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const checks = [];
const check = (name) => {
  checks.push(name);
  console.log(`PASS: ${name}`);
};
try {
  const response = await page.goto(
    process.env.LEDGER_TEST_URL || "http://127.0.0.1:5173/",
  );
  assert.equal(response.status(), 200);
  await page.getByRole("heading", { name: "반가워요" }).waitFor();
  assert.equal(await page.getByRole("table").count(), 0);
  check("로그인 전에는 장부가 보이지 않음");
  await page.screenshot({
    path: path.join(root, "artifacts/login-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "체험 장부 열어보기" }).click();
  await page.getByRole("heading", { name: "공용물품 대여 장부" }).waitFor();
  assert.equal(await page.locator("tbody tr").count(), 4);
  assert.equal(await page.locator("tr.overdue-row").count(), 1);
  assert.equal(await page.locator("tbody .due-today").count(), 1);
  check("대여 중 4건과 연체/오늘반납 표시");
  await page.screenshot({
    path: path.join(root, "artifacts/dashboard-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "노트북 01 대여 이력 보기" }).click();
  assert.equal(await page.locator("dialog .history-list article").count(), 2);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  check("물품별 현재/과거 이력 표시");
  const today = todayInSeoul();
  await page.getByLabel("물품명", { exact: false }).first().fill("노트북 03");
  await page.locator("#borrower").fill("테스트 담당자");
  await page.locator("#rental-date").fill(today);
  await page.locator("#due-date").fill(addDays(today, 3));
  await page.getByRole("button", { name: "대여 등록", exact: true }).click();
  assert.equal(await page.locator("tbody tr").count(), 5);
  assert.equal(
    await page.getByRole("button", { name: "새로 불러오기" }).isEnabled(),
    true,
  );
  const newRow = page.locator("tbody tr").filter({ hasText: "노트북 03" });
  assert.equal(
    await newRow.getByRole("button", { name: "반납", exact: true }).isEnabled(),
    true,
  );
  check("대여 등록 후 목록/버튼 상태 갱신");
  await page.locator("#item-name").fill(" 노트북   03 ");
  await page.locator("#borrower").fill("다른 담당자");
  await page.getByRole("button", { name: "대여 등록", exact: true }).click();
  assert.match(
    await page.locator("#rental-error").textContent(),
    /이미 대여 중/,
  );
  assert.equal(await page.locator("tbody tr").count(), 5);
  check("공백 차이 중복 대여 거부");
  await newRow.getByRole("button", { name: "반납", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(await newRow.count(), 1);
  await newRow.getByRole("button", { name: "반납", exact: true }).click();
  await page.getByRole("button", { name: "반납 확인" }).click();
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(await page.locator("tbody tr").count(), 4);
  await page.getByRole("tab", { name: /반납 완료/ }).click();
  const returnedRow = page.locator("tbody tr").filter({ hasText: "노트북 03" });
  assert.match(
    await returnedRow.textContent(),
    new RegExp(today.replaceAll("-", "\\.")),
  );
  assert.equal(
    await returnedRow
      .getByRole("button", { name: "반납", exact: true })
      .count(),
    0,
  );
  check("반납 취소/확인, 오늘 날짜와 완료 탭 이동");
  await page.locator("#search").fill("테스트 담당자");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.locator("#search").fill("검색 결과 없는 물품");
  await page.getByRole("heading", { name: "검색 결과가 없어요" }).waitFor();
  check("탭별 검색 및 빈 결과 안내");
  await page.getByRole("tab", { name: /대여 중/ }).click();
  await page.locator("#search").fill("");
  await page.locator("#item-name").fill("<img src=x onerror=alert(1)>");
  await page.locator("#borrower").fill("<script>test</script>");
  await page.getByRole("button", { name: "대여 등록", exact: true }).click();
  assert.equal(await page.locator("tbody img, tbody script").count(), 0);
  assert.equal(
    await page
      .locator("tbody tr")
      .filter({ hasText: "<img src=x onerror=alert(1)>" })
      .count(),
    1,
  );
  check("사용자 입력 HTML 실행 차단");
  await page.getByRole("button", { name: "체험 종료", exact: true }).click();
  await page.getByRole("button", { name: "체험 장부 열어보기" }).click();
  assert.equal(await page.locator("tbody tr").count(), 4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(root, "artifacts/dashboard-mobile.png"),
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page
    .getByRole("button", { name: "빔프로젝터 01 대여 이력 보기" })
    .click();
  assert.equal(await page.locator("dialog").isVisible(), true);
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(await page.locator("dialog").count(), 0);
  check("390px 모바일 레이아웃 및 키보드 모달 닫기");
  assert.deepEqual(errors, []);
  check("브라우저 JavaScript 오류 없음");
  await fs.writeFile(
    path.join(root, "artifacts/ui-results.json"),
    JSON.stringify(
      { passed: checks, errors, date: new Date().toISOString() },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await server?.close();
}
