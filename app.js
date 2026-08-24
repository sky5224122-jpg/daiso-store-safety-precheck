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
          item.critical ? el("span", { class: "critical-chip", text: "필수 · 자동등급조정" }) : null,
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

function domainGrade(domain) {
  const grades = domain.items
    .map((it) => state.answers[it.id])
    .filter((g) => g && g !== "NA");
  if (grades.length === 0) return null;
  return grades.reduce((worst, g) => (GRADE_RANK[g] > GRADE_RANK[worst] ? g : worst), "A");
}

function domainAnsweredCount(domain) {
  return domain.items.filter((it) => state.answers[it.id]).length;
}

function recalc() {
  let finalGrade = null;
  let interviewHasD = false;
  const domainGrades = {};

  DOMAINS.forEach((domain) => {
    const g = domainGrade(domain);
    domainGrades[domain.key] = g;
    const badge = document.getElementById(`badge-${domain.key}`);
    if (g) {
      badge.textContent = `${g} · ${GRADE_LABEL[g]}`;
      badge.className = `domain-grade-badge grade-bg-${g}`;
      if (finalGrade == null || GRADE_RANK[g] > GRADE_RANK[finalGrade]) finalGrade = g;
    } else {
      badge.textContent = "미평가";
      badge.className = "domain-grade-badge";
    }
    if (domain.key === "interview" && g === "D") interviewHasD = true;
  });

  const totalItems = DOMAINS.reduce((sum, d) => sum + d.items.length, 0);
  const answeredItems = DOMAINS.reduce((sum, d) => sum + domainAnsweredCount(d), 0);

  const progressEl = document.getElementById("progress");
  progressEl.textContent = `${answeredItems} / ${totalItems} 항목 평가 완료`;
  document.getElementById("progressBar").style.width = `${(answeredItems / totalItems) * 100}%`;

  const finalBox = document.getElementById("finalGrade");
  const finalReason = document.getElementById("finalReason");
  const warnBanner = document.getElementById("interviewWarning");

  if (!finalGrade) {
    finalBox.textContent = "-";
    finalBox.className = "final-grade-value";
    finalReason.textContent = "항목을 평가하면 최종 등급이 자동 계산됩니다.";
    warnBanner.classList.add("hidden");
    return;
  }

  finalBox.textContent = finalGrade;
  finalBox.className = `final-grade-value grade-bg-${finalGrade}`;
  finalReason.textContent = `${GRADE_LABEL[finalGrade]} · ${GRADE_ACTION[finalGrade]}`;

  if (interviewHasD) {
    warnBanner.classList.remove("hidden");
  } else {
    warnBanner.classList.add("hidden");
  }
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
    const g = domainGrade(domain);
    lines.push(`■ ${domain.title} — ${g ? `${g} (${GRADE_LABEL[g]})` : "미평가"}`);
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
  if (!document.getElementById("interviewWarning").classList.contains("hidden")) {
    lines.push(`⚠ 인터뷰 영역 D 발생 → 최종 등급 자동 D 확정`);
  }
  if (memo) {
    lines.push("");
    lines.push(`[특이사항] ${memo}`);
  }
  return lines.join("\n");
}

function saveRecord() {
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
  alert("이 기기에 평가 결과가 저장되었습니다.");
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function isManagerView() {
  return document.getElementById("evaluator").value === "강동현";
}

function updateStatsVisibility() {
  const card = document.getElementById("statsCard");
  const show = isManagerView();
  card.classList.toggle("hidden", !show);
  if (show) renderStats();
}

function renderStats() {
  const records = loadRecords();

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
  document.getElementById("saveBtn").addEventListener("click", saveRecord);
  document.getElementById("copyBtn").addEventListener("click", () => copyText(buildReportText()));
  document.getElementById("printBtn").addEventListener("click", () => window.print());
  document.getElementById("resetBtn").addEventListener("click", resetForm);
}

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  renderCriteria();
  renderDomains();
  initButtons();
  renderHistory();
  recalc();
});
