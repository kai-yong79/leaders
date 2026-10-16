import "./style.css";
import { supabase, configurationError } from "./supabase.js";
import {
  todayInSeoul,
  addDays,
  dayDifference,
  normalizeName,
  isOverdue,
  validateRental,
  filterRentals,
  itemHistory,
  escapeHtml as e,
  friendlyError,
} from "./domain.js";

const app = document.querySelector("#app");
const toast = document.createElement("div");
toast.id = "toast";
toast.setAttribute("role", "status");
toast.setAttribute("aria-live", "polite");
document.body.append(toast);
const state = {
  session: null,
  demo: false,
  rows: [],
  tab: "active",
  query: "",
  loading: false,
  loadError: "",
  busy: false,
  loadedAt: null,
};
let requestVersion = 0;
let toastTimer;
const icons = {
  box: '<path d="m4 7 8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10M8 5l8 4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  check: '<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M6.1 6a8 8 0 0 1 13 2M4.9 16a8 8 0 0 0 13 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logout: '<path d="M9 5H4v14h5m5-14 7 7-7 7M9 12h12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  laptop:
    '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="m4 16-2 4h20l-2-4"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4z"/><circle cx="12" cy="13" r="4"/>',
  projector:
    '<rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="16" cy="12" r="3"/><path d="M5 10h3m-3 4h3M7 18v3m10-3v3"/>',
};
function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.box}</svg>`;
}
function equipmentIcon(name) {
  return /노트북|맥북|laptop/i.test(name)
    ? "laptop"
    : /카메라|camera/i.test(name)
      ? "camera"
      : /프로젝터|projector/i.test(name)
        ? "projector"
        : "box";
}
function notify(message, error = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `visible ${error ? "error" : ""}`;
  toastTimer = setTimeout(
    () => {
      toast.className = "";
    },
    error ? 9000 : 4500,
  );
}
function demoRows() {
  const today = todayInSeoul();
  return [
    ["노트북 01", "김민지", -3, 3, null],
    ["빔프로젝터 01", "이준호", -5, -2, null],
    ["카메라 01", "박서연", -1, 0, null],
    ["태블릿 01", "정하늘", -2, 5, null],
    ["노트북 02", "오지우", -7, -1, -2],
    ["노트북 01", "윤도현", -14, -8, -8],
  ].map(([item_name, borrower, from, due, returned], i) => ({
    id: crypto.randomUUID(),
    item_name,
    borrower,
    rental_date: addDays(today, from),
    due_date: addDays(today, due),
    returned_at: returned === null ? null : addDays(today, returned),
    created_at: new Date(Date.now() - i * 60000).toISOString(),
  }));
}
function brand() {
  return `<div class="brand"><span class="brand-mark">${icon("box")}</span><div>모두의 물품<small>SHARED EQUIPMENT</small></div></div>`;
}
function renderLogin() {
  app.innerHTML = `<div class="login-layout"><section class="login-story">${brand()}<div class="story-main"><span class="eyebrow light">우리 팀의 물품, 함께 더 잘 쓰기</span><h1>빌릴 때도,<br>돌려줄 때도<br><span>한눈에 가볍게.</span></h1><p>누가, 무엇을, 언제까지.<br>공용물품의 모든 대여 기록을 한곳에서 관리하세요.</p><div class="story-illustration">${icon("laptop")}${icon("camera")}${icon("projector")}</div></div><span class="story-footer">공용물품 대여 장부 · 모두의 물품</span></section><section class="login-panel"><div class="login-card"><span class="eyebrow">TEAM WORKSPACE</span><h2>반가워요 👋</h2><p class="muted">부서 계정으로 로그인하고 장부를 확인하세요.</p>${configurationError ? `<div class="setup-note"><strong>연결 준비 중</strong><p>${e(configurationError)}</p><p>관리자는 README의 환경변수 설정을 마친 뒤 다시 실행해 주세요.</p></div>` : ""}<form id="login-form"><label for="email">이메일</label><input id="email" name="email" type="email" autocomplete="username" placeholder="name@company.com" required ${!supabase ? "disabled" : ""}/><label for="password">비밀번호</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" required ${!supabase ? "disabled" : ""}/><button class="button primary full" type="submit" ${!supabase ? "disabled" : ""}>로그인 ${icon("arrow")}</button><p id="login-error" class="form-error" role="alert"></p></form><div class="account-note">계정이 없거나 비밀번호를 잊으셨나요?<br>부서 관리자에게 계정 발급 또는 재설정을 요청해 주세요.</div><div class="login-divider"><span>먼저 둘러보고 싶다면</span></div><button id="demo-start" class="button secondary full">체험 장부 열어보기 ${icon("arrow")}</button><p class="demo-hint">가상 데이터로 체험합니다. 실제 장부에는 저장되지 않아요.</p></div></section></div>`;
  document.querySelector("#demo-start").onclick = () => {
    requestVersion++;
    state.demo = true;
    state.rows = demoRows();
    state.loadedAt = new Date();
    state.loadError = "";
    render();
  };
  document.querySelector("#login-form").onsubmit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    button.textContent = "로그인 중…";
    const errorNode = document.querySelector("#login-error");
    errorNode.textContent = "";
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: document.querySelector("#email").value.trim(),
        password: document.querySelector("#password").value,
      });
      if (error) throw error;
      state.session = data.session;
      state.demo = false;
      state.rows = [];
      await loadRows();
    } catch (error) {
      if (errorNode.isConnected) errorNode.textContent = friendlyError(error);
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.innerHTML = `로그인 ${icon("arrow")}`;
      }
    }
  };
}
function render() {
  if (!state.session && !state.demo) {
    renderLogin();
    return;
  }
  const today = todayInSeoul();
  const todayLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  const active = state.rows.filter((r) => !r.returned_at);
  const overdue = active.filter((r) => isOverdue(r, today)).length;
  const returned = state.rows.length - active.length;
  app.innerHTML = `<div class="workspace"><aside class="sidebar">${brand()}<div class="workspace-label">WORKSPACE</div><nav aria-label="주 메뉴"><button data-nav="active" class="nav-item ${state.tab === "active" ? "selected" : ""}">${icon("grid")} 대여 장부 <span>${active.length}</span></button><button data-nav="returned" class="nav-item ${state.tab === "returned" ? "selected" : ""}">${icon("check")} 반납 완료</button><button id="guide" class="nav-item">${icon("info")} 이용 안내</button></nav><div class="sidebar-tip"><span class="tip-mark">✳</span><strong>함께 쓰고, 함께 챙겨요.</strong><p>사용이 끝난 물품은<br>다음 동료를 위해 반납해 주세요.</p></div><div class="sidebar-bottom"><span class="avatar">${state.demo ? "체" : e((state.session.user.email || "부").slice(0, 1).toUpperCase())}</span><div><strong>${state.demo ? "체험 워크스페이스" : "부서 워크스페이스"}</strong><small>${state.demo ? "가상 데이터 사용 중" : e(state.session.user.email)}</small></div><button id="logout" class="icon-button" aria-label="${state.demo ? "체험 종료" : "로그아웃"}" title="${state.demo ? "체험 종료" : "로그아웃"}">${icon("logout")}</button></div></aside><main class="main"><header class="topbar"><span>워크스페이스 <span class="breadcrumb">/</span> <strong>공용물품 대여 장부</strong></span><span class="connection"><i></i>${state.demo ? "체험 모드" : state.loadError ? "연결 확인 필요" : state.loading ? "불러오는 중" : "Supabase 장부"}</span></header><div class="page-content">${state.demo ? '<div class="demo-banner"><strong>체험 모드</strong><span>가상 데이터입니다. 변경 내용은 저장되지 않으며 새로고침하면 초기화됩니다.</span><button id="exit-demo">체험 종료 ↗</button></div>' : ""}<div class="page-heading"><div><span class="eyebrow">EQUIPMENT LEDGER</span><h1>공용물품 대여 장부<span class="heading-dot">.</span></h1><p>우리 팀의 물품, 대여부터 반납까지 한곳에서.</p></div><div class="today-label">${icon("clock")} ${e(todayLabel)}</div></div><section class="stats" aria-label="대여 요약"><article class="stat-card"><div><span>대여 중</span><strong>${state.loading ? "—" : active.length}<small>건</small></strong><p>현재 사용 중인 공용물품</p></div><span class="stat-icon green">${icon("box")}</span></article><article class="stat-card overdue-stat"><div><span>반납 기한 초과</span><strong>${state.loading ? "—" : overdue}<small>건</small></strong><p>${overdue ? "반납 일정을 확인해 주세요" : "기한을 넘긴 물품이 없어요"}</p></div><span class="stat-icon red">${icon("clock")}</span></article><article class="stat-card"><div><span>반납 완료</span><strong>${state.loading ? "—" : returned}<small>건</small></strong><p>차곡차곡 쌓인 대여 기록</p></div><span class="stat-icon neutral">${icon("check")}</span></article></section><section class="panel registration"><div class="section-title"><span class="title-icon">${icon("plus")}</span><div><h2>새 대여 등록</h2><p>빌려 가는 물품과 반납 예정일을 남겨 주세요.</p></div></div><form id="rental-form"><div class="form-grid"><div><label for="item-name">물품명 <span>*</span></label><input id="item-name" name="item_name" placeholder="예: 노트북 01" maxlength="100" required list="known-items"/><datalist id="known-items">${[
    ...new Set(state.rows.map((r) => r.item_name)),
  ]
    .sort()
    .map((v) => `<option value="${e(v)}"></option>`)
    .join(
      "",
    )}</datalist></div><div><label for="borrower">대여자 <span>*</span></label><input id="borrower" name="borrower" placeholder="예: 김민지" maxlength="50" required/></div><div><label for="rental-date">대여일 <span>*</span></label><input id="rental-date" name="rental_date" type="date" value="${today}" max="${today}" required/></div><div><label for="due-date">반납 예정일 <span>*</span></label><input id="due-date" name="due_date" type="date" value="${addDays(today, 7)}" min="${today}" required/></div><button class="button primary register-button" type="submit" ${state.loading || state.busy || state.loadError ? "disabled" : ""}>${icon("plus")} 대여 등록</button></div><div class="form-bottom"><span>${icon("info")} 같은 종류의 물품은 번호로 구분해 주세요. 예: 노트북 01, 노트북 02</span><span class="required-note">* 필수 입력</span></div><p id="rental-error" class="form-error" role="alert"></p></form></section><section class="panel ledger"><div class="ledger-header"><div class="section-title"><h2>대여 현황</h2><span class="total-count">전체 ${state.rows.length}건</span></div><button id="refresh" class="button refresh-button" ${state.loading || state.busy ? "disabled" : ""}>${icon("refresh")} 새로 불러오기</button></div><div class="ledger-toolbar"><div class="tabs" role="tablist" aria-label="대여 상태"><button id="tab-active" role="tab" aria-selected="${state.tab === "active"}" aria-controls="rental-results" data-tab="active" class="tab ${state.tab === "active" ? "active" : ""}">대여 중 <span>${active.length}</span></button><button id="tab-returned" role="tab" aria-selected="${state.tab === "returned"}" aria-controls="rental-results" data-tab="returned" class="tab ${state.tab === "returned" ? "active" : ""}">반납 완료 <span>${returned}</span></button></div><div class="search-field">${icon("search")}<input id="search" type="search" aria-label="물품명 또는 대여자 검색" placeholder="물품명 또는 대여자 검색" value="${e(state.query)}"/></div></div><div id="rental-results" role="tabpanel" aria-labelledby="tab-${state.tab}" tabindex="0"></div><div class="ledger-footer"><span id="result-count"></span><span>${state.loadedAt ? `마지막 불러오기 ${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(state.loadedAt)}` : ""} · 한국 시간 기준</span></div></section><footer class="page-footer"><span>모두의 물품</span> 작은 기록이 만드는 더 편한 협업</footer></div></main></div>`;
  renderList();
  bindDashboard();
}
function statusBadge(row) {
  const today = todayInSeoul();
  if (row.returned_at)
    return '<span class="badge returned"><i></i> 반납 완료</span>';
  if (isOverdue(row, today))
    return `<span class="badge overdue"><i></i> ${dayDifference(row.due_date, today)}일 초과</span>`;
  if (row.due_date === today)
    return '<span class="badge due-today"><i></i> 오늘 반납</span>';
  return '<span class="badge active-status"><i></i> 대여 중</span>';
}
function renderList() {
  const target = document.querySelector("#rental-results");
  if (!target) return;
  const rows = filterRentals(state.rows, state.tab, state.query).sort((a, b) =>
    state.tab === "active"
      ? a.due_date.localeCompare(b.due_date) ||
        b.created_at.localeCompare(a.created_at)
      : b.returned_at.localeCompare(a.returned_at) ||
        b.created_at.localeCompare(a.created_at),
  );
  document.querySelector("#result-count").textContent =
    `${rows.length}건의 기록 · 물품명을 누르면 전체 이력을 볼 수 있어요`;
  if (state.loading) {
    target.innerHTML =
      '<div class="empty-state"><span class="spinner"></span><h3>장부를 불러오고 있어요</h3></div>';
    return;
  }
  if (state.loadError) {
    target.innerHTML = `<div class="empty-state load-error">${icon("info")}<h3>장부를 불러오지 못했어요</h3><p>${e(state.loadError)}</p><button id="retry" class="button secondary">다시 시도</button></div>`;
    document.querySelector("#retry").onclick = loadRows;
    return;
  }
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state">${icon(state.query ? "search" : "box")}<h3>${state.query ? "검색 결과가 없어요" : state.tab === "active" ? "모든 물품이 제자리에 있어요" : "아직 반납된 물품이 없어요"}</h3><p>${state.query ? "다른 물품명이나 대여자로 검색해 보세요." : state.tab === "active" ? "물품을 빌릴 때 위에서 첫 대여를 등록해 주세요." : "물품을 반납하면 이곳에 기록이 남아요."}</p></div>`;
    return;
  }
  target.innerHTML = `<div class="table-scroll"><table><caption class="sr-only">${state.tab === "active" ? "대여 중인" : "반납 완료한"} 공용물품 목록</caption><thead><tr><th scope="col">물품명</th><th scope="col">대여자</th><th scope="col">대여일</th><th scope="col">반납 예정일</th><th scope="col">${state.tab === "active" ? "상태" : "반납일"}</th><th scope="col" class="action-cell">${state.tab === "active" ? "반납 처리" : "상태"}</th></tr></thead><tbody>${rows.map((row) => `<tr class="${isOverdue(row) ? "overdue-row" : ""}"><td><button class="item-link" data-history="${e(row.id)}"><span class="equipment-icon">${icon(equipmentIcon(row.item_name))}</span><span>${e(row.item_name)}<small>대여 이력 보기 ↗</small></span></button></td><td><span class="borrower-cell"><span class="mini-avatar">${e(row.borrower.slice(0, 1))}</span>${e(row.borrower)}</span></td><td class="date-cell">${e(row.rental_date.replaceAll("-", "."))}</td><td class="date-cell ${isOverdue(row) ? "red-text" : ""}">${e(row.due_date.replaceAll("-", "."))}</td><td>${state.tab === "active" ? statusBadge(row) : `<span class="date-cell">${e(row.returned_at.replaceAll("-", "."))}</span>`}</td><td class="action-cell">${!row.returned_at ? `<button class="button return-button" data-return="${e(row.id)}" ${state.busy ? "disabled" : ""}>${icon("refresh")} 반납</button>` : statusBadge(row)}</td></tr>`).join("")}</tbody></table></div>`;
  target.querySelectorAll("[data-return]").forEach((button) => {
    button.onclick = () => confirmReturn(button.dataset.return);
  });
  target.querySelectorAll("[data-history]").forEach((button) => {
    button.onclick = () => showHistory(button.dataset.history);
  });
}
function bindDashboard() {
  document.querySelectorAll("[data-tab], [data-nav]").forEach((button) => {
    button.onclick = () => {
      state.tab = button.dataset.tab || button.dataset.nav;
      render();
    };
  });
  document.querySelector("#search").oninput = (event) => {
    state.query = event.target.value;
    renderList();
  };
  document.querySelector("#refresh").onclick = loadRows;
  document.querySelector("#logout").onclick = logout;
  document.querySelector("#exit-demo")?.addEventListener("click", logout);
  document.querySelector("#guide").onclick = () =>
    openDialog(
      `<div class="modal-heading"><span class="eyebrow">QUICK GUIDE</span><h2>함께 쓰는 장부 이용 안내</h2></div><ol class="guide-list"><li><strong>개별 물품 이름으로 등록하세요.</strong><p>노트북이 두 대라면 노트북 01, 노트북 02처럼 이름을 나눠 주세요.</p></li><li><strong>대여자와 반납 예정일을 남겨 주세요.</strong><p>예정일 다음 날부터 빨간색으로 기한 초과를 표시합니다.</p></li><li><strong>돌려주면 반납 버튼을 눌러 주세요.</strong><p>한국 시간 기준 오늘 날짜가 반납일로 기록됩니다. 반납 기록은 수정할 수 없어요.</p></li><li><strong>물품명을 눌러 이력을 확인하세요.</strong><p>이전에 누가 사용했는지, 언제 돌려주었는지 확인할 수 있어요.</p></li></ol><p class="muted">다른 동료가 변경한 내용은 ‘새로 불러오기’로 확인하세요.</p>`,
    );
  document.querySelector("#rental-date").onchange = (event) => {
    document.querySelector("#due-date").min = event.target.value;
  };
  document.querySelector("#rental-form").onsubmit = addRental;
}
async function loadRows() {
  if (state.demo) {
    state.loadedAt = new Date();
    render();
    return;
  }
  if (!state.session || !supabase) return;
  const version = ++requestVersion;
  state.loading = true;
  state.loadError = "";
  render();
  try {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase
        .from("rentals")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) break;
    }
    if (version !== requestVersion) return;
    state.rows = rows;
    state.loadedAt = new Date();
  } catch (error) {
    if (version === requestVersion) {
      state.rows = [];
      state.loadError = friendlyError(error);
    }
  } finally {
    if (version === requestVersion) {
      state.loading = false;
      render();
    }
  }
}
async function addRental(event) {
  event.preventDefault();
  if (state.busy || state.loading || state.loadError) return;
  const form = event.currentTarget;
  const input = Object.fromEntries(new FormData(form));
  input.item_name = normalizeName(input.item_name);
  input.borrower = normalizeName(input.borrower);
  const validation = validateRental(input, state.rows);
  const errorNode = document.querySelector("#rental-error");
  errorNode.textContent = validation;
  if (validation) return;
  const button = form.querySelector('button[type="submit"]');
  state.busy = true;
  button.disabled = true;
  button.textContent = "등록 중…";
  try {
    if (state.demo)
      state.rows.unshift({
        ...input,
        id: crypto.randomUUID(),
        returned_at: null,
        created_at: new Date().toISOString(),
      });
    else {
      const { error } = await supabase.from("rentals").insert(input);
      if (error) throw error;
    }
    state.tab = "active";
    state.query = "";
    await loadRows();
    notify(`${input.item_name} 대여를 등록했습니다.`);
  } catch (error) {
    const message = friendlyError(error);
    if (error.code === "23505") {
      await loadRows();
      notify(message, true);
    } else if (errorNode.isConnected) errorNode.textContent = message;
    else notify(message, true);
  } finally {
    state.busy = false;
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = `${icon("plus")} 대여 등록`;
    }
    document
      .querySelector('#rental-form button[type="submit"]')
      ?.toggleAttribute("disabled", state.loading || !!state.loadError);
    renderList();
    document
      .querySelector("#refresh")
      ?.toggleAttribute("disabled", state.loading);
  }
}
function openDialog(content) {
  const previous = document.activeElement;
  document.querySelector("dialog")?.close();
  const dialog = document.createElement("dialog");
  dialog.className = "modal";
  dialog.setAttribute("aria-label", "장부 상세 안내");
  dialog.innerHTML = `<button class="modal-close icon-button" aria-label="닫기">×</button>${content}`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector(".modal-close").onclick = () => dialog.close();
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (previous?.isConnected) previous.focus();
  });
  return dialog;
}
function showHistory(id) {
  const row = state.rows.find((r) => r.id === id);
  if (!row) return;
  const history = itemHistory(state.rows, row.item_name);
  openDialog(
    `<div class="modal-heading"><span class="eyebrow">EQUIPMENT HISTORY</span><h2>${e(row.item_name)}</h2><p class="muted">이 물품의 전체 대여 이력 · ${history.length}건</p></div><div class="history-list">${history.map((r) => `<article><div class="history-top"><strong>${e(r.borrower)}</strong>${statusBadge(r)}</div><p>대여일 <b>${e(r.rental_date)}</b><span>→</span> 예정일 <b>${e(r.due_date)}</b></p><small>${r.returned_at ? `반납일 ${e(r.returned_at)}` : "현재 대여 중"}</small></article>`).join("")}</div>`,
  );
}
function confirmReturn(id) {
  if (state.busy) return;
  const row = state.rows.find((r) => r.id === id);
  if (!row || row.returned_at) return;
  const dialog = openDialog(
    `<span class="confirm-icon">${icon("check")}</span><div class="modal-heading"><h2>물품을 반납하시겠어요?</h2><p><strong>${e(row.item_name)}</strong> · ${e(row.borrower)}</p></div><p class="muted">반납일은 한국 시간 기준 오늘(${todayInSeoul()})로 저장됩니다. 실제 물품이 돌아왔는지 확인해 주세요.</p><div class="modal-actions"><button class="button secondary" id="cancel-return">취소</button><button class="button primary" id="confirm-return">반납 확인 ${icon("check")}</button></div><p id="return-error" class="form-error" role="alert"></p>`,
  );
  dialog.querySelector("#cancel-return").onclick = () => dialog.close();
  dialog.querySelector("#confirm-return").onclick = async (event) => {
    if (state.busy) return;
    state.busy = true;
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "반납 중…";
    try {
      if (state.demo) row.returned_at = todayInSeoul();
      else {
        const { data, error } = await supabase
          .from("rentals")
          .update({ returned_at: todayInSeoul() })
          .eq("id", id)
          .is("returned_at", null)
          .select("id");
        if (error) throw error;
        if (!data.length) {
          dialog.close();
          await loadRows();
          notify(
            "이미 반납되었거나 변경할 수 없는 기록입니다. 장부를 다시 불러왔습니다.",
            true,
          );
          return;
        }
      }
      dialog.close();
      await loadRows();
      notify(`${row.item_name} 반납을 완료했습니다.`);
    } catch (error) {
      const errorNode = dialog.querySelector("#return-error");
      if (errorNode) errorNode.textContent = friendlyError(error);
    } finally {
      state.busy = false;
      const button = dialog.querySelector("#confirm-return");
      if (button) {
        button.disabled = false;
        button.textContent = "반납 확인";
      }
      renderList();
      document
        .querySelector('#rental-form button[type="submit"]')
        ?.toggleAttribute("disabled", state.loading || !!state.loadError);
      document
        .querySelector("#refresh")
        ?.toggleAttribute("disabled", state.loading);
    }
  };
}
async function logout() {
  if (state.busy) {
    notify("처리 중인 작업이 끝난 뒤 다시 시도해 주세요.");
    return;
  }
  if (!state.demo && supabase) {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      notify(friendlyError(error), true);
      return;
    }
  }
  clearTimeout(toastTimer);
  toast.className = "";
  toast.textContent = "";
  requestVersion++;
  Object.assign(state, {
    session: null,
    demo: false,
    rows: [],
    loading: false,
    loadError: "",
    loadedAt: null,
    query: "",
    tab: "active",
  });
  document.querySelectorAll("dialog").forEach((dialog) => dialog.close());
  render();
}
renderLogin();
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (state.demo) return;
    if (!session) {
      requestVersion++;
      state.session = null;
      state.rows = [];
      document.querySelectorAll("dialog").forEach((dialog) => dialog.close());
      render();
    } else if (state.session?.user.id !== session.user.id) {
      state.session = session;
      setTimeout(() => {
        if (!state.loading && state.session?.user.id === session.user.id)
          loadRows();
      }, 0);
    } else state.session = session;
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (state.demo) return;
    if (error) {
      notify(friendlyError(error), true);
      return;
    }
    if (data.session && !state.session) {
      state.session = data.session;
      loadRows();
    }
  });
}
setInterval(() => {
  if (
    (state.session || state.demo) &&
    !state.busy &&
    !state.loading &&
    !document.querySelector("dialog")
  ) {
    renderList();
  }
}, 60000);
