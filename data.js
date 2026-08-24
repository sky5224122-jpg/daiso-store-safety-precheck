// 매장 안전보건관리체계 사전지원 평가 - 항목 데이터
// 출처: 26년 매장 안전보건관리체(ISO45001) 준비 사항_26_0821.pptx (19~22페이지)

const EVALUATORS = ["강동현", "유준하", "서유림", "윤정인"];

const STORES = [
  { date: "8/25(화)", evaluator: "강동현", stores: ["신길점", "오류동점"] },
  { date: "8/27(목)", evaluator: "서유림", stores: ["스타필드하남점", "스타필드위례점"] },
  { date: "8/27(목)", evaluator: "유준하", stores: ["작전역점", "주안역점"] },
  { date: "8/28(금)", evaluator: "윤정인", stores: ["목동깨비시장점", "신도림점"] },
  { date: "8/28(금)", evaluator: "강동현", stores: ["신림역1호점", "구로시장점"] },
  { date: "8/28(금)", evaluator: "서유림", stores: ["포이사거리점", "강남구청역점"] },
];

const STORE_LIST = STORES.flatMap((s) => s.stores);

// 등급 점수 (평균 계산용, 미해당 항목은 제외)
const GRADE_SCORE = { A: 4, B: 3, C: 2, D: 1 };
const SCORE_TO_GRADE = { 4: "A", 3: "B", 2: "C", 1: "D" };

function scoreToGrade(avg) {
  const rounded = Math.max(1, Math.min(4, Math.round(avg)));
  return SCORE_TO_GRADE[rounded];
}

const GRADE_LABEL = {
  A: "양호",
  B: "일부 결손",
  C: "보강 필요",
  D: "집중 지원",
};
const GRADE_ACTION = {
  A: "후속 방문 불필요 · 분기 사후 확인만 진행",
  B: "보강자료 1회 제공 · 재점검 후 A등급 전환",
  C: "후속 방문 1~2회 · 핵심 보강자료 및 현장 코칭",
  D: "집중 지원팀 편성 · 후속 방문 2~3회 · 주간 점검",
};

const DOMAINS = [
  {
    key: "doc",
    title: "문서 영역",
    goal: "방침 · 목표 · 평가 · 교육 · 회의 기록의 정비 및 보존 상태",
    items: [
      { id: "doc-1", cat: "평가", name: "위험성평가서 — 정기", ref: "정기평가 결과 : 개선조치 이행 자료" },
      { id: "doc-2", cat: "평가", name: "위험성평가서 — 수시", ref: "재해 발생 시 수시평가 : 개선조치 이행 자료" },
      { id: "doc-3", cat: "평가", name: "관리감독자 업무 수행", ref: "26년 상반기 평가 결과 출력 보관" },
      { id: "doc-4", cat: "훈련", name: "비상대응훈련 기록 관리", ref: "25년 하반기, 26년 상반기 진행 결과" },
      { id: "doc-5", cat: "재해", name: "산업재해조사표 제출 이력", ref: "산재조사표 (해당 시)" },
      { id: "doc-6", cat: "교육", name: "TBM 일지", ref: "TBM 실행 일지" },
      { id: "doc-7", cat: "교육", name: "신규 채용안전교육 일지", ref: "신규입사자 교육 기록 · 교육 실시 기록" },
      { id: "doc-8", cat: "게시", name: "안전보건일반 자료 게시", ref: "안전보건경영방침 · 산업안전보건법령 요지 · 조직도 · ISO45001 인증서 · 관리감독자 임명장 · 안전보건표시 등" },
      { id: "doc-9", cat: "서류", name: "안전보건 행정 서류 (출력 보관)", ref: "안전보건관리규정 · 위험성평가 절차서 · 순회점검일지 · 비상사태대비 절차서 · 안전보호구 지급대장" },
      { id: "doc-10", cat: "서류", name: "안전보건 행정 서류 (해당 시)", ref: "소방시설관리 · 승강기관리 · 전기안전관리 · 리프트안전관리 · 소방안전계획서 등" },
    ],
  },
  {
    key: "site",
    title: "현장 영역",
    goal: "비상 · 소방 · 대피 · 보호구의 실제 운영 상태",
    items: [
      { id: "site-1", cat: "비상구", name: "비상구 표지 가시성 확보", ref: "주 통로 어디서나 식별 가능 · 등화 정상", onsite: "가능" },
      { id: "site-2", cat: "비상구", name: "비상구 통로 적재물 여부", ref: "통로 폭 80cm 이상 상시 확보", onsite: "가능" },
      { id: "site-3", cat: "대피", name: "피난안내도 정확성 · 게시 위치", ref: "현재 레이아웃 일치 · 주요 통행 지점 비치", onsite: "일부" },
      { id: "site-4", cat: "소방", name: "소화기 유효기간 · 월 점검", ref: "유효기간 내 · 월 점검표 갱신", onsite: "가능" },
      { id: "site-5", cat: "소방", name: "비상벨 · 비상조명 작동", ref: "월 1회 작동 테스트 기록", onsite: "일부" },
      { id: "site-6", cat: "소방", name: "소방훈련 실시 기록 — 반기 1회", ref: "훈련 일자 · 참석자 · 사진 보존", onsite: "불가" },
      { id: "site-7", cat: "창고", name: "창고 적재 높이 안전성", ref: "일반 1.5m · 중량물 1.0m 이하", onsite: "가능" },
      { id: "site-8", cat: "창고", name: "L카 · 롤테이너 동선 분리", ref: "고객동선 분리 · 입고 시간대 통제", onsite: "일부" },
      { id: "site-9", cat: "자동문", name: "자동문 끼임 방지 표시 · 센서", ref: "방지 표시 부착 · 안전센서 작동", onsite: "가능" },
      { id: "site-10", cat: "보호구", name: "보호구 지급 · 상태", ref: "작업별 지급 · 파손 시 즉시 교체", onsite: "가능" },
      { id: "site-11", cat: "보호구", name: "사다리 안전성 평가 — 연 1회", ref: "부적합 시 사용 중지 · 결과 사진 보관", onsite: "불가" },
      { id: "site-12", cat: "계절", name: "계절 안전 — 결빙 · 온열 · 장마", ref: "제설 자재 · 그늘 · 식수 사전 확보", onsite: "일부" },
    ],
  },
  {
    key: "interview",
    title: "인터뷰 영역",
    goal: "점장 · 파트장의 방침 이해 및 보고체계 숙지",
    items: [
      { id: "iv-1", cat: "점장", name: "안전보건 방침 — 한 줄 설명", ref: "중대재해 Zero 등 핵심 키워드 포함" },
      { id: "iv-2", cat: "점장", name: "2026년 안전보건 목표치", ref: "수치 목표 · 추진일정 인지" },
      { id: "iv-3", cat: "점장", name: "산업재해 발생 시 보고 절차", ref: "즉시 보고 → 조사표 기한 내 제출 인지", critical: true },
      { id: "iv-4", cat: "점장", name: "위험성평가 결과 공유 방법", ref: "정기 · 수시 결과 현장 게시 · 공지 인지" },
      { id: "iv-5", cat: "점장", name: "TBM 미실시 시 대응 방법", ref: "미실시 사유 기록 · 보완 계획 인지" },
      { id: "iv-6", cat: "점장", name: "현재 매장 최우선 보강 영역", ref: "구체적 영역 1개 이상 자가 진단" },
      { id: "iv-7", cat: "파트장", name: "현장 순회 직접 수행 이력", ref: "주 1회 이상 순회 · 결과 기록 인지" },
      { id: "iv-8", cat: "파트장", name: "입고 · 발주 작업 안전수칙", ref: "자동문 끼임 · L카 동선 · 베임예방 3개 이상" },
      { id: "iv-9", cat: "파트장", name: "보호구 · 안전시설 관리 권한", ref: "교체 요청 권한 · 비용 처리 절차 인지" },
    ],
  },
];
