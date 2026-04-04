/**
 * UDC 대시보드 → Google Sheets 동기화
 *
 * 사용법:
 * 1. Google Sheets 새로 만들기
 * 2. 확장프로그램 > Apps Script 열기
 * 3. 이 코드를 Code.gs에 붙여넣기 + 저장
 * 4. 배포 > 새 배포 > 웹앱 > "본인 계정으로 실행" + "누구나 액세스" > 배포
 * 5. 권한 승인 > 웹앱 URL 복사
 * 6. UDC 앱 > 관리자 홈 > Google Sheets 동기화 > 설정 > URL 붙여넣기 > 저장
 */

/* ===== 메인 진입점 ===== */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action || "sync_all";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "sync_all") {
      var p = data.payload || {};
      var synced = [];

      // 각 시트별 전용 writer 호출
      var tasks = [
        { key: "ft-users",          name: "직원목록",     fn: writeUsers },
        { key: "ft-reports",        name: "판매일보",     fn: writeReports },
        { key: "ft-inv-items",      name: "재고품목",     fn: writeInvItems },
        { key: "ft-inv-stock",      name: "직원별재고",   fn: writeInvStock },
        { key: "ft-inv-office",     name: "사무실재고",   fn: writeOfficeStock },
        { key: "ft-inv-log",        name: "입출고기록",   fn: writeInvLog },
        { key: "ft-inv-requests",   name: "보충요청",     fn: writeInvRequests },
        { key: "ft-fixed-costs",    name: "고정비",       fn: writeFixedCosts },
        { key: "ft-variable-costs", name: "변동비",       fn: writeVarCosts },
        { key: "ft-production",     name: "생산기록",     fn: writeProduction },
        { key: "ft-gas",            name: "가스관리",     fn: writeGas },
        { key: "ft-schedules",      name: "근무스케줄",   fn: writeSchedules },
        { key: "ft-settings",       name: "설정",         fn: writeSettings },
        { key: "ft-prod-settings",  name: "생산설정",     fn: writeProdSettings }
      ];

      // 품목명 매핑용 (재고 시트에서 itemId → 품목명 변환)
      var itemMap = {};
      if (p["ft-inv-items"] && Array.isArray(p["ft-inv-items"])) {
        p["ft-inv-items"].forEach(function(it) { itemMap[it.id] = it.name; });
      }
      // 직원명 매핑용 (empId → 이름 변환)
      var userMap = {};
      if (p["ft-users"] && Array.isArray(p["ft-users"])) {
        p["ft-users"].forEach(function(u) { userMap[u.id] = u.name; });
      }

      tasks.forEach(function(t) {
        if (p[t.key] !== undefined && p[t.key] !== null) {
          var sheet = getOrCreateSheet(ss, t.name);
          try {
            t.fn(sheet, p[t.key], itemMap, userMap);
            synced.push(t.name);
          } catch (err) {
            logSync(ss, t.name + " 오류: " + err.message);
          }
        }
      });

      logSync(ss, "동기화 완료: " + synced.join(", "));
      return json({ ok: true, synced: synced });
    }

    return json({ ok: false, error: "unknown action" });
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}

/* ===== 유틸리티 ===== */

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function fmt(sheet, headers, rows, opts) {
  sheet.clear();
  if (rows.length === 0) {
    sheet.getRange(1, 1).setValue("(데이터 없음)");
    return;
  }
  var all = [headers].concat(rows);
  sheet.getRange(1, 1, all.length, headers.length).setValues(all);

  // 헤더 스타일
  var hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setFontWeight("bold").setBackground("#1f2937").setFontColor("#ffffff")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);

  // 데이터 영역 기본 스타일
  if (rows.length > 0) {
    var dRange = sheet.getRange(2, 1, rows.length, headers.length);
    dRange.setVerticalAlignment("middle");
    // 줄무늬
    for (var i = 0; i < rows.length; i++) {
      if (i % 2 === 1) {
        sheet.getRange(i + 2, 1, 1, headers.length).setBackground("#f9fafb");
      }
    }
  }

  // 금액 컬럼 포맷 (opts.currency = [colIndex, ...])
  if (opts && opts.currency) {
    opts.currency.forEach(function(col) {
      if (rows.length > 0) {
        sheet.getRange(2, col + 1, rows.length, 1).setNumberFormat("#,##0");
      }
    });
  }

  // 컬럼 너비 자동
  for (var c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
    // 최소 80px
    if (sheet.getColumnWidth(c) < 80) sheet.setColumnWidth(c, 80);
  }
}

function money(v) { return Number(v) || 0; }

function statusKo(s) {
  var m = { active: "재직", resigned: "퇴사", deleted: "삭제", pending: "대기", approved: "승인", rejected: "거절" };
  return m[s] || s || "";
}

function roleKo(r) {
  return r === "admin" ? "관리자" : r === "employee" ? "직원" : (r || "");
}

function typeKo(t) {
  var m = { sunsal: "순살", padak: "파닭", "in": "입고", "out": "출고" };
  return m[t] || t || "";
}

/* ===== 직원목록 ===== */

function writeUsers(sheet, arr) {
  if (!Array.isArray(arr)) { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["이름", "직급", "연락처", "입사일", "상태", "PIN"];
  var rows = arr.map(function(u) {
    return [u.name || "", roleKo(u.role), u.phone || "", u.hireDate || "", statusKo(u.status || "active"), u.pin || ""];
  });
  fmt(sheet, headers, rows);
}

/* ===== 판매일보 ===== */

function writeReports(sheet, data, itemMap, userMap) {
  if (!data || typeof data !== "object") { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["날짜", "직원", "출근", "퇴근", "출하(순살)", "출하(파닭)", "판매(순살)", "판매(파닭)", "로스", "초벌", "이관", "현금", "비고"];
  var rows = [];
  var dates = Object.keys(data).sort();
  dates.forEach(function(date) {
    var dr = data[date];
    if (!dr || typeof dr !== "object") return;
    for (var rk in dr) {
      var r = dr[rk];
      if (!r || !r.savedAt) continue;
      var name = (r.userId && userMap[r.userId]) || rk;
      rows.push([
        date, name,
        r.clockIn || "", r.clockOut || "",
        money(r.ship_sunsal), money(r.ship_padak),
        money(r.sunsal), money(r.padak),
        money(r.loss), money(r.chobeol), money(r.transfer), money(r.cash),
        r.memo || ""
      ]);
    }
  });
  fmt(sheet, headers, rows, { currency: [4,5,6,7,8,9,10,11] });
}

/* ===== 재고품목 ===== */

function writeInvItems(sheet, arr) {
  if (!Array.isArray(arr)) { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["품목명", "매입단가"];
  var rows = arr.map(function(it) {
    return [it.name || "", money(it.unitPrice)];
  });
  fmt(sheet, headers, rows, { currency: [1] });
}

/* ===== 직원별 재고 ===== */

function writeInvStock(sheet, data, itemMap, userMap) {
  if (!data || typeof data !== "object") { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  // 모든 아이템 ID 수집 (_used 제외)
  var itemIds = [];
  var seen = {};
  for (var eid in data) {
    var items = data[eid];
    if (items && typeof items === "object") {
      Object.keys(items).forEach(function(k) {
        if (k.indexOf("_used") === -1 && !seen[k]) { itemIds.push(k); seen[k] = true; }
      });
    }
  }
  var headers = ["직원"].concat(itemIds.map(function(id) { return itemMap[id] || id; }));
  var rows = [];
  for (var eid in data) {
    var items = data[eid];
    var name = userMap[eid] || eid;
    var row = [name];
    itemIds.forEach(function(id) {
      row.push(items && items[id] !== undefined ? items[id] : 0);
    });
    rows.push(row);
  }
  fmt(sheet, headers, rows);
}

/* ===== 사무실 재고 ===== */

function writeOfficeStock(sheet, data, itemMap) {
  if (!data || typeof data !== "object") { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["품목", "수량"];
  var rows = [];
  for (var itemId in data) {
    rows.push([itemMap[itemId] || itemId, data[itemId] || 0]);
  }
  fmt(sheet, headers, rows);
}

/* ===== 입출고 기록 ===== */

function writeInvLog(sheet, arr) {
  if (!Array.isArray(arr)) { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["날짜", "구분", "품목", "수량", "단가", "금액", "직원"];
  var sorted = arr.slice().sort(function(a, b) { return (b.date || "").localeCompare(a.date || "") || b.id - a.id; });
  var rows = sorted.map(function(l) {
    return [l.date || "", typeKo(l.type), l.itemName || "", l.qty || 0, money(l.unitPrice), money(l.totalCost), l.empName || ""];
  });
  fmt(sheet, headers, rows, { currency: [4, 5] });
}

/* ===== 보충요청 ===== */

function writeInvRequests(sheet, arr) {
  if (!Array.isArray(arr)) { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["요청일", "직원", "품목", "수량", "상태"];
  var sorted = arr.slice().sort(function(a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); });
  var rows = sorted.map(function(r) {
    var d = r.createdAt ? r.createdAt.substring(0, 10) : "";
    return [d, r.employeeName || "", r.itemName || "", r.qty || 0, statusKo(r.status)];
  });
  fmt(sheet, headers, rows);
}

/* ===== 고정비 ===== */

function writeFixedCosts(sheet, arr) {
  if (!Array.isArray(arr)) { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["항목", "금액"];
  var rows = arr.map(function(c) { return [c.name || "", money(c.amount)]; });
  // 합계 행
  var total = arr.reduce(function(a, c) { return a + money(c.amount); }, 0);
  rows.push(["합계", total]);
  fmt(sheet, headers, rows, { currency: [1] });
  // 합계 행 강조
  if (rows.length > 0) {
    var lastRow = rows.length + 1;
    sheet.getRange(lastRow, 1, 1, 2).setFontWeight("bold").setBackground("#fef3c7");
  }
}

/* ===== 변동비 ===== */

function writeVarCosts(sheet, arr) {
  if (!Array.isArray(arr)) { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["날짜", "분류", "금액"];
  var sorted = arr.slice().sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
  var rows = sorted.map(function(c) { return [c.date || "", c.category || "", money(c.amount)]; });
  // 합계 행
  var total = arr.reduce(function(a, c) { return a + money(c.amount); }, 0);
  rows.push(["합계", "", total]);
  fmt(sheet, headers, rows, { currency: [2] });
  if (rows.length > 0) {
    var lastRow = rows.length + 1;
    sheet.getRange(lastRow, 1, 1, 3).setFontWeight("bold").setBackground("#fef3c7");
  }
}

/* ===== 생산기록 ===== */

function writeProduction(sheet, arr) {
  if (!Array.isArray(arr)) { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["날짜", "종류", "수량(개)", "박스(수)"];
  var sorted = arr.slice().sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
  var rows = sorted.map(function(pr) {
    return [pr.date || "", typeKo(pr.type), money(pr.qty), money(pr.boxes)];
  });
  fmt(sheet, headers, rows);
}

/* ===== 가스관리 ===== */

function writeGas(sheet, data, itemMap, userMap) {
  if (!data || typeof data !== "object") { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var headers = ["직원", "주유(메인)", "주유(서브)", "서브 사용량"];
  var rows = [];
  for (var uid in data) {
    var g = data[uid] || {};
    rows.push([userMap[uid] || uid, g.main || "", g.sub || "", g.subUsed || ""]);
  }
  fmt(sheet, headers, rows);
}

/* ===== 근무스케줄 ===== */

function writeSchedules(sheet, data, itemMap, userMap) {
  if (!data || typeof data !== "object") { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat"];
  var headers = ["직원", "월", "화", "수", "목", "금", "토"];
  var rows = [];
  for (var uid in data) {
    var s = data[uid] || {};
    var row = [userMap[uid] || uid];
    dayKeys.forEach(function(d) {
      var v = s[d];
      if (v === null || v === undefined) row.push("");
      else if (typeof v === "object") row.push(JSON.stringify(v));
      else row.push(v);
    });
    rows.push(row);
  }
  fmt(sheet, headers, rows);
}

/* ===== 설정 ===== */

function writeSettings(sheet, data) {
  if (!data || typeof data !== "object") { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var labels = {
    pricePerUnit: "단가(개당)",
    hourlyWage: "시급",
    salesBonus: "판매수당(개당)"
  };
  var headers = ["설정항목", "값"];
  var rows = [];
  for (var k in data) {
    if (k === "empSettings" || k === "vehicles") continue;
    var label = labels[k] || k;
    var v = data[k];
    if (typeof v === "object") v = JSON.stringify(v);
    rows.push([label, v]);
  }
  fmt(sheet, headers, rows, { currency: [1] });

  // 직원별 설정 → 별도 시트
  if (data.empSettings && typeof data.empSettings === "object") {
    var ss = sheet.getParent();
    var esSheet = getOrCreateSheet(ss, "직원별설정");
    writeEmpSettings(esSheet, data.empSettings);
  }

  // 차량 배정 → 별도 시트
  if (data.vehicles && typeof data.vehicles === "object") {
    var ss2 = sheet.getParent();
    var vSheet = getOrCreateSheet(ss2, "차량배정");
    writeVehicles(vSheet, data.vehicles);
  }
}

function writeEmpSettings(sheet, empSettings) {
  var labelMap = {
    hourlyWage: "시급",
    salesBonus: "판매수당",
    pricePerUnit: "단가"
  };
  // 필드 수집
  var fieldSet = {};
  for (var uid in empSettings) {
    var s = empSettings[uid];
    if (s && typeof s === "object") {
      Object.keys(s).forEach(function(f) { fieldSet[f] = true; });
    }
  }
  var fields = Object.keys(fieldSet);
  var headers = ["직원ID"].concat(fields.map(function(f) { return labelMap[f] || f; }));
  var rows = [];
  for (var uid in empSettings) {
    var s = empSettings[uid] || {};
    var row = [uid];
    fields.forEach(function(f) {
      var v = s[f];
      if (v === null || v === undefined) row.push("");
      else if (typeof v === "object") row.push(JSON.stringify(v));
      else row.push(v);
    });
    rows.push(row);
  }
  fmt(sheet, headers, rows);
}

function writeVehicles(sheet, vehicles) {
  var headers = ["직원ID", "배정차량"];
  var rows = [];
  for (var uid in vehicles) {
    rows.push([uid, vehicles[uid] || ""]);
  }
  fmt(sheet, headers, rows);
}

/* ===== 생산설정 ===== */

function writeProdSettings(sheet, data) {
  if (!data || typeof data !== "object") { sheet.clear(); sheet.getRange(1,1).setValue("(데이터 없음)"); return; }
  var labels = {
    kgPrice: "kg당 단가",
    prodCost: "제작비(개당)"
  };
  var headers = ["설정항목", "값"];
  var rows = [];
  for (var k in data) {
    var v = data[k];
    if (typeof v === "object") v = JSON.stringify(v);
    rows.push([labels[k] || k, v !== undefined && v !== null ? v : ""]);
  }
  fmt(sheet, headers, rows, { currency: [1] });
}

/* ===== 동기화 로그 ===== */

function logSync(ss, message) {
  var sheet = getOrCreateSheet(ss, "동기화로그");
  var now = new Date();
  var ts = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([ts, message]);
}
