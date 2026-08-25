// 매장 안전보건관리체계 사전지원 평가 앱 로직
const STORAGE_KEY = "daiso_store_precheck_records_v1";

const state = {
  answers: {}, // itemId -> "A"|"B"|"C"|"D"|"NA"
  notes: {}, // itemId -> 수기 평가 결과 텍스트
  photos: {}, // itemId -> [{ id, dataUrl }]
  currentRecordId: null, // 불러온 기록의 id (이어서 저장 시 새로 쌓이지 않고 업데이트됨)
};

const PHOTO_MAX_DIM = 900;
const PHOTO_QUALITY = 0.6;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > PHOTO_MAX_DIM) {
          height = Math.round((height * PHOTO_MAX_DIM) / width);
          width = PHOTO_MAX_DIM;
        } else if (height >= width && height > PHOTO_MAX_DIM) {
          width = Math.round((width * PHOTO_MAX_DIM) / height);
          height = PHOTO_MAX_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

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

  const storeSelect = document.getElementById("storeName");
  STORE_LIST.forEach((s) => storeSelect.appendChild(el("option", { value: s, text: s })));
  storeSelect.addEventListener("change", () => updateStoreDocLink(storeSelect.value));

  const dateInput = document.getElementById("visitDate");
  const today = new Date();
  dateInput.value = today.toISOString().slice(0, 10);
}

function storeDocUrl(storeName) {
  return `store-docs/${encodeURIComponent(storeName)}.zip`;
}

function updateStoreDocLink(storeName) {
  const link = document.getElementById("docsStoreLink");
  if (!storeName) {
    link.href = "#";
    link.removeAttribute("download");
    link.setAttribute("aria-disabled", "true");
    link.classList.add("doc-link-disabled");
    link.textContent = "매장을 선택하면 해당 매장 자료 다운로드가 활성화됩니다";
    return;
  }
  link.href = storeDocUrl(storeName);
  link.setAttribute("download", "");
  link.removeAttribute("aria-disabled");
  link.classList.remove("doc-link-disabled");
  link.textContent = `${storeName} 자료 다운로드`;
}

function renderDocsList() {
  const list = document.getElementById("docsAllList");
  STORE_LIST.forEach((s) => {
    list.appendChild(el("a", { class: "doc-link doc-link-small", href: storeDocUrl(s), download: "", text: s }));
  });
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

function buildPhotoSection(itemId) {
  const thumbsWrap = el("div", { class: "photo-thumbs", id: `photo-thumbs-${itemId}` });

  const inputId = `photo-input-${itemId}`;
  const fileInput = el("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    multiple: "",
    id: inputId,
    class: "photo-input-hidden",
  });
  fileInput.addEventListener("change", async (e) => {
    await handlePhotoFiles(itemId, e.target.files, thumbsWrap);
    fileInput.value = "";
  });

  const addBtn = el("label", { class: "photo-add-btn", for: inputId, text: "📷 사진 촬영 · 첨부" });

  return el("div", { class: "photo-section" }, [addBtn, fileInput, thumbsWrap]);
}

async function handlePhotoFiles(itemId, fileList, thumbsWrap) {
  if (!state.photos[itemId]) state.photos[itemId] = [];
  for (const file of Array.from(fileList)) {
    try {
      const dataUrl = await compressImage(file);
      state.photos[itemId].push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, dataUrl });
    } catch (err) {
      alert("사진을 처리하지 못했습니다: " + file.name);
    }
  }
  renderPhotoThumbs(itemId, thumbsWrap);
}

function renderPhotoThumbs(itemId, thumbsWrap) {
  thumbsWrap.innerHTML = "";
  (state.photos[itemId] || []).forEach((p) => {
    thumbsWrap.appendChild(
      el("div", { class: "photo-thumb" }, [
        el("img", { src: p.dataUrl, alt: "첨부 사진" }),
        el("button", {
          class: "photo-remove-btn",
          type: "button",
          text: "×",
          onclick: () => {
            state.photos[itemId] = state.photos[itemId].filter((x) => x.id !== p.id);
            renderPhotoThumbs(itemId, thumbsWrap);
          },
        }),
      ])
    );
  });
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
      row.appendChild(buildPhotoSection(item.id));
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
      const photoCount = (state.photos[item.id] || []).length;
      if (photoCount > 0) lines.push(`      📷 사진 ${photoCount}장 첨부 (앱 화면 · 인쇄 미리보기에서 확인)`);
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
  const isUpdate = !!state.currentRecordId;
  const record = {
    id: state.currentRecordId || Date.now(),
    savedAt: new Date().toISOString(),
    store,
    evaluator,
    date: document.getElementById("visitDate").value,
    finalGrade,
    memo: document.getElementById("memo").value.trim(),
    answers: { ...state.answers },
    notes: { ...state.notes },
    photos: JSON.parse(JSON.stringify(state.photos)),
    reportText: buildReportText(),
  };
  const records = loadRecords();
  const existingIdx = isUpdate ? records.findIndex((r) => r.id === state.currentRecordId) : -1;
  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    records.unshift(record);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    alert("사진 용량이 커서 이 기기 저장 공간이 부족합니다.\n오래된 기록을 삭제하거나 사진 개수를 줄인 뒤 다시 시도해 주세요.");
    return;
  }
  state.currentRecordId = record.id;
  renderHistory();
  updateLoadedBanner();

  const savedWhereNote = existingIdx >= 0 ? "(기존 기록을 업데이트했습니다)" : "";
  if (!isSyncEnabled()) {
    alert(`이 기기에 저장되었습니다. ${savedWhereNote}\n(공유 저장소가 아직 연결되지 않아 다른 평가자와는 자동으로 합쳐지지 않습니다.)`);
    return;
  }
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "공유 저장소에 전송 중...";
  const { photos, ...syncRecord } = record; // 사진은 용량 문제로 공유 저장소에는 전송하지 않음
  const result = await pushToSync(syncRecord);
  saveBtn.disabled = false;
  saveBtn.textContent = "결과 저장 (이 기기 + 공유)";
  if (result.ok) {
    const photoNote = Object.keys(photos || {}).length > 0 ? "\n(사진은 용량 제한으로 이 기기에만 저장되며 공유 저장소에는 전송되지 않습니다)" : "";
    alert(`이 기기와 공유 저장소에 모두 저장되었습니다. ${savedWhereNote}${photoNote}`);
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
        el("button", { class: "small-btn primary-small", text: "불러오기", onclick: () => loadRecordIntoForm(r) }),
        el("button", { class: "small-btn", text: "복사", onclick: () => copyText(r.reportText) }),
        el("button", { class: "small-btn danger", text: "삭제", onclick: () => deleteRecord(r.id) }),
      ]),
    ]);
    tbody.appendChild(row);
  });
  renderStats();
}

function deleteRecord(id) {
  if (!confirm("이 평가 결과를 삭제하시겠습니까?")) return;
  const records = loadRecords().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  if (state.currentRecordId === id) {
    state.currentRecordId = null;
    updateLoadedBanner();
  }
  renderHistory();
}

function loadRecordIntoForm(record) {
  if (state.currentRecordId == null && hasUnsavedInput()) {
    if (!confirm("현재 입력 중인 내용이 저장되지 않았습니다. 그래도 불러오시겠습니까?")) return;
  }

  document.getElementById("visitDate").value = record.date || "";
  document.getElementById("evaluator").value = record.evaluator || "";
  document.getElementById("storeName").value = record.store || "";
  updateStoreDocLink(record.store || "");
  document.getElementById("memo").value = record.memo || "";

  state.answers = { ...record.answers };
  state.notes = { ...record.notes };
  state.photos = JSON.parse(JSON.stringify(record.photos || {}));
  state.currentRecordId = record.id;

  document.querySelectorAll(".grade-btn").forEach((b) => {
    b.classList.toggle("active", state.answers[b.dataset.item] === b.dataset.grade);
  });
  document.querySelectorAll(".item-note").forEach((t) => {
    const itemId = t.id.replace("note-", "");
    t.value = state.notes[itemId] || "";
  });
  document.querySelectorAll(".photo-thumbs").forEach((wrap) => {
    const itemId = wrap.id.replace("photo-thumbs-", "");
    renderPhotoThumbs(itemId, wrap);
  });

  recalc();
  updateLoadedBanner();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hasUnsavedInput() {
  return Object.keys(state.answers).length > 0 || Object.keys(state.notes).some((k) => state.notes[k]) || Object.keys(state.photos).some((k) => (state.photos[k] || []).length > 0);
}

function updateLoadedBanner() {
  const banner = document.getElementById("loadedBanner");
  if (state.currentRecordId) {
    const store = document.getElementById("storeName").value || "(매장명 없음)";
    document.getElementById("loadedBannerText").textContent = `"${store}" 저장된 평가를 불러왔습니다 — 이어서 평가 후 저장하면 이 기록이 업데이트됩니다.`;
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
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
  state.photos = {};
  state.currentRecordId = null;
  document.querySelectorAll(".grade-btn.active").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".item-note").forEach((t) => (t.value = ""));
  document.querySelectorAll(".photo-thumbs").forEach((t) => (t.innerHTML = ""));
  document.querySelectorAll(".photo-input-hidden").forEach((i) => (i.value = ""));
  document.getElementById("memo").value = "";
  document.getElementById("storeName").value = "";
  updateStoreDocLink("");
  updateLoadedBanner();
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
  document.getElementById("loadedBannerClear").addEventListener("click", resetForm);
}

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  renderDocsList();
  renderCriteria();
  renderDomains();
  initButtons();
  renderHistory();
  recalc();
});
