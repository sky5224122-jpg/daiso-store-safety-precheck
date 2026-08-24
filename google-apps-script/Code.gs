/**
 * 매장 안전보건관리체계 사전지원 평가 - 공유 저장소 (Google Apps Script)
 *
 * 4명의 평가자가 각자 기기에서 "결과 저장"을 누르면 이 스크립트가 연결된
 * 구글 스프레드시트 한 곳에 결과가 취합됩니다. 강동현 화면의 "매장 평가 통계"는
 * doGet()이 반환하는 이 시트의 전체 데이터를 불러와 집계합니다.
 *
 * 설치 방법은 이 폴더의 README.md 참고.
 */

const SHEET_NAME = "평가결과";
// index.html이 배포된 정적 사이트의 data.js SYNC_CONFIG.secret 값과 반드시 동일해야 합니다.
// 완전한 인증은 아니지만, 이 URL을 모르는 제3자의 무작위 기록 남용을 막는 최소한의 장치입니다.
const SHARED_SECRET = "daiso-shms-2026";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.secret !== SHARED_SECRET) {
      return jsonOutput({ ok: false, error: "unauthorized" });
    }
    const sheet = getSheet();
    sheet.appendRow([
      new Date(),
      data.id || "",
      data.date || "",
      data.store || "",
      data.evaluator || "",
      data.finalGrade || "",
      data.memo || "",
      JSON.stringify(data.answers || {}),
      JSON.stringify(data.notes || {}),
      data.reportText || "",
    ]);
    return jsonOutput({ ok: true });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    values.shift(); // 헤더 행 제거
    const records = values
      .filter((row) => row[1]) // id가 있는 행만
      .map((row) => ({
        savedAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0]),
        id: row[1],
        date: row[2],
        store: row[3],
        evaluator: row[4],
        finalGrade: row[5],
        memo: row[6],
        answers: safeParse(row[7]),
        notes: safeParse(row[8]),
        reportText: row[9],
      }));
    return jsonOutput({ ok: true, records });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "저장시각", "id", "방문일", "매장", "평가자", "최종등급", "메모",
      "answers_json", "notes_json", "report_text",
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
