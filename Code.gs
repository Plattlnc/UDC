/**
 * UDC Google Sheets
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var p = data.payload || {};
    var synced = [];

    var itemMap = {};
    var userMap = {};
    if (p["ft-inv-items"] && Array.isArray(p["ft-inv-items"])) {
      for (var i = 0; i < p["ft-inv-items"].length; i++) {
        itemMap[p["ft-inv-items"][i].id] = p["ft-inv-items"][i].name;
      }
    }
    if (p["ft-users"] && Array.isArray(p["ft-users"])) {
      for (var i = 0; i < p["ft-users"].length; i++) {
        userMap[p["ft-users"][i].id] = p["ft-users"][i].name;
      }
    }

    if (p["ft-users"])           { writeUsers(gs(ss,"직원목록"), p["ft-users"]); synced.push("직원목록"); }
    if (p["ft-reports"])         { writeReports(gs(ss,"판매일보"), p["ft-reports"], userMap); synced.push("판매일보"); }
    if (p["ft-inv-items"])       { writeInvItems(gs(ss,"재고품목"), p["ft-inv-items"]); synced.push("재고품목"); }
    if (p["ft-inv-stock"])       { writeInvStock(gs(ss,"직원별재고"), p["ft-inv-stock"], itemMap, userMap); synced.push("직원별재고"); }
    if (p["ft-inv-office"])      { writeOfficeStock(gs(ss,"사무실재고"), p["ft-inv-office"], itemMap); synced.push("사무실재고"); }
    if (p["ft-inv-log"])         { writeInvLog(gs(ss,"입출고기록"), p["ft-inv-log"]); synced.push("입출고기록"); }
    if (p["ft-inv-requests"])    { writeInvRequests(gs(ss,"보충요청"), p["ft-inv-requests"]); synced.push("보충요청"); }
    if (p["ft-fixed-costs"])     { writeFixedCosts(gs(ss,"고정비"), p["ft-fixed-costs"]); synced.push("고정비"); }
    if (p["ft-variable-costs"])  { writeVarCosts(gs(ss,"변동비"), p["ft-variable-costs"]); synced.push("변동비"); }
    if (p["ft-production"])      { writeProduction(gs(ss,"생산기록"), p["ft-production"]); synced.push("생산기록"); }
    if (p["ft-gas"])             { writeGas(gs(ss,"가스관리"), p["ft-gas"], userMap); synced.push("가스관리"); }
    if (p["ft-schedules"])       { writeSchedules(gs(ss,"근무스케줄"), p["ft-schedules"], userMap); synced.push("근무스케줄"); }
    if (p["ft-settings"])        { writeSettings(gs(ss,"설정"), p["ft-settings"], ss); synced.push("설정"); }
    if (p["ft-prod-settings"])   { writeProdSettings(gs(ss,"생산설정"), p["ft-prod-settings"]); synced.push("생산설정"); }

    logSync(ss, synced.join(", "));
    return makeJson({ ok: true, synced: synced });
  } catch (err) {
    return makeJson({ ok: false, error: err.message });
  }
}

function makeJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function gs(ss, name) {
  var s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); }
  return s;
}

function w(sheet, headers, rows, currCols) {
  sheet.clear();
  if (rows.length === 0) {
    sheet.getRange(1, 1).setValue("(데이터 없음)");
    return;
  }
  var all = [headers].concat(rows);
  sheet.getRange(1, 1, all.length, headers.length).setValues(all);
  var h = sheet.getRange(1, 1, 1, headers.length);
  h.setFontWeight("bold").setBackground("#1f2937").setFontColor("#ffffff");
  h.setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setVerticalAlignment("middle");
    for (var i = 0; i < rows.length; i++) {
      if (i % 2 === 1) {
        sheet.getRange(i + 2, 1, 1, headers.length).setBackground("#f9fafb");
      }
    }
  }
  if (currCols) {
    for (var j = 0; j < currCols.length; j++) {
      if (rows.length > 0) {
        sheet.getRange(2, currCols[j] + 1, rows.length, 1).setNumberFormat("#,##0");
      }
    }
  }
  for (var c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
    if (sheet.getColumnWidth(c) < 80) { sheet.setColumnWidth(c, 80); }
  }
}

function money(v) { return Number(v) || 0; }

function statusKo(s) {
  if (s === "active") return "재직";
  if (s === "resigned") return "퇴사";
  if (s === "deleted") return "삭제";
  if (s === "pending") return "대기";
  if (s === "approved") return "승인";
  if (s === "rejected") return "거절";
  return s || "";
}

function roleKo(r) {
  if (r === "admin") return "관리자";
  if (r === "employee") return "직원";
  return r || "";
}

function typeKo(t) {
  if (t === "sunsal") return "순살";
  if (t === "padak") return "파닭";
  if (t === "in") return "입고";
  if (t === "out") return "출고";
  return t || "";
}

function writeUsers(sheet, arr) {
  var headers = ["이름", "직급", "연락처", "입사일", "상태", "PIN"];
  var rows = [];
  for (var i = 0; i < arr.length; i++) {
    var u = arr[i];
    rows.push([u.name || "", roleKo(u.role), u.phone || "", u.hireDate || "", statusKo(u.status || "active"), u.pin || ""]);
  }
  w(sheet, headers, rows);
}

function writeReports(sheet, data, userMap) {
  var headers = ["날짜", "직원", "출근", "퇴근", "출하(순살)", "출하(파닭)", "판매(순살)", "판매(파닭)", "로스", "초벌", "이관", "현금", "비고"];
  var rows = [];
  var dates = Object.keys(data).sort();
  for (var d = 0; d < dates.length; d++) {
    var date = dates[d];
    var dr = data[date];
    if (!dr || typeof dr !== "object") continue;
    for (var rk in dr) {
      var r = dr[rk];
      if (!r || !r.savedAt) continue;
      var name = (r.userId && userMap[r.userId]) ? userMap[r.userId] : rk;
      rows.push([date, name, r.clockIn || "", r.clockOut || "", money(r.ship_sunsal), money(r.ship_padak), money(r.sunsal), money(r.padak), money(r.loss), money(r.chobeol), money(r.transfer), money(r.cash), r.memo || ""]);
    }
  }
  w(sheet, headers, rows, [4,5,6,7,8,9,10,11]);
}

function writeInvItems(sheet, arr) {
  var headers = ["품목명", "매입단가"];
  var rows = [];
  for (var i = 0; i < arr.length; i++) {
    rows.push([arr[i].name || "", money(arr[i].unitPrice)]);
  }
  w(sheet, headers, rows, [1]);
}

function writeInvStock(sheet, data, itemMap, userMap) {
  var itemIds = [];
  var seen = {};
  for (var eid in data) {
    var emp = data[eid];
    if (emp && typeof emp === "object") {
      var ks = Object.keys(emp);
      for (var i = 0; i < ks.length; i++) {
        if (ks[i].indexOf("_used") === -1 && !seen[ks[i]]) {
          itemIds.push(ks[i]);
          seen[ks[i]] = true;
        }
      }
    }
  }
  var headers = ["직원"];
  for (var i = 0; i < itemIds.length; i++) {
    headers.push(itemMap[itemIds[i]] || itemIds[i]);
  }
  var rows = [];
  for (var eid in data) {
    var emp = data[eid];
    var row = [userMap[eid] || eid];
    for (var i = 0; i < itemIds.length; i++) {
      row.push(emp && emp[itemIds[i]] !== undefined ? emp[itemIds[i]] : 0);
    }
    rows.push(row);
  }
  w(sheet, headers, rows);
}

function writeOfficeStock(sheet, data, itemMap) {
  var headers = ["품목", "수량"];
  var rows = [];
  for (var id in data) {
    rows.push([itemMap[id] || id, data[id] || 0]);
  }
  w(sheet, headers, rows);
}

function writeInvLog(sheet, arr) {
  var headers = ["날짜", "구분", "품목", "수량", "단가", "금액", "직원"];
  var sorted = arr.slice().sort(function(a, b) {
    if ((b.date || "") > (a.date || "")) return 1;
    if ((b.date || "") < (a.date || "")) return -1;
    return (b.id || 0) - (a.id || 0);
  });
  var rows = [];
  for (var i = 0; i < sorted.length; i++) {
    var l = sorted[i];
    rows.push([l.date || "", typeKo(l.type), l.itemName || "", l.qty || 0, money(l.unitPrice), money(l.totalCost), l.empName || ""]);
  }
  w(sheet, headers, rows, [4, 5]);
}

function writeInvRequests(sheet, arr) {
  var headers = ["요청일", "직원", "품목", "수량", "상태"];
  var sorted = arr.slice().sort(function(a, b) {
    return ((b.createdAt || "") > (a.createdAt || "")) ? 1 : -1;
  });
  var rows = [];
  for (var i = 0; i < sorted.length; i++) {
    var r = sorted[i];
    var d = r.createdAt ? r.createdAt.substring(0, 10) : "";
    rows.push([d, r.employeeName || "", r.itemName || "", r.qty || 0, statusKo(r.status)]);
  }
  w(sheet, headers, rows);
}

function writeFixedCosts(sheet, arr) {
  var headers = ["항목", "금액"];
  var rows = [];
  var total = 0;
  for (var i = 0; i < arr.length; i++) {
    var amt = money(arr[i].amount);
    rows.push([arr[i].name || "", amt]);
    total += amt;
  }
  rows.push(["합계", total]);
  w(sheet, headers, rows, [1]);
  sheet.getRange(rows.length + 1, 1, 1, 2).setFontWeight("bold").setBackground("#fef3c7");
}

function writeVarCosts(sheet, arr) {
  var headers = ["날짜", "분류", "금액"];
  var sorted = arr.slice().sort(function(a, b) {
    return ((b.date || "") > (a.date || "")) ? 1 : -1;
  });
  var rows = [];
  var total = 0;
  for (var i = 0; i < sorted.length; i++) {
    var amt = money(sorted[i].amount);
    rows.push([sorted[i].date || "", sorted[i].category || "", amt]);
    total += amt;
  }
  rows.push(["합계", "", total]);
  w(sheet, headers, rows, [2]);
  sheet.getRange(rows.length + 1, 1, 1, 3).setFontWeight("bold").setBackground("#fef3c7");
}

function writeProduction(sheet, arr) {
  var headers = ["날짜", "종류", "수량(개)", "kg당금액", "소모kg", "파값"];
  var sorted = arr.slice().sort(function(a, b) {
    return ((b.date || "") > (a.date || "")) ? 1 : -1;
  });
  var rows = [];
  for (var i = 0; i < sorted.length; i++) {
    var pr = sorted[i];
    rows.push([pr.date || "", typeKo(pr.type), money(pr.qty), money(pr.kgPrice), pr.usedKg || 0, money(pr.paPrice)]);
  }
  w(sheet, headers, rows);
}

function writeGas(sheet, data, userMap) {
  var headers = ["직원", "주유(메인)", "주유(서브)", "서브 사용량"];
  var rows = [];
  for (var uid in data) {
    var g = data[uid] || {};
    rows.push([userMap[uid] || uid, g.main || "", g.sub || "", g.subUsed || ""]);
  }
  w(sheet, headers, rows);
}

function writeSchedules(sheet, data, userMap) {
  var dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat"];
  var headers = ["직원", "월", "화", "수", "목", "금", "토"];
  var rows = [];
  for (var uid in data) {
    var s = data[uid] || {};
    var row = [userMap[uid] || uid];
    for (var d = 0; d < dayKeys.length; d++) {
      var v = s[dayKeys[d]];
      if (v === null || v === undefined) { row.push(""); }
      else if (typeof v === "object") { row.push(JSON.stringify(v)); }
      else { row.push(v); }
    }
    rows.push(row);
  }
  w(sheet, headers, rows);
}

function writeSettings(sheet, data, ss) {
  var labels = { pricePerUnit: "단가(개당)", hourlyWage: "시급", salesBonus: "판매수당(개당)" };
  var headers = ["설정항목", "값"];
  var rows = [];
  for (var k in data) {
    if (k === "empSettings" || k === "vehicles") continue;
    var v = data[k];
    if (typeof v === "object") { v = JSON.stringify(v); }
    rows.push([labels[k] || k, v]);
  }
  w(sheet, headers, rows, [1]);

  if (data.empSettings && typeof data.empSettings === "object") {
    writeEmpSettings(gs(ss, "직원별설정"), data.empSettings);
  }
  if (data.vehicles && typeof data.vehicles === "object") {
    writeVehicles(gs(ss, "차량배정"), data.vehicles);
  }
}

function writeEmpSettings(sheet, obj) {
  var labelMap = { hourlyWage: "시급", salesBonus: "판매수당", pricePerUnit: "단가" };
  var fieldSet = {};
  for (var uid in obj) {
    var s = obj[uid];
    if (s && typeof s === "object") {
      var ks = Object.keys(s);
      for (var i = 0; i < ks.length; i++) { fieldSet[ks[i]] = true; }
    }
  }
  var fields = Object.keys(fieldSet);
  var headers = ["직원ID"];
  for (var i = 0; i < fields.length; i++) {
    headers.push(labelMap[fields[i]] || fields[i]);
  }
  var rows = [];
  for (var uid in obj) {
    var s = obj[uid] || {};
    var row = [uid];
    for (var i = 0; i < fields.length; i++) {
      var v = s[fields[i]];
      if (v === null || v === undefined) { row.push(""); }
      else if (typeof v === "object") { row.push(JSON.stringify(v)); }
      else { row.push(v); }
    }
    rows.push(row);
  }
  w(sheet, headers, rows);
}

function writeVehicles(sheet, obj) {
  var headers = ["직원ID", "배정차량"];
  var rows = [];
  for (var uid in obj) {
    rows.push([uid, obj[uid] || ""]);
  }
  w(sheet, headers, rows);
}

function writeProdSettings(sheet, data) {
  var labels = { prodCost: "생산비(개당)", skewCost: "꽂이값(개당)" };
  var headers = ["설정항목", "값"];
  var rows = [];
  for (var k in data) {
    var v = data[k];
    if (typeof v === "object") { v = JSON.stringify(v); }
    rows.push([labels[k] || k, v !== undefined && v !== null ? v : ""]);
  }
  w(sheet, headers, rows, [1]);
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
    if (action === "readReports") {
      return readReports();
    }
    return makeJson({ ok: false, error: "unknown action" });
  } catch (err) {
    return makeJson({ ok: false, error: err.message });
  }
}

function readReports() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("판매일보");
  if (!sheet) return makeJson({ ok: false, error: "판매일보 시트 없음" });

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return makeJson({ ok: true, reports: {} });

  // Build name→userId map from 직원목록 sheet
  var nameToId = {};
  var userSheet = ss.getSheetByName("직원목록");
  if (userSheet) {
    var userData = userSheet.getDataRange().getValues();
    if (userData.length > 1) {
      for (var u = 1; u < userData.length; u++) {
        var uName = String(userData[u][0] || "").trim();
        // 직원목록 doesn't store ID directly, so use convention from app
        if (uName) nameToId[uName] = uName;
      }
    }
  }

  var headers = data[0];
  var colIdx = {};
  for (var c = 0; c < headers.length; c++) {
    colIdx[headers[c]] = c;
  }

  var reports = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var date = String(row[colIdx["날짜"]] || "").trim();
    if (!date) continue;
    var empName = String(row[colIdx["직원"]] || "").trim();
    if (!reports[date]) reports[date] = {};
    var rk = empName + "_sheet_" + i;
    reports[date][rk] = {
      employeeName: empName,
      clockIn: String(row[colIdx["출근"]] || ""),
      clockOut: String(row[colIdx["퇴근"]] || ""),
      ship_sunsal: Number(row[colIdx["출하(순살)"]] || 0),
      ship_padak: Number(row[colIdx["출하(파닭)"]] || 0),
      sunsal: Number(row[colIdx["판매(순살)"]] || 0),
      padak: Number(row[colIdx["판매(파닭)"]] || 0),
      loss: Number(row[colIdx["로스"]] || 0),
      chobeol: Number(row[colIdx["초벌"]] || 0),
      transfer: Number(row[colIdx["이관"]] || 0),
      cash: Number(row[colIdx["현금"]] || 0),
      savedAt: new Date(date + "T12:00:00").toISOString()
    };
  }

  return makeJson({ ok: true, reports: reports });
}

function logSync(ss, message) {
  var sheet = gs(ss, "동기화로그");
  var now = new Date();
  var ts = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([ts, message]);
}
