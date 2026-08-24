// 매장 안전보건관리체계 사전지원 평가 앱 로직
const STORAGE_KEY = "daiso_store_precheck_records_v1";

const state = {
  answers: {}, // itemId -> "A"|"B"|"C"|"D"|"NA"
  notes: {}, // itemId -> 수기 평가 결과 텍스트
};

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return e;
}

function initHeader() {
  const evalSel = document.getElementById("evaluator");
  EVALUATORS.forEach((name) => evalSel.appendChild(el("option", { value: name, text: name })));
  evalSel.addEventListener("change", updateStatsVisibility);

  const storeSelect = document.getElementById("storeName");
  STORE_LIST.forEach((s) => storeSelect.appendChild(el("option", { value: s, text: s })));

  const dateInput = document.getElementById("visitDate");
  const today = new Date();
  dateInput.value = today.toISOString().slice(0, 10);
}

function renderCriteria() {
  const table = document.getElementById("criteriaTable");
  ["A", "B", "C", "D"].forEach((g) => {
    const row = el("tr", {}, [
      el("td", {}, [el("span", { class: `grade-chip grade-bg-${g}`, text: g })]),
      el("td", { text: GRADE_LABEL[g] }),
      el("td", { text: GRADE_ACTION[g] }),
    ]);
    table.appendChild(row);
  });

  const toggleBtn = document.getElementById("criteriaToggle");
  const panel = document.getElementById("criteriaPanel");
  toggleBtn.addEventListener("click", () => {
    const isHidden = panel.classList.toggle("hidden");
    toggleBtn.textContent = isHidden ? "평가기준 보기 ▾" : "평가기준 닫기 ▴";
  });
}

function gradeBtn(itemId, grade, extraClass, label) {
  const btn = el("button", {
    class: `grade-btn grade-${grade} ${extraClass || ""}`,
    type: "button",
    text: label || grade,
    onclick: () => selectGrade(itemId, grade),
  });
  btn.dataset.item = itemId;
  btn.dataset.grade = grade;
  return btn;
}

function selectGrade(itemId, grade) {
  state.answers[itemId] = grade;
  document.querySelectorAll(`.grade-btn[data-item="${itemId}"]`).forEach((b) => {
    b.classList.toggle("active", b.dataset.grade === grade);
  });
  recalc();
}

function renderDomains() {
  const root = document.getElementById("domains");
  DOMAINS.forEach((domain) => {
    const section = el("section", { class: "domain", id: `domain-${domain.key}` });
    section.appendChild(
      el("div", { class: "domain-head" }, [
        el("h2", { text: domain.title }),
        el("span", { class: "domain-goal", text: domain.goal }),
        el("span", { class: "domain-grade-badge", id: `badge-${domain.key}`, text: "미평가" }),
      ])
    );

    const table = el("div", { class: "item-table" });
    domain.items.forEach((item) => {
      const row = el("div", { class: "item-row" });
      const info = el("div", { class: "item-info" }, [
        el("div", { class: "item-cat" }, [
          el("span", { class: "cat-chip", text: item.cat }),
          item.critical ? el("span", { class: "critical-chip", text: "핵심 문항" }) : null,
          item.onsite ? el("span", { class: `onsite-chip onsite-${item.onsite}`, text: "당일보강 " + item.onsite }) : null,
        ]),
        el("div", { class: "item-name", text: item.name }),
        el("div", { class: "item-ref", text: item.ref }),
      ]);
      const buttons = el("div", { class: "item-buttons" }, [
        gradeBtn(item.id, "A"),
        gradeBtn(item.id, "B"),
        gradeBtn(item.id, "C"),
        gradeBtn(item.id, "D"),
        gradeBtn(item.id, "NA", "grade-na", "미해당"),
      ]);
      const noteInput = el("textarea", {
        class: "item-note",
        id: `note-${item.id}`,
        rows: "1",
        placeholder: "이 항목의 평가 결과 · 확인 내용을 직접 입력하세요",
        oninput: (e) => {
          state.notes[item.id] = e.target.value;
        },
      });
      const top = el("div", { class: "item-row-top" }, [info, buttons]);
      row.appendChild(top);
      row.appendChild(noteInput);
      table.appendChild(row);
    });
    section.appendChild(table);
    root.appendChild(section);
  });
}

function scoresOf(items) {
  return items
    .map((it) => state.answers[it.id])
    .filter((g) => g && g !== "NA")
    .map((g) => GRADE_SCORE[g]);
}

function averageGrade(scores) {
  if (scores.length === 0) return null;
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return { avg, grade: scoreToGrade(avg) };
}

function domainGrade(domain) {
  return averageGrade(scoresOf(domain.items));
}

function domainAnsweredCount(domain) {
  return domain.items.filter((it) => state.answers[it.id]).length;
}

function recalc() {
  const allScores = [];

  DOMAINS.forEach((domain) => {
    const result = domainGrade(domain);
    const badge = document.getElementById(`badge-${domain.key}`);
    if (result) {
      badge.textContent = `${result.grade} · ${GRADE_LABEL[result.grade]} (평균 ${result.avg.toFixed(1)})`;
      badge.className = `domain-grade-badge grade-bg-${result.grade}`;
    } else {
      badge.textContent = "미평가";
      badge.className = "domain-grade-badge";
    }
    allScores.push(...scoresOf(domain.items));
  });

  const totalItems = DOMAINS.reduce((sum, d) => sum + d.items.length, 0);
  const answeredItems = DOMAINS.reduce((sum, d) => sum + domainAnsweredCount(d), 0);

  const progressEl = document.getElementById("progress");
  progressEl.textContent = `${answeredItems} / ${totalItems} 항목 평가 완료`;
  document.getElementById("progressBar").style.width = `${(answeredItems / totalItems) * 100}%`;

  const finalBox = document.getElementById("finalGrade");
  const finalReason = document.getElementById("finalReason");
  const finalResult = averageGrade(allScores);

  if (!finalResult) {
    finalBox.textContent = "-";
    finalBox.className = "final-grade-value";
    finalReason.textContent = "항목을 평가하면 최종 등급이 자동 계산됩니다.";
    return;
  }

  finalBox.textContent = finalResult.grade;
  finalBox.className = `final-grade-value grade-bg-${finalResult.grade}`;
  finalReason.textContent = `평균 ${finalResult.avg.toFixed(2)}점 · ${GRADE_LABEL[finalResult.grade]} · ${GRADE_ACTION[finalResult.grade]}`;
}

function buildReportText() {
  const store = document.getElementById("storeName").value || "(매장명 미입력)";
  const evaluator = document.getElementById("evaluator").value || "(평가자 미선택)";
  const date = document.getElementById("visitDate").value || "-";
  const memo = document.getElementById("memo").value.trim();

  let lines = [];
  lines.push(`[매장 안전보건관리체계 사전지원 평가 결과]`);
  lines.push(`매장: ${store}   평가자: ${evaluator}   방문일: ${date}`);
  lines.push("");

  DOMAINS.forEach((domain) => {
    const result = domainGrade(domain);
    lines.push(`■ ${domain.title} — ${result ? `${result.grade} (${GRADE_LABEL[result.grade]}, 평균 ${result.avg.toFixed(1)})` : "미평가"}`);
    domain.items.forEach((item) => {
      const ans = state.answers[item.id] || "-";
      lines.push(`  [${ans}] ${item.name}`);
      const note = (state.notes[item.id] || "").trim();
      if (note) lines.push(`      ↳ ${note}`);
    });
    lines.push("");
  });

  const finalGrade = document.getElementById("finalGrade").textContent;
  lines.push(`▶ 최종 등급: ${finalGrade}  (${document.getElementById("finalReason").textContent})`);
  if (memo) {
    lines.push("");
    lines.push(`[특이사항] ${memo}`);
  }
  return lines.join("\n");
}

async function saveRecord() {
  const store = document.getElementById("storeName").value.trim();
  const evaluator = document.getElementById("evaluator").value;
  if (!store || !evaluator) {
    alert("매장명과 평가자를 입력해 주세요.");
    return;
  }
  const finalGrade = document.getElementById("finalGrade").textContent;
  if (finalGrade === "-") {
    if (!confirm("아직 평가 항목이 없습니다. 그래도 저장하시겠습니까?")) return;
  }
  const record = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    store,
    evaluator,
    date: document.getElementById("visitDate").value,
    finalGrade,
    memo: document.getElementById("memo").value.trim(),
    answers: { ...state.answers },
    notes: { ...state.notes },
    reportText: buildReportText(),
  };
  const records = loadRecords();
  records.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  renderHistory();

  if (!isSyncEnabled()) {
    alert("이 기기에 저장되었습니다.\n(공유 저장소가 아직 연결되지 않아 다른 평가자와는 자동으로 합쳐지지 않습니다.)");
    return;
  }
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "공유 저장소에 전송 중...";
  const result = await pushToSync(record);
  saveBtn.disabled = false;
  saveBtn.textContent = "결과 저장 (이 기기 + 공유)";
  if (result.ok) {
    alert("이 기기와 공유 저장소에 모두 저장되었습니다.");
  } else {
    alert("이 기기에는 저장되었지만 공유 저장소 전송에 실패했습니다.\n(네트워크 상태를 확인하고 나중에 다시 시도해 주세요)");
  }
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function isSyncEnabled() {
  return !!(SYNC_CONFIG && SYNC_CONFIG.url);
}

async function pushToSync(record) {
  if (!isSyncEnabled()) return { ok: false, error: "not-configured" };
  try {
    const res = await fetch(SYNC_CONFIG.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // Apps Script CORS preflight 회피용
      body: JSON.stringify({ ...record, secret: SYNC_CONFIG.secret }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

async function fetchSyncRecords() {
  if (!isSyncEnabled()) return null;
  try {
    const res = await fetch(SYNC_CONFIG.url);
    const data = await res.json();
    return data.ok ? data.records : null;
  } catch (err) {
    return null;
  }
}

async function loadMergedRecords() {
  const local = loadRecords();
  if (!isSyncEnabled()) return { records: local, source: "local" };
  const shared = await fetchSyncRecords();
  if (shared == null) return { records: local, source: "local-fallback" };
  const merged = new Map();
  local.forEach((r) => merged.set(String(r.id), r));
  shared.forEach((r) => merged.set(String(r.id), r)); // 공유 저장소 값을 최종본으로 사용
  const list = Array.from(merged.values()).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  return { records: list, source: "shared" };
}

function isManagerView() {
  return document.getElementById("evaluator").value === "강동현";
}

async function updateStatsVisibility() {
  const card = document.getElementById("statsCard");
  const show = isManagerView();
  card.classList.toggle("hidden", !show);
  if (show) await renderStats();
}

async function renderStats() {
  const statusEl = document.getElementById("statsSyncStatus");
  statusEl.textContent = isSyncEnabled() ? "공유 데이터 불러오는 중..." : "⚠ 공유 저장소 미연결 — 이 기기 데이터만 표시 중";
  statusEl.className = isSyncEnabled() ? "sync-status" : "sync-status sync-status-warn";

  const { records, source } = await loadMergedRecords();

  if (source === "shared") {
    statusEl.textContent = `☁ 공유 저장소 연결됨 — 4명 결과 전체 집계 (${records.length}건)`;
    statusEl.className = "sync-status sync-status-ok";
  } else if (source === "local-fallback") {
    statusEl.textContent = "⚠ 공유 저장소 응답 없음 — 이 기기 데이터만 표시 중";
    statusEl.className = "sync-status sync-status-warn";
  }

  const grid = document.getElementById("statsGrid");
  grid.innerHTML = "";
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  records.forEach((r) => {
    if (counts[r.finalGrade] != null) counts[r.finalGrade]++;
  });
  const tiles = [
    { label: "총 저장 건수", value: records.length, cls: "" },
    { label: "A 등급", value: counts.A, cls: "grade-bg-A" },
    { label: "B 등급", value: counts.B, cls: "grade-bg-B" },
    { label: "C 등급", value: counts.C, cls: "grade-bg-C" },
    { label: "D 등급", value: counts.D, cls: "grade-bg-D" },
  ];
  tiles.forEach((t) => {
    grid.appendChild(
      el("div", { class: "stat-tile" }, [
        el("div", { class: `stat-value ${t.cls}`, text: String(t.value) }),
        el("div", { class: "stat-label", text: t.label }),
      ])
    );
  });

  const latestByStore = new Map();
  records.forEach((r) => {
    if (!latestByStore.has(r.store)) latestByStore.set(r.store, r);
  });
  const storeBody = document.getElementById("statsStoreBody");
  storeBody.innerHTML = "";
  if (latestByStore.size === 0) {
    storeBody.appendChild(el("tr", {}, [el("td", { colspan: "4", class: "empty", text: "저장된 결과가 없습니다." })]));
  } else {
    latestByStore.forEach((r) => {
      storeBody.appendChild(
        el("tr", {}, [
          el("td", { text: r.store }),
          el("td", { text: r.date }),
          el("td", { text: r.evaluator }),
          el("td", {}, [el("span", { class: `grade-chip grade-bg-${r.finalGrade}`, text: r.finalGrade })]),
        ])
      );
    });
  }

  const byEvaluator = {};
  records.forEach((r) => {
    byEvaluator[r.evaluator] = (byEvaluator[r.evaluator] || 0) + 1;
  });
  const evalBody = document.getElementById("statsEvaluatorBody");
  evalBody.innerHTML = "";
  EVALUATORS.forEach((name) => {
    evalBody.appendChild(el("tr", {}, [el("td", { text: name }), el("td", { text: String(byEvaluator[name] || 0) })]));
  });
}

function renderHistory() {
  const records = loadRecords();
  const tbody = document.getElementById("historyBody");
  tbody.innerHTML = "";
  if (records.length === 0) {
    tbody.appendChild(el("tr", {}, [el("td", { colspan: "6", class: "empty", text: "저장된 평가 결과가 없습니다." })]));
    return;
  }
  records.forEach((r) => {
    const row = el("tr", {}, [
      el("td", { text: r.date }),
      el("td", { text: r.store }),
      el("td", { text: r.evaluator }),
      el("td", {}, [el("span", { class: `grade-chip grade-bg-${r.finalGrade}`, text: r.finalGrade })]),
      el("td", { text: r.memo || "-" }),
      el("td", {}, [
        el("button", { class: "small-btn", text: "복사", onclick: () => copyText(r.reportText) }),
        el("button", { class: "small-btn danger", text: "삭제", onclick: () => deleteRecord(r.id) }),
      ]),
    ]);
    tbody.appendChild(row);
  });
  updateStatsVisibility();
}

function deleteRecord(id) {
  if (!confirm("이 평가 결과를 삭제하시겠습니까?")) return;
  const records = loadRecords().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  renderHistory();
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => alert("결과가 클립보드에 복사되었습니다."),
    () => alert("복사에 실패했습니다. 인쇄 기능을 이용해 주세요.")
  );
}

function resetForm() {
  if (!confirm("현재 입력한 평가 내용을 모두 초기화할까요?")) return;
  state.answers = {};
  state.notes = {};
  document.querySelectorAll(".grade-btn.active").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".item-note").forEach((t) => (t.value = ""));
  document.getElementById("memo").value = "";
  document.getElementById("storeName").value = "";
  recalc();
}

function initButtons() {
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.textContent = isSyncEnabled() ? "결과 저장 (이 기기 + 공유)" : "결과 저장 (이 기기)";
  saveBtn.addEventListener("click", saveRecord);
  document.getElementById("copyBtn").addEventListener("click", () => copyText(buildReportText()));
  document.getElementById("printBtn").addEventListener("click", () => window.print());
  document.getElementById("resetBtn").addEventListener("click", resetForm);
  document.getElementById("statsRefreshBtn").addEventListener("click", renderStats);
}

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  renderCriteria();
  renderDomains();
  initButtons();
  renderHistory();
  recalc();
});
