import React, { useState, useEffect, useMemo, Component } from "react";
import { store, reportStore, markInflightUpsert, clearInflightUpsert, markInflightDelete, clearInflightDelete, applyInflightOverlay, enqueuePendingReport, getPendingReportsCount, flushPendingReports, enqueuePendingAppData, getPendingAppDataCount, flushPendingAppData, subscribeReports, syncToSheets, setSheetsUrl, getSheetsUrl, readFromSheets } from "./supabase.js";

// Error Boundary: 백지 화면 방지
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      var self = this;
      return React.createElement("div", { style: { padding: 32, textAlign: "center" } },
        React.createElement("p", { style: { fontSize: 18, fontWeight: 700, color: "#e1360a", margin: "0 0 12px" } }, "오류가 발생했습니다"),
        React.createElement("p", { style: { fontSize: 13, color: "#71717a", margin: "0 0 16px", wordBreak: "break-all" } }, String(this.state.error)),
        React.createElement("button", {
          onClick: function() { self.setState({ hasError: false, error: null }); },
          style: { padding: "10px 24px", fontSize: 14, fontWeight: 600, border: "1px solid #e1360a", borderRadius: 8, background: "#fff", color: "#e1360a", cursor: "pointer" }
        }, "다시 시도")
      );
    }
    return this.props.children;
  }
}

var DEFAULT_USERS = [
  { id: "admin1", name: "사장님", role: "admin", pin: "197356", phone: "", hireDate: "", status: "active" },
  { id: "emp1", name: "김민수", role: "employee", pin: "111111", phone: "", hireDate: "", status: "active" },
  { id: "emp2", name: "이서연", role: "employee", pin: "222222", phone: "", hireDate: "", status: "active" },
  { id: "emp3", name: "박준호", role: "employee", pin: "333333", phone: "", hireDate: "", status: "active" },
  { id: "emp4", name: "최유진", role: "employee", pin: "444444", phone: "", hireDate: "", status: "active" },
  { id: "emp5", name: "정하늘", role: "employee", pin: "555555", phone: "", hireDate: "", status: "active" }
];
var DEFAULT_SETTINGS = { pricePerUnit: 5000, hourlyWage: 10000, salesBonus: 1400 };

function getToday() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function normalizeDate(s) {
  if (!s || typeof s !== "string") return s;
  var p = s.split("-");
  if (p.length < 3) return s;
  return p[0] + "-" + p[1].padStart(2, "0") + "-" + p[2].padStart(2, "0");
}
function normalizeReportKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;
  var out = {};
  Object.entries(obj).forEach(function(e) {
    out[normalizeDate(e[0])] = e[1];
  });
  return out;
}
function normalizeDateField(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(function(item) {
    if (item && item.date) return Object.assign({}, item, { date: normalizeDate(item.date) });
    return item;
  });
}
function formatDate(s) {
  if (!s) return "-";
  var d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return String(s);
  return (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + ["일","월","화","수","목","금","토"][d.getDay()] + ")";
}
function formatTime(iso) {
  if (!iso) return "--:--";
  var d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return "0원";
  return n === 0 ? "0원" : Number(n).toLocaleString("ko-KR") + "원";
}
function calcWorkTime(ci, co) {
  if (!ci || !co) return null;
  var d = new Date(co) - new Date(ci);
  return Math.floor(d / 3600000) + "시간 " + Math.floor((d % 3600000) / 60000) + "분";
}
function getMonthLabel(s) {
  var d = new Date(s + "T00:00:00");
  return d.getFullYear() + "년 " + (d.getMonth() + 1) + "월";
}

function getDaysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

function DatePicker(dp) {
  var parts = dp.value.split("-");
  var ry = useState(Number(parts[0])), year = ry[0], setYear = ry[1];
  var rm = useState(Number(parts[1])), month = rm[0], setMonth = rm[1];
  var selDay = Number(parts[2]);
  var days = getDaysInMonth(year, month);
  var firstDow = new Date(year, month - 1, 1).getDay();
  var selMonth = Number(parts[1]) === month && Number(parts[0]) === year;
  var dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  function pick(d) {
    dp.onChange(year + "-" + String(month).padStart(2, "0") + "-" + String(d).padStart(2, "0"));
  }
  function prevM() { if (month === 1) { setMonth(12); setYear(year - 1); } else { setMonth(month - 1); } }
  function nextM() { if (month === 12) { setMonth(1); setYear(year + 1); } else { setMonth(month + 1); } }

  var cells = [];
  var ci;
  for (ci = 0; ci < firstDow; ci++) { cells.push(null); }
  for (ci = 1; ci <= days; ci++) { cells.push(ci); }

  return (
    <div style={Object.assign({}, CS, { padding: 20, marginBottom: 18 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <button onClick={prevM} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#71717a", padding: "4px 9px" }}>‹</button>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#18181b" }}>{year}년 {month}월</span>
        <button onClick={nextM} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#71717a", padding: "4px 9px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, textAlign: "center" }}>
        {dayNames.map(function(dn) {
          return <div key={dn} style={{ fontSize: 12, fontWeight: 600, color: "#a1a1aa", padding: 4 }}>{dn}</div>;
        })}
        {cells.map(function(d, idx) {
          if (d === null) return <div key={"e" + idx} />;
          var isSel = selMonth && d === selDay;
          return (
            <button key={idx} onClick={function() { pick(d); }}
              style={{ border: isSel ? "2px solid #e1360a" : "1px solid transparent", borderRadius: 11, background: isSel ? "#fff8f6" : "transparent", color: isSel ? "#e1360a" : "#18181b", fontSize: 15, fontWeight: isSel ? 700 : 500, cursor: "pointer", padding: "11px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}


var CS = {
  background: "#fff", borderRadius: 18, padding: 22,
  border: "1px solid #f0f0f3", marginBottom: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
};
var LS = { fontSize: 14, fontWeight: 600, color: "#71717a", marginBottom: 7, display: "block" };
var BP = { width: "100%", padding: 16, borderRadius: 14, border: "none", fontSize: 18, fontWeight: 700, cursor: "pointer", background: "#e1360a", color: "#fff" };
var BO = { padding: "11px 20px", borderRadius: 11, border: "1px solid #f0f0f3", fontSize: 15, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#18181b" };
var IS = { width: "100%", padding: "13px 16px", borderRadius: 11, border: "1px solid #f0f0f3", fontSize: 16, fontWeight: 500, color: "#18181b", outline: "none", background: "#fafafa", boxSizing: "border-box" };
var PAGE = { padding: "22px 22px 110px", maxWidth: 560, margin: "0 auto" };

function NumInput(p) {
  var r = useState(false), f = r[0], sF = r[1];
  return (
    <div>
      {p.label && <label style={LS}>{p.label}</label>}
      <div style={{ position: "relative" }}>
        <input type="number" inputMode="numeric" value={p.value}
          placeholder={p.placeholder || "0"} disabled={p.disabled}
          onChange={function(e) { p.onChange(e.target.value === "" ? "" : Number(e.target.value)); }}
          onFocus={function() { sF(true); }}
          onBlur={function() { sF(false); }}
          style={Object.assign({}, IS,
            f ? { borderColor: "#e1360a" } : {},
            p.disabled ? { background: "#f4f4f5", color: "#a1a1aa" } : {},
            p.suffix ? { paddingRight: 36 } : {}
          )}
        />
        {p.suffix && <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#a1a1aa", fontWeight: 500 }}>{p.suffix}</span>}
      </div>
    </div>
  );
}

function Toast(p) {
  if (!p.msg) return null;
  return (
    <div style={{ position: "fixed", top: 80, left: p.isUnfolded ? "calc(280px + 50%)" : "50%", transform: "translateX(-50%)", background: "#18181b", color: "#fff", padding: "13px 30px", borderRadius: 13, fontSize: 15, fontWeight: 700, zIndex: 200, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      {p.msg}
    </div>
  );
}

function Header(p) {
  return (
    <div style={{ padding: "18px 22px", background: "#fff", borderBottom: "1px solid #f0f0f3", position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 11 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#18181b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{p.title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 11, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#71717a", background: "#f4f4f5", padding: "7px 13px", borderRadius: 9 }}>{p.userName}</span>
        <button onClick={p.onLogout} style={Object.assign({}, BO, { padding: "7px 13px", fontSize: 13, color: "#71717a" })}>로그아웃</button>
      </div>
    </div>
  );
}

function BottomNav(p) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #f0f0f3", display: "flex", justifyContent: "space-around", padding: "9px 0 env(safe-area-inset-bottom,13px)", zIndex: 100 }}>
      {p.tabs.map(function(t) {
        return (
          <button key={t.id} onClick={function() { p.onSelect(t.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "9px 20px", position: "relative" }}>
            <span style={{ fontSize: 24 }}>{t.icon}</span>
            <span style={{ fontSize: 12, fontWeight: p.active === t.id ? 800 : 500, color: p.active === t.id ? "#e1360a" : "#a1a1aa" }}>{t.label}</span>
            {p.active === t.id && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 24, height: 3, borderRadius: 1, background: "#e1360a" }} />}
            {t.badge > 0 && <div style={{ position: "absolute", top: 0, right: 6, background: "#ffc40e", color: "#18181b", fontSize: 12, fontWeight: 700, borderRadius: 99, minWidth: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{t.badge}</div>}
          </button>
        );
      })}
    </nav>
  );
}

function LoginScreen(p) {
  var r1 = useState(""), pin = r1[0], setPin = r1[1];
  var r2 = useState(false), err = r2[0], setErr = r2[1];
  function tap(n) {
    if (pin.length < 6) {
      var next = pin + n;
      setPin(next);
      if (next.length === 6) {
        setTimeout(function() {
          if (!p.onLogin(next)) { setErr(true); setTimeout(function() { setErr(false); setPin(""); }, 600); }
        }, 150);
      }
    }
  }
  var pinDots = (
    <div style={{ display: "flex", gap: 14, marginBottom: 36 }}>
      {[0, 1, 2, 3, 4, 5].map(function(i) {
        return <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid " + (err ? "#e1360a" : pin.length > i ? "#e1360a" : "#d4d4d8"), background: pin.length > i ? "#e1360a" : "transparent", transition: "all 0.15s" }} />;
      })}
    </div>
  );
  var keypad = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, width: "100%", maxWidth: 296 }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"].map(function(n, i) {
        return (
          <button key={i} onClick={function() { if (n === "⌫") setPin(function(q) { return q.slice(0, -1); }); else if (n !== null) tap(String(n)); }}
            style={{ width: "100%", aspectRatio: "1", minHeight: 72, borderRadius: 20, border: "1px solid #f0f0f3", background: n === null ? "transparent" : "#fafafa", color: "#18181b", fontSize: n === "⌫" ? 24 : 30, fontWeight: 600, cursor: n === null ? "default" : "pointer", visibility: n === null ? "hidden" : "visible", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {n}
          </button>
        );
      })}
    </div>
  );
  if (p.isUnfolded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: "#fff" }}>
        <div style={{ width: 280, background: "#e1360a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 48, color: "#fff", fontWeight: 900 }}>U</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0, textAlign: "center" }}>UDC 대시보드</h1>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <p style={{ color: "#a1a1aa", fontSize: 15, margin: "0 0 32px" }}>PIN 6자리를 입력하세요</p>
          {pinDots}
          {keypad}
          {err && <p style={{ color: "#e1360a", fontSize: 15, marginTop: 16, fontWeight: 600 }}>PIN이 올바르지 않습니다</p>}
        </div>
      </div>
    );
  }
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", padding: 22 }}>
      <div style={{ width: 96, height: 96, borderRadius: 24, background: "#e1360a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 48, color: "#fff", fontWeight: 900 }}>U</span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#e1360a", margin: "13px 0 4px" }}>UDC 대시보드</h1>
      <p style={{ color: "#a1a1aa", fontSize: 15, margin: "0 0 32px" }}>PIN 6자리를 입력하세요</p>
      {pinDots}
      {keypad}
      {err && <p style={{ color: "#e1360a", fontSize: 15, marginTop: 16, fontWeight: 600 }}>PIN이 올바르지 않습니다</p>}
    </div>
  );
}

function EmpHome(p) {
  var user = p.user, reports = p.reports, settings = p.settings;
  var today = getToday();
  var r3 = useState(10), show = r3[0], setShow = r3[1];

  var now = new Date();
  var thisMonthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
  var weekKey = weekAgo.getFullYear() + "-" + String(weekAgo.getMonth() + 1).padStart(2, "0") + "-" + String(weekAgo.getDate()).padStart(2, "0");

  var stats = useMemo(function() {
    var mSold = 0, mRev = 0, wSold = 0, wRev = 0;
    var price = settings.pricePerUnit || 5000;
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      Object.values(dr).forEach(function(r) {
        var uid = r.userId || "";
        if (uid === user.id && r.savedAt) {
          var s = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          if (date.substring(0, 7) === thisMonthKey) { mSold += s; mRev += s * price; }
          if (date >= weekKey) { wSold += s; wRev += s * price; }
        }
      });
    });
    return { mSold: mSold, mRev: mRev, wSold: wSold, wRev: wRev };
  }, [reports, user.id, settings, thisMonthKey, weekKey]);

  var hist = useMemo(function() {
    var l = [];
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      Object.entries(dr).forEach(function(re) {
        var rk = re[0], r = re[1];
        var uid = r.userId || rk;
        if (uid === user.id && r.savedAt && r.clockIn) {
          l.push({ date: date, clockIn: r.clockIn, clockOut: r.clockOut || "" });
        }
      });
    });
    return l.sort(function(a, b) { return b.date.localeCompare(a.date); });
  }, [reports, user.id]);

  function calcMins(ci, co) {
    if (!ci || !co) return null;
    var a = ci.split(":"), b = co.split(":");
    var m = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
    if (m < 0) m += 1440;
    return Math.floor(m / 60) + "시간 " + (m % 60) + "분";
  }

  return (
    <div style={PAGE}>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#71717a", margin: "0 0 13px", textAlign: "center" }}>{formatDate(today)}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 16 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>🍗 월간 판매</p>
          <p style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{stats.mSold}<span style={{ fontSize: 15, fontWeight: 500, color: "#a1a1aa" }}> 개</span></p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>🍗 주간 판매</p>
          <p style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>{stats.wSold}<span style={{ fontSize: 15, fontWeight: 500, color: "#a1a1aa" }}> 개</span></p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 18 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 월간매출</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.mRev)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 주간매출</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.wRev)}</p>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: "22px 0" })}>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 13px", padding: "0 22px" }}>📋 근무 현황</p>
        {hist.length === 0 ? <p style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 15 }}>근무 이력이 없습니다</p> : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "11px 22px", borderBottom: "1px solid #f4f4f5", fontSize: 13, fontWeight: 600, color: "#a1a1aa" }}>
              <span>날짜</span><span style={{ textAlign: "center" }}>출/퇴근</span><span style={{ textAlign: "right" }}>근무시간</span>
            </div>
            {hist.slice(0, show).map(function(r, i) {
              var wt = calcMins(r.clockIn, r.clockOut);
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "13px 22px", borderBottom: "1px solid #f4f4f5", fontSize: 15 }}>
                  <span style={{ fontWeight: 600 }}>{formatDate(r.date)}</span>
                  <span style={{ textAlign: "center", color: "#71717a", fontSize: 14 }}>{r.clockIn} ~ {r.clockOut || "--:--"}</span>
                  <span style={{ textAlign: "right", fontWeight: 600, color: wt ? "#18181b" : "#a1a1aa" }}>{wt || "-"}</span>
                </div>
              );
            })}
            {show < hist.length && <button onClick={function() { setShow(function(c) { return c + 10; }); }} style={Object.assign({}, BO, { width: "calc(100% - 36px)", margin: "13px 18px 0", textAlign: "center", fontSize: 14, color: "#71717a" })}>더 보기</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function EmpVehicle(p) {
  var user = p.user, reports = p.reports, settings = p.settings, gasData = p.gasData, setGasData = p.setGasData;
  var schedules = p.schedules, setSchedules = p.setSchedules;
  var vehicles = settings.vehicles || {};
  var vehicleName = vehicles[user.id] || "없음";
  var myGas = gasData[user.id] || {};
  var mainDate = myGas.main || "";
  var subDate = myGas.sub || "";
  var subUsedCount = myGas.subUsed || 0;
  var mySch = schedules[user.id] || {};
  var dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat"];
  var dayLabels = ["월", "화", "수", "목", "금", "토"];

  function countWorkDays(sinceDate) {
    if (!sinceDate) return 5;
    var count = 0;
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      if (date > sinceDate) {
        Object.entries(dr).forEach(function(re) {
          var r = re[1];
          var uid = r.userId || re[0];
          if (uid === user.id && r.clockIn) count++;
        });
      }
    });
    return count;
  }

  var mainUsed = countWorkDays(mainDate);
  var mainBlocks = Math.max(0, 5 - mainUsed);
  var mainPct = Math.max(0, 100 - mainUsed * 20);
  var subBlocks = Math.max(0, 5 - subUsedCount);
  var subPct = Math.max(0, 100 - subUsedCount * 20);

  function updateGas(obj) {
    var u = JSON.parse(JSON.stringify(gasData));
    if (!u[user.id]) u[user.id] = {};
    Object.assign(u[user.id], obj);
    setGasData(u);
    store.set("ft-gas", u);
  }

  function replaceMain() {
    updateGas({ main: getToday() });
  }

  function replaceSub() {
    updateGas({ sub: getToday(), subUsed: 0 });
  }

  function useSub() {
    if (subUsedCount < 5) {
      updateGas({ subUsed: subUsedCount + 1 });
    }
  }

  function renderGauge(blocks, pct, lastDate, type) {
    var needReplace = blocks <= 1;
    var isSub = type === "sub";
    return (
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#18181b" }}>{isSub ? "서브" : "메인"}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: needReplace ? "#e1360a" : "#71717a", marginLeft: 9 }}>{pct}%</span>
            {needReplace && <span style={{ fontSize: 12, fontWeight: 700, color: "#e1360a", marginLeft: 7 }}>교체필요</span>}
            {isSub && <span style={{ fontSize: 12, color: "#a1a1aa", marginLeft: 7 }}>수동</span>}
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            {isSub && (
              <button onClick={useSub} disabled={subUsedCount >= 5}
                style={Object.assign({}, BO, { padding: "7px 13px", fontSize: 13, color: subUsedCount < 5 ? "#e1360a" : "#d4d4d8", borderColor: subUsedCount < 5 ? "#f5c6c0" : "#f0f0f3" })}>
                사용 −1
              </button>
            )}
            <button onClick={isSub ? replaceSub : replaceMain}
              style={Object.assign({}, BO, { padding: "7px 13px", fontSize: 13, color: "#16a34a", borderColor: "#bbf7d0", background: "#f0fdf4" })}>
              교체완료
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, marginBottom: 7 }}>
          {[0, 1, 2, 3, 4].map(function(i) {
            var filled = i < blocks;
            return (
              <div key={i} style={{ flex: 1, height: 30, borderRadius: 7, background: filled ? (needReplace ? "#fca5a5" : "#e1360a") : "#f4f4f5", transition: "all 0.3s" }} />
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "#18181b", opacity: 0.35, margin: "4px 0 0", fontWeight: 500 }}>
          마지막 교체: {lastDate ? formatDate(lastDate) : "기록 없음"}
        </p>
      </div>
    );
  }

  function updateSchedule(day, val) {
    var u = JSON.parse(JSON.stringify(schedules));
    if (!u[user.id]) u[user.id] = {};
    u[user.id][day] = val;
    setSchedules(u);
    store.set("ft-schedules", u);
  }

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { textAlign: "center", padding: "22px 18px" })}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#71717a", margin: "0 0 4px" }}>배정 차량</p>
        <p style={{ fontSize: 28, fontWeight: 800, color: vehicleName === "없음" ? "#a1a1aa" : "#18181b", margin: 0 }}>{vehicleName}</p>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#18181b", margin: "4px 0 11px" }}>🔥 야끼바 가스</p>
      {renderGauge(mainBlocks, mainPct, mainDate, "main")}
      {renderGauge(subBlocks, subPct, subDate, "sub")}
      <div style={Object.assign({}, CS, { padding: 16 })}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#18181b", margin: "0 0 13px" }}>📍 주간 출근지</p>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "48px repeat(6, 110px)", gap: 9, minWidth: 720 }}>
            <div />
            {dayLabels.map(function(label) {
              return <div key={label} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#71717a", padding: "4px 0" }}>{label}</div>;
            })}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e1360a", display: "flex", alignItems: "center" }}>메인</div>
            {dayKeys.map(function(dk) {
              return (
                <input key={"m_" + dk} value={mySch[dk + "_main"] || ""} placeholder="-"
                  onChange={function(e) { updateSchedule(dk + "_main", e.target.value); }}
                  style={{ width: "100%", padding: "9px 7px", borderRadius: 7, border: "1px solid #f0f0f3", fontSize: 14, fontWeight: 600, textAlign: "center", outline: "none", background: "#fafafa", color: "#18181b", boxSizing: "border-box" }} />
              );
            })}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#71717a", display: "flex", alignItems: "center" }}>서브</div>
            {dayKeys.map(function(dk) {
              return (
                <input key={"s_" + dk} value={mySch[dk + "_sub"] || ""} placeholder="-"
                  onChange={function(e) { updateSchedule(dk + "_sub", e.target.value); }}
                  style={{ width: "100%", padding: "9px 7px", borderRadius: 7, border: "1px solid #f0f0f3", fontSize: 14, fontWeight: 600, textAlign: "center", outline: "none", background: "#fafafa", color: "#18181b", boxSizing: "border-box" }} />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmpReport(p) {
  var user = p.user, reports = p.reports, settings = p.settings;
  var today = getToday();
  var r1 = useState(null), selKey = r1[0], setSelKey = r1[1];
  var r2 = useState("date"), sortBy = r2[0], setSortBy = r2[1];
  var r3 = useState(10), show = r3[0], setShow = r3[1];
  var r4 = useState(""), toast = r4[0], setToast = r4[1];
  var emptyForm = { clockIn: "", clockOut: "", ship_sunsal: "", ship_padak: "", sunsal: "", padak: "", loss: "", chobeol: "", transfer: "", cash: "" };
  var r5 = useState(emptyForm), formData = r5[0], setFormData = r5[1];
  var r6 = useState(false), editing = r6[0], setEditing = r6[1];
  var r7 = useState(false), isNew = r7[0], setIsNew = r7[1];
  var r8 = useState(today), newDate = r8[0], setNewDate = r8[1];
  var r9 = useState(null), selDate = r9[0], setSelDate = r9[1];
  var r10 = useState(false), showCal = r10[0], setShowCal = r10[1];
  var nowR = new Date();
  var rv1 = useState(nowR.getFullYear()), viewYear = rv1[0], setViewYear = rv1[1];
  var rv2 = useState(nowR.getMonth() + 1), viewMonth = rv2[0], setViewMonth = rv2[1];
  var rv3 = useState(false), viewAll = rv3[0], setViewAll = rv3[1];

  var list = useMemo(function() {
    var l = [];
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      Object.entries(dr).forEach(function(re) {
        var rk = re[0], r = re[1];
        var uid = r.userId || rk;
        if (uid === user.id && r.savedAt) {
          var sold = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          l.push({ date: date, rk: rk, sold: sold, rev: sold * (settings.pricePerUnit || 5000), savedAt: r.savedAt, ship_sunsal: r.ship_sunsal || 0, ship_padak: r.ship_padak || 0, sunsal: r.sunsal || 0, padak: r.padak || 0, loss: r.loss || 0 });
        }
      });
    });
    if (sortBy === "revenue") l.sort(function(a, b) { return b.rev - a.rev; });
    else l.sort(function(a, b) { return (b.date + b.savedAt).localeCompare(a.date + a.savedAt); });
    return l;
  }, [reports, user.id, settings, sortBy]);

  function openReport(date, rk) {
    var ex = reports[date] ? reports[date][rk] : null;
    if (ex) {
      setFormData({ clockIn: ex.clockIn || "", clockOut: ex.clockOut || "", ship_sunsal: ex.ship_sunsal || "", ship_padak: ex.ship_padak || "", sunsal: ex.sunsal || "", padak: ex.padak || "", loss: ex.loss || "", chobeol: ex.chobeol || "", transfer: ex.transfer || "", cash: ex.cash || "" });
      setEditing(false);
    }
    setSelDate(date);
    setSelKey(rk);
    setIsNew(false);
  }

  function openNew() {
    setFormData(emptyForm);
    setNewDate(today);
    setEditing(true);
    setIsNew(true);
    setSelKey("new");
    setSelDate(null);
    setShowCal(true);
  }

  function up(k, v) {
    var obj = Object.assign({}, formData);
    obj[k] = v;
    setFormData(obj);
  }

  async function save() {
    var prevReports = reports;        // optimistic 롤백용 스냅샷
    var prevSelDate = selDate;
    var prevSelKey = selKey;
    var prevIsNew = isNew;
    var prevShowCal = showCal;
    try {
      var u = JSON.parse(JSON.stringify(reports));
      var saveDate = isNew ? newDate : selDate;
      if (!saveDate) { setToast("날짜를 선택하세요"); setTimeout(function() { setToast(""); }, 2000); return; }
      if (!u[saveDate]) u[saveDate] = {};
      var key;
      if (isNew) {
        key = user.id + "_" + Date.now();
      } else {
        key = selKey;
      }
      var reportData = Object.assign({}, formData, { savedAt: new Date().toISOString(), employeeName: user.name, userId: user.id });
      u[saveDate][key] = reportData;
      // 1) optimistic UI 갱신
      p.setReports(u);
      setEditing(false);
      setIsNew(false);
      setShowCal(false);
      setSelDate(saveDate);
      setSelKey(key);
      // 2) in-flight 등록 (visibility reload race 가드)
      var row = reportStore.toRow(key, saveDate, reportData);
      markInflightUpsert(key, saveDate, reportData);
      // 3) DB 저장 결과 대기 (1회 재시도 포함)
      var result = await reportStore.upsertWithError(row);
      clearInflightUpsert(key);
      if (result && result.ok) {
        setToast("저장 완료!");
        setTimeout(function() { setToast(""); }, 2000);
      } else {
        // 4) 실패 → 응급 큐 적재 + optimistic 롤백 + 사용자 알림
        console.error("[EmpReport.save] DB 저장 실패:", result && result.message);
        var pendingCount = enqueuePendingReport(row);
        p.setReports(prevReports);
        setEditing(true);
        setIsNew(prevIsNew);
        setShowCal(prevShowCal);
        setSelDate(prevSelDate);
        setSelKey(prevSelKey);
        setToast("저장 실패 — 오프라인 큐에 보관됨 (" + pendingCount + "건 대기, 네트워크 복귀 시 자동 재시도)");
        setTimeout(function() { setToast(""); }, 4500);
      }
    } catch(e) {
      console.error("[EmpReport.save] 오류:", e);
      // 예외 시에도 안전하게 이전 상태로 복원
      try { p.setReports(prevReports); } catch(_) {}
      setEditing(true);
      setIsNew(prevIsNew);
      setShowCal(prevShowCal);
      setSelDate(prevSelDate);
      setSelKey(prevSelKey);
      setToast("저장 실패: " + (e && e.message ? e.message : "오류"));
      setTimeout(function() { setToast(""); }, 3000);
    }
  }

  function goBack() {
    setSelKey(null);
    setSelDate(null);
    setIsNew(false);
    setShowCal(false);
  }

  var shipped = (Number(formData.ship_sunsal) || 0) + (Number(formData.ship_padak) || 0);
  var sold = (Number(formData.sunsal) || 0) + (Number(formData.padak) || 0);
  var rem = shipped - sold - (Number(formData.loss) || 0);
  var rev = sold * (settings.pricePerUnit || 5000);
  var displayDate = isNew ? newDate : selDate;

  // hooks는 early return 전에 호출해야 함 (React 규칙)
  var viewMonthKey = viewYear + "-" + String(viewMonth).padStart(2, "0");
  var filteredList = useMemo(function() {
    if (viewAll) return list;
    return list.filter(function(r) { return r.date.substring(0, 7) === viewMonthKey; });
  }, [list, viewMonthKey, viewAll]);

  var monthSummary = useMemo(function() {
    var s = 0, rv = 0;
    filteredList.forEach(function(r) { s += r.sold; rv += r.rev; });
    return { sold: s, rev: rv, count: filteredList.length };
  }, [filteredList]);

  function prevMonth() { if (viewMonth === 1) { setViewMonth(12); setViewYear(viewYear - 1); } else { setViewMonth(viewMonth - 1); } setShow(10); }
  function nextMonth() { if (viewMonth === 12) { setViewMonth(1); setViewYear(viewYear + 1); } else { setViewMonth(viewMonth + 1); } setShow(10); }

  if (selKey !== null) {
    var isSaved = !isNew && selDate && reports[selDate] && reports[selDate][selKey] && reports[selDate][selKey].savedAt;
    return (
      <div style={PAGE}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button onClick={goBack} style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 13 })}>← 목록</button>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#18181b", margin: 0 }}>📅 {formatDate(displayDate)}</p>
          {isSaved && !editing ? <button onClick={function() { setEditing(true); }} style={Object.assign({}, BO, { padding: "4px 14px", fontSize: 13 })}>수정</button> : <div style={{ width: 48 }} />}
        </div>
        {isNew && showCal && <DatePicker value={newDate} onChange={function(d) { setNewDate(d); }} />}
        {isNew && showCal && (
          <button onClick={function() { setShowCal(false); }}
            style={Object.assign({}, BO, { width: "100%", marginBottom: 16, textAlign: "center", fontSize: 13, color: "#e1360a", borderColor: "#f5c6c0" })}>
            날짜 확정: {formatDate(newDate)}
          </button>
        )}
        {isNew && !showCal && (
          <button onClick={function() { setShowCal(true); }}
            style={Object.assign({}, BO, { width: "100%", marginBottom: 16, textAlign: "center", fontSize: 13 })}>
            📅 날짜 변경: {formatDate(newDate)}
          </button>
        )}
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "0 0 11px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>🕐 출퇴근</p>
            {formData.clockIn && formData.clockOut && (function() {
              var ci = formData.clockIn.split(":");
              var co = formData.clockOut.split(":");
              var mins = (Number(co[0]) * 60 + Number(co[1])) - (Number(ci[0]) * 60 + Number(ci[1]));
              if (mins < 0) mins += 1440;
              var h = Math.floor(mins / 60);
              var m = mins % 60;
              return <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a", opacity: 0.7 }}>{h}시간 {m}분</span>;
            })()}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={LS}>출근</label>
              <input type="time" value={formData.clockIn} disabled={!editing}
                onChange={function(e) { up("clockIn", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LS}>퇴근</label>
              <input type="time" value={formData.clockOut} disabled={!editing}
                onChange={function(e) { up("clockOut", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "0 0 11px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>📤 출고</p>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#18181b", opacity: 0.35 }}>{shipped}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumInput label="순살" value={formData.ship_sunsal} onChange={function(v) { up("ship_sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.ship_padak} onChange={function(v) { up("ship_padak", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "0 0 11px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>🧾 판매</p>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#e1360a", background: "#fff8f6", padding: "2px 9px", borderRadius: 7 }}>{sold}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <NumInput label="순살" value={formData.sunsal} onChange={function(v) { up("sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.padak} onChange={function(v) { up("padak", v); }} disabled={!editing} suffix="개" />
            <NumInput label="로스" value={formData.loss} onChange={function(v) { up("loss", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: "0 0 11px" }}>📊 잔여</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            <div>
              <label style={LS}>출고-판매-로스 (자동)</label>
              <div style={{ padding: "9px 13px", borderRadius: 9, background: "#f4f4f5", border: "1px solid #f0f0f3", fontSize: 20, fontWeight: 800, color: rem < 0 ? "#e1360a" : "#18181b" }}>{rem} 개</div>
            </div>
            <NumInput label="초벌" value={formData.chobeol} onChange={function(v) { up("chobeol", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: "0 0 11px" }}>💰 매출</p>
          <div style={{ marginBottom: 16 }}>
            <label style={LS}>총 매출 (자동)</label>
            <div style={{ padding: "9px 13px", borderRadius: 9, background: "#fff8f6", border: "1px solid #f5c6c0", fontSize: 20, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(rev)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumInput label="계좌이체" value={formData.transfer} onChange={function(v) { up("transfer", v); }} disabled={!editing} suffix="원" />
            <NumInput label="현금" value={formData.cash} onChange={function(v) { up("cash", v); }} disabled={!editing} suffix="원" />
          </div>
        </div>
        {editing && <button onClick={save} style={BP}>{isNew ? "기록 저장" : "수정 저장"}</button>}
        <Toast msg={toast} isUnfolded={p.isUnfolded} />
      </div>
    );
  }

  return (
    <div style={PAGE}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={function() { setSortBy("date"); setShow(10); }} style={Object.assign({}, BO, { padding: "6px 14px", fontSize: 13 }, sortBy === "date" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>날짜순</button>
        <button onClick={function() { setSortBy("revenue"); setShow(10); }} style={Object.assign({}, BO, { padding: "6px 14px", fontSize: 13 }, sortBy === "revenue" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>매출순</button>
        <div style={{ flex: 1 }} />
        <button onClick={function() { setViewAll(!viewAll); setShow(10); }} style={Object.assign({}, BO, { padding: "6px 14px", fontSize: 13 }, viewAll ? { background: "#18181b", color: "#fff", borderColor: "#18181b" } : {})}>전체</button>
      </div>
      {!viewAll && (
        <div style={Object.assign({}, CS, { padding: "12px 16px", marginBottom: 16 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button onClick={prevMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#71717a", padding: "4px 9px" }}>{"\u25C0"}</button>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#18181b" }}>{viewYear}년 {viewMonth}월</span>
            <button onClick={nextMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#71717a", padding: "4px 9px" }}>{"\u25B6"}</button>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
            <span style={{ fontSize: 13, color: "#71717a" }}>{monthSummary.count}건</span>
            <span style={{ fontSize: 13, color: "#71717a" }}>판매 {monthSummary.sold}개</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a" }}>{formatCurrency(monthSummary.rev)}</span>
          </div>
        </div>
      )}
      {filteredList.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#a1a1aa", fontSize: 14 }}>{viewAll ? "작성된 일보가 없습니다" : viewYear + "년 " + viewMonth + "월 일보가 없습니다"}</div>
      ) : filteredList.slice(0, show).map(function(item, i) {
        return (
          <div key={i} onClick={function() { openReport(item.date, item.rk); }} style={Object.assign({}, CS, { marginBottom: 11, padding: "16px 18px", cursor: "pointer" })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{formatDate(item.date)}</p>
                <p style={{ fontSize: 13, color: "#a1a1aa", margin: "4px 0 0" }}>출고 {(Number(item.ship_sunsal) || 0) + (Number(item.ship_padak) || 0)} · 판매 {item.sold} · 로스 {item.loss}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(item.rev)}</p>
                <p style={{ fontSize: 12, color: "#a1a1aa", margin: "2px 0 0" }}>{(function() { var d = new Date(item.savedAt); return (d.getMonth()+1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); })()}</p>
              </div>
            </div>
          </div>
        );
      })}
      {show < filteredList.length && <button onClick={function() { setShow(function(c) { return c + 10; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 13, color: "#71717a" })}>더 보기</button>}
      <button onClick={openNew} style={{ position: "fixed", bottom: p.isUnfolded ? 28 : 96, right: p.isUnfolded ? 28 : 20, width: 62, height: 62, borderRadius: 31, background: "#e1360a", color: "#fff", border: "none", fontSize: 30, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(225,54,10,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>+</button>
    </div>
  );
}

function EmpInventory(p) {
  var user = p.user, items = p.inventoryItems, stock = p.inventoryStock, requests = p.requests;
  var r1 = useState(null), ri = r1[0], setRi = r1[1];
  var r2 = useState(""), rq = r2[0], setRq = r2[1];
  var r3 = useState(""), toast = r3[0], setToast = r3[1];
  var my = stock[user.id] || {};

  function use(id) {
    var u = JSON.parse(JSON.stringify(stock));
    if (!u[user.id]) u[user.id] = {};
    var cur = u[user.id][id] || 0;
    if (cur <= 0) return;
    u[user.id][id] = cur - 1;
    u[user.id][id + "_used"] = (u[user.id][id + "_used"] || 0) + 1;
    p.setInventoryStock(u);
    store.set("ft-inv-stock", u);
  }

  async function submit() {
    if (!ri || !rq) return;
    var prevRequests = requests;
    var item = items.find(function(i) { return i.id === ri; });
    var nr = { id: Date.now(), itemId: ri, itemName: item ? item.name : "", qty: Number(rq), employeeId: user.id, employeeName: user.name, createdAt: new Date().toISOString(), status: "pending" };
    var nextRequests = requests.concat([nr]);
    // optimistic
    p.setRequests(nextRequests);
    setRi(null); setRq("");
    var r = await store.setWithError("ft-inv-requests", nextRequests);
    if (r && r.ok) {
      setToast("요청 완료!");
      setTimeout(function() { setToast(""); }, 2000);
    } else {
      p.setRequests(prevRequests);
      var pendingCount = enqueuePendingAppData({ key: "ft-inv-requests", value: nextRequests, op: "set" });
      setToast("요청 실패 — 오프라인 큐 (" + pendingCount + "건)");
      setTimeout(function() { setToast(""); }, 3500);
    }
  }

  return (
    <div style={PAGE}>
      <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>📦 내 재고 현황</p>
      <p style={{ fontSize: 13, color: "#a1a1aa", margin: "0 0 16px" }}>사용 후 (−) 버튼으로 차감하세요</p>
      {items.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 14 }}>등록된 품목이 없습니다</div> :
        items.map(function(item) {
          var qty = my[item.id] || 0;
          var used = my[item.id + "_used"] || 0;
          var total = qty + used;
          var low = qty <= 2;
          return (
            <div key={item.id} style={Object.assign({}, CS, { marginBottom: 16, padding: "18px 18px" }, low ? { border: "1px solid #f5c6c0", background: "#fef2f2" } : {})}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#18181b" }}>{item.name}</p>
                  {low && <span style={{ fontSize: 12, color: "#e1360a", fontWeight: 600 }}>재고 부족</span>}
                </div>
                <span style={{ fontSize: 28, fontWeight: 800, color: low ? "#e1360a" : "#18181b" }}>{qty}<span style={{ fontSize: 14, fontWeight: 500, color: "#a1a1aa" }}> 개</span></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 13px", background: "#f9fafb", borderRadius: 9, marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#71717a" }}>누적 사용</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#e1360a" }}>{used}개 <span style={{ fontSize: 12, fontWeight: 500, color: "#a1a1aa" }}>/ 총 {total}개</span></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <button onClick={function() { use(item.id); }} disabled={qty <= 0}
                  style={{ width: 44, height: 44, borderRadius: 11, border: "1px solid " + (qty > 0 ? "#e1360a" : "#f0f0f3"), background: qty > 0 ? "#fff8f6" : "#f4f4f5", fontSize: 24, cursor: qty > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: qty > 0 ? "#e1360a" : "#d4d4d8", fontWeight: 700 }}>−</button>
                <div style={{ flex: 1 }} />
                <button onClick={function() { setRi(item.id); setRq(""); }} style={Object.assign({}, BO, { padding: "11px 22px", fontSize: 14, color: "#e1360a", borderColor: "#f5c6c0", background: "#fff8f6" })}>보충요청</button>
              </div>
            </div>
          );
        })
      }
      {ri && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: 30, width: "100%", maxWidth: 420 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 18px" }}>📋 보충 요청</p>
            <NumInput label="요청 수량" value={rq} onChange={setRq} placeholder="수량" />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={function() { setRi(null); }} style={Object.assign({}, BO, { flex: 1 })}>취소</button>
              <button onClick={submit} style={Object.assign({}, BP, { flex: 1 })}>요청하기</button>
            </div>
          </div>
        </div>
      )}
      <Toast msg={toast} isUnfolded={p.isUnfolded} />
    </div>
  );
}

function EmpRevenue(p) {
  var user = p.user, reports = p.reports, settings = p.settings;
  var r1 = useState(20), show = r1[0], setShow = r1[1];
  var hist = useMemo(function() {
    var l = [];
    Object.entries(reports).forEach(function(e) {
      var d = e[0], dr = e[1];
      Object.entries(dr).forEach(function(re) {
        var rk = re[0], r = re[1];
        var uid = r.userId || rk;
        if (uid === user.id && r.savedAt) {
          var s = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          l.push({ date: d, sold: s, rev: s * (settings.pricePerUnit || 5000), transfer: Number(r.transfer) || 0, cash: Number(r.cash) || 0 });
        }
      });
    });
    return l.sort(function(a, b) { return b.date.localeCompare(a.date); });
  }, [reports, user.id, settings]);

  var tot = useMemo(function() {
    return hist.reduce(function(a, r) {
      return { rev: a.rev + r.rev, transfer: a.transfer + r.transfer, cash: a.cash + r.cash };
    }, { rev: 0, transfer: 0, cash: 0 });
  }, [hist]);

  var now = new Date();
  var thisMonthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var thisMonth = useMemo(function() {
    return hist.filter(function(r) { return r.date.substring(0, 7) === thisMonthKey; }).reduce(function(a, r) {
      return { rev: a.rev + r.rev, transfer: a.transfer + r.transfer, cash: a.cash + r.cash };
    }, { rev: 0, transfer: 0, cash: 0 });
  }, [hist, thisMonthKey]);

  var flatItems = useMemo(function() {
    var g = {};
    hist.forEach(function(r) { var m = getMonthLabel(r.date); if (!g[m]) g[m] = []; g[m].push(r); });
    var items = [];
    Object.entries(g).forEach(function(e) { items.push({ type: "header", month: e[0] }); e[1].forEach(function(r) { items.push({ type: "row", data: r }); }); });
    return items;
  }, [hist]);

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { background: "linear-gradient(135deg,#e1360a,#c42d08)", border: "none" })}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>누적 총 매출</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 9px" }}>{formatCurrency(tot.rev)}</p>
        <div style={{ display: "flex", gap: 20 }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>이체 <span style={{ color: "#ffc40e", fontWeight: 700 }}>{formatCurrency(tot.transfer)}</span></span>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>현금 <span style={{ color: "#86efac", fontWeight: 700 }}>{formatCurrency(tot.cash)}</span></span>
        </div>
      </div>
      <div style={Object.assign({}, CS, { background: "#fafafa" })}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#71717a", margin: "0 0 4px" }}>이번 달 매출</p>
        <p style={{ fontSize: 28, fontWeight: 800, margin: "0 0 7px" }}>{formatCurrency(thisMonth.rev)}</p>
        <div style={{ display: "flex", gap: 20 }}>
          <span style={{ fontSize: 13, color: "#a1a1aa" }}>이체 {formatCurrency(thisMonth.transfer)}</span>
          <span style={{ fontSize: 13, color: "#a1a1aa" }}>현금 {formatCurrency(thisMonth.cash)}</span>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f0f0f3", marginTop: 4, paddingTop: 12 }}>
        {hist.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 14 }}>매출 기록이 없습니다</div> :
          flatItems.slice(0, show).map(function(item, i) {
            if (item.type === "header") {
              return <p key={"h" + i} style={{ fontSize: 15, fontWeight: 700, color: "#e1360a", margin: "18px 0 9px", padding: "9px 0", borderBottom: "1px solid #f4f4f5" }}>{item.month}</p>;
            }
            var r = item.data;
            return (
              <div key={"r" + i} style={Object.assign({}, CS, { marginBottom: 7, padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" })}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{formatDate(r.date)}</p>
                  <p style={{ fontSize: 13, color: "#a1a1aa", margin: "2px 0 0" }}>판매 {r.sold}개 · 이체 {formatCurrency(r.transfer)} · 현금 {formatCurrency(r.cash)}</p>
                </div>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(r.rev)}</p>
              </div>
            );
          })
        }
        {show < flatItems.length && <button onClick={function() { setShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 13, color: "#71717a", marginTop: 8 })}>더 보기</button>}
      </div>
    </div>
  );
}

function EmpSalary(p) {
  var user = p.user, reports = p.reports, settings = p.settings;
  var r1 = useState(20), show = r1[0], setShow = r1[1];
  var empSettings = settings.empSettings || {};
  var hw = empSettings[user.id] && empSettings[user.id].hourlyWage !== undefined ? empSettings[user.id].hourlyWage : (settings.hourlyWage || 10000);
  var sb = empSettings[user.id] && empSettings[user.id].salesBonus !== undefined ? empSettings[user.id].salesBonus : (settings.salesBonus || 1400);

  var now = new Date();
  var thisMonthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
  var weekKey = weekAgo.getFullYear() + "-" + String(weekAgo.getMonth() + 1).padStart(2, "0") + "-" + String(weekAgo.getDate()).padStart(2, "0");

  var list = useMemo(function() {
    var l = [];
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      Object.entries(dr).forEach(function(re) {
        var rk = re[0], r = re[1];
        var uid = r.userId || rk;
        if (uid === user.id && r.savedAt) {
          var sold = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          var mins = 0;
          if (r.clockIn && r.clockOut) {
            var a = r.clockIn.split(":"), b = r.clockOut.split(":");
            mins = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
            if (mins < 0) mins += 1440;
          }
          var hours = mins / 60;
          var timePay = Math.round(hours * hw);
          var salesPay = sold * sb;
          var pay = r.payOverride !== undefined ? r.payOverride : Math.max(timePay, salesPay);
          l.push({ date: date, rk: rk, sold: sold, hours: hours, mins: mins, pay: pay, autoPay: Math.max(timePay, salesPay), timePay: timePay, salesPay: salesPay, paid: r.paid || false, hasOverride: r.payOverride !== undefined });
        }
      });
    });
    return l.sort(function(a, b) { return b.date.localeCompare(a.date); });
  }, [reports, user.id, hw, sb]);

  var totals = useMemo(function() {
    var all = 0, month = 0, mPaid = 0, mUnpaid = 0, week = 0, wPaid = 0, wUnpaid = 0;
    list.forEach(function(r) {
      all += r.pay;
      if (r.date.substring(0, 7) === thisMonthKey) {
        month += r.pay;
        if (r.paid) mPaid += r.pay; else mUnpaid += r.pay;
      }
      if (r.date >= weekKey) {
        week += r.pay;
        if (r.paid) wPaid += r.pay; else wUnpaid += r.pay;
      }
    });
    return { all: all, month: month, mPaid: mPaid, mUnpaid: mUnpaid, week: week, wPaid: wPaid, wUnpaid: wUnpaid };
  }, [list, thisMonthKey, weekKey]);

  function fmtHours(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + "시간 " + m + "분";
  }

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { background: "linear-gradient(135deg,#e1360a,#c42d08)", border: "none" })}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>누적 급여</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#fff", margin: 0 }}>{formatCurrency(totals.all)}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 18 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 월간 급여</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#e1360a", margin: "0 0 9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(totals.month)}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>지급 {formatCurrency(totals.mPaid)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 2 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>미지급 {formatCurrency(totals.mUnpaid)}</span>
          </div>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 주간 급여</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#e1360a", margin: "0 0 9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(totals.week)}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>지급 {formatCurrency(totals.wPaid)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 2 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>미지급 {formatCurrency(totals.wUnpaid)}</span>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f0f0f3", paddingTop: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 1fr 0.8fr", padding: "9px 13px", fontSize: 12, fontWeight: 600, color: "#a1a1aa" }}>
          <span>일자</span><span style={{ textAlign: "center" }}>판매</span><span style={{ textAlign: "center" }}>근무시간</span><span style={{ textAlign: "right" }}>급여</span><span style={{ textAlign: "right" }}>상태</span>
        </div>
        {list.length === 0 ? <p style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 14 }}>급여 기록이 없습니다</p> :
          list.slice(0, show).map(function(r, i) {
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 1fr 0.8fr", padding: "10px 12px", borderBottom: "1px solid #f4f4f5", fontSize: 13, alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{formatDate(r.date)}</span>
                <span style={{ textAlign: "center", color: "#71717a" }}>{r.sold}개</span>
                <span style={{ textAlign: "center", color: "#71717a" }}>{fmtHours(r.mins)}</span>
                <span style={{ textAlign: "right", fontWeight: 700, color: "#e1360a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{formatCurrency(r.pay)}</span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: r.paid ? "#dcfce7" : "#fef2f2", color: r.paid ? "#16a34a" : "#e1360a", whiteSpace: "nowrap", display: "inline-block" }}>
                    {r.paid ? "지급" : "미지급"}
                  </span>
                </span>
              </div>
            );
          })
        }
        {show < list.length && <button onClick={function() { setShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 13, color: "#71717a", marginTop: 8 })}>더 보기</button>}
      </div>
    </div>
  );
}


/* ===== 관리자: 홈 ===== */

/* ===== 관리자: 홈 ===== */
function AdminHome(p) {
  var reports = p.reports, settings = p.settings, production = p.production;
  var r1 = useState(getToday()), selDay = r1[0], setSelDay = r1[1];
  var rs1 = useState(false), syncing = rs1[0], setSyncing = rs1[1];
  var rs2 = useState(""), syncMsg = rs2[0], setSyncMsg = rs2[1];
  var rs3 = useState(false), showSyncSetup = rs3[0], setShowSyncSetup = rs3[1];
  var rs4 = useState(getSheetsUrl()), sheetsUrl = rs4[0], setSheetsUrl_ = rs4[1];

  function doSync() {
    setSyncing(true); setSyncMsg("");
    var payload = {
      "ft-users": p.users,
      "ft-reports": reports,
      "ft-inv-items": p.inventoryItems,
      "ft-inv-stock": p.inventoryStock,
      "ft-inv-requests": p.requests,
      "ft-inv-office": p.officeStock,
      "ft-inv-log": p.invLog,
      "ft-gas": p.gasData,
      "ft-schedules": p.schedules,
      "ft-fixed-costs": p.fixedCosts,
      "ft-variable-costs": p.varCosts,
      "ft-production": production,
      "ft-settings": settings,
      "ft-prod-settings": p.prodSettings
    };
    syncToSheets(payload)
      .then(function() { setSyncMsg("ok"); })
      .catch(function() { setSyncMsg("fail"); })
      .finally(function() {
        setSyncing(false);
        setTimeout(function() { setSyncMsg(""); }, 3000);
      });
  }

  function saveSheetsUrl() {
    setSheetsUrl(sheetsUrl);
    setShowSyncSetup(false);
  }

  var rs5 = useState(false), restoring = rs5[0], setRestoring = rs5[1];
  var rs6 = useState(""), restoreMsg = rs6[0], setRestoreMsg = rs6[1];

  function doRestore() {
    if (!confirm("Google Sheets에서 일보 데이터를 복원합니다.\n기존 데이터는 유지되고, Sheets 데이터가 병합됩니다.\n계속하시겠습니까?")) return;
    setRestoring(true); setRestoreMsg("");
    readFromSheets()
      .then(function(res) {
        if (!res.ok || !res.reports) {
          setRestoreMsg("fail");
          return;
        }
        var sheetReports = res.reports;
        var current = JSON.parse(JSON.stringify(reports));
        // Build name→userId map for proper filtering
        var nameToId = {};
        (p.users || []).forEach(function(u) { nameToId[u.name] = u.id; });
        var added = 0;
        Object.keys(sheetReports).forEach(function(date) {
          if (!current[date]) current[date] = {};
          Object.keys(sheetReports[date]).forEach(function(rk) {
            if (!current[date][rk]) {
              var entry = sheetReports[date][rk];
              // Resolve userId from employeeName
              if (entry.employeeName && nameToId[entry.employeeName]) {
                entry.userId = nameToId[entry.employeeName];
              }
              current[date][rk] = entry;
              added++;
            }
          });
        });
        if (added === 0) {
          setRestoreMsg("none");
          return;
        }
        p.setReports(current);
        // 새 reports 테이블에 복원된 항목 저장
        var rows = [];
        Object.keys(sheetReports).forEach(function(date) {
          Object.keys(sheetReports[date]).forEach(function(rk) {
            if (current[date] && current[date][rk]) {
              rows.push(reportStore.toRow(rk, date, current[date][rk]));
            }
          });
        });
        if (rows.length > 0) {
          rows.forEach(function(row) { reportStore.upsert(row); });
        }
        setRestoreMsg("ok:" + added);
      })
      .catch(function() { setRestoreMsg("fail"); })
      .finally(function() {
        setRestoring(false);
        setTimeout(function() { setRestoreMsg(""); }, 5000);
      });
  }

  var now = new Date();
  var thisMonthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
  var weekKey = weekAgo.getFullYear() + "-" + String(weekAgo.getMonth() + 1).padStart(2, "0") + "-" + String(weekAgo.getDate()).padStart(2, "0");
  var price = settings.pricePerUnit || 5000;

  var stats = useMemo(function() {
    var mSold = 0, wSold = 0, dSold = 0;
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      Object.values(dr).forEach(function(r) {
        if (r.savedAt) {
          var s = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          if (date.substring(0, 7) === thisMonthKey) mSold += s;
          if (date >= weekKey) wSold += s;
          if (date === selDay) dSold += s;
        }
      });
    });
    return { mSold: mSold, mRev: mSold * price, wSold: wSold, wRev: wSold * price, dSold: dSold, dRev: dSold * price };
  }, [reports, settings, thisMonthKey, weekKey, selDay, price]);

  var officeStock = useMemo(function() {
    var produced = { sunsal: 0, padak: 0 };
    var consumed = { sunsal: 0, padak: 0 };
    production.forEach(function(pr) {
      if (pr.type === "sunsal") produced.sunsal += Number(pr.qty) || 0;
      else produced.padak += Number(pr.qty) || 0;
    });
    Object.values(reports).forEach(function(dr) {
      Object.values(dr).forEach(function(r) {
        if (r.savedAt) {
          consumed.sunsal += (Number(r.sunsal) || 0) + (Number(r.loss) || 0);
          consumed.padak += (Number(r.padak) || 0);
        }
      });
    });
    return { sunsal: produced.sunsal - consumed.sunsal, padak: produced.padak - consumed.padak };
  }, [production, reports]);

  return (
    <div style={PAGE}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 16 }}>
        <div style={Object.assign({}, CS, { background: "linear-gradient(135deg,#e1360a,#c42d08)", border: "none" })}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 2px" }}>월 총 매출</p>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0 }}>{formatCurrency(stats.mRev)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>월 총 판매</p>
          <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{stats.mSold}<span style={{ fontSize: 14, color: "#a1a1aa" }}> 개</span></p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 16 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>주간 매출</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.wRev)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>주간 판매</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{stats.wSold}<span style={{ fontSize: 14, color: "#a1a1aa" }}> 개</span></p>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📅 일일 현황</p>
          <input type="date" value={selDay} onChange={function(e) { setSelDay(e.target.value); }}
            style={Object.assign({}, IS, { width: "auto", padding: "4px 11px", fontSize: 14 })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 4px" }}>매출</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.dRev)}</p>
          </div>
          <div>
            <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 4px" }}>판매</p>
            <p style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{stats.dSold}<span style={{ fontSize: 14, color: "#a1a1aa" }}> 개</span></p>
          </div>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 16 })}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 11px" }}>🍗 사무실 재고</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ textAlign: "center", padding: 13, background: "#fff8f6", borderRadius: 9 }}>
            <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 4px" }}>순살</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: officeStock.sunsal < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.sunsal}</p>
          </div>
          <div style={{ textAlign: "center", padding: 13, background: "#fff8f6", borderRadius: 9 }}>
            <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 4px" }}>파닭</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: officeStock.padak < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.padak}</p>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, margin: "13px 0 11px" }}>👥 직원별 현황</p>
      {(p.users || []).filter(function(u) { return u.role === "employee" && (u.status || "active") !== "deleted"; }).map(function(emp) {
        var ts = 0, ms = 0, ws = 0, ds = 0;
        Object.entries(reports).forEach(function(e) {
          var date = e[0], dr = e[1];
          Object.values(dr).forEach(function(r) {
            var uid = r.userId || "";
            if (uid === emp.id && r.savedAt) {
              var s = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
              ts += s;
              if (date.substring(0, 7) === thisMonthKey) ms += s;
              if (date >= weekKey) ws += s;
              if (date === selDay) ds += s;
            }
          });
        });
        var mLabel = (now.getMonth() + 1) + "월";
        return (
          <div key={emp.id} style={Object.assign({}, CS, { marginBottom: 11, padding: "13px 18px" })}>
            <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 11px", color: "#18181b" }}>{emp.name}{(emp.status || "active") === "resigned" ? <span style={{ fontSize: 12, fontWeight: 600, color: "#e1360a", marginLeft: 7 }}>(퇴사)</span> : ""}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 11 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>누적</p>
                <p style={{ fontSize: 16, fontWeight: 800, margin: "0 0 1px" }}>{ts}개</p>
                <p style={{ fontSize: 11, color: "#e1360a", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(ts * price)}</p>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>{mLabel}</p>
                <p style={{ fontSize: 16, fontWeight: 800, margin: "0 0 1px" }}>{ms}개</p>
                <p style={{ fontSize: 11, color: "#e1360a", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(ms * price)}</p>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>최근7일</p>
                <p style={{ fontSize: 16, fontWeight: 800, margin: "0 0 1px" }}>{ws}개</p>
                <p style={{ fontSize: 11, color: "#e1360a", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(ws * price)}</p>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>{formatDate(selDay).split("(")[0].trim()}</p>
                <p style={{ fontSize: 16, fontWeight: 800, margin: "0 0 1px" }}>{ds}개</p>
                <p style={{ fontSize: 11, color: "#e1360a", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(ds * price)}</p>
              </div>
            </div>
          </div>
        );
      })}
      <div style={Object.assign({}, CS, { marginTop: 16, padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Google Sheets 동기화</p>
          <button onClick={function() { setShowSyncSetup(!showSyncSetup); }} style={Object.assign({}, BO, { fontSize: 12, padding: "4px 10px" })}>{showSyncSetup ? "닫기" : "설정"}</button>
        </div>
        {showSyncSetup && (
          <div style={{ marginBottom: 16 }}>
            <label style={LS}>Apps Script 웹앱 URL</label>
            <input type="text" value={sheetsUrl} onChange={function(e) { setSheetsUrl_(e.target.value); }}
              placeholder="https://script.google.com/macros/s/..." style={Object.assign({}, IS, { fontSize: 13, marginBottom: 10 })} />
            <button onClick={saveSheetsUrl} style={Object.assign({}, BP, { fontSize: 13, padding: 8 })}>URL 저장</button>
          </div>
        )}
        <button onClick={doSync} disabled={syncing || !getSheetsUrl()}
          style={Object.assign({}, BP, { fontSize: 14, padding: 10, opacity: (syncing || !getSheetsUrl()) ? 0.5 : 1 })}>
          {syncing ? "동기화 중..." : "Google Sheets에 동기화"}
        </button>
        {syncMsg === "ok" && <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, margin: "8px 0 0", textAlign: "center" }}>동기화 완료!</p>}
        {syncMsg === "fail" && <p style={{ fontSize: 13, color: "#e1360a", fontWeight: 600, margin: "8px 0 0", textAlign: "center" }}>동기화 실패. URL을 확인해주세요.</p>}
        {!getSheetsUrl() && !showSyncSetup && <p style={{ fontSize: 12, color: "#a1a1aa", margin: "8px 0 0", textAlign: "center" }}>설정에서 Apps Script URL을 먼저 입력하세요</p>}
        <div style={{ borderTop: "1px solid #f0f0f3", marginTop: 16, paddingTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#71717a", margin: "0 0 9px" }}>Sheets에서 일보 복원</p>
          <button onClick={doRestore} disabled={restoring || !getSheetsUrl()}
            style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 14, padding: 10, color: "#e1360a", borderColor: "#f5c6c0", opacity: (restoring || !getSheetsUrl()) ? 0.5 : 1 })}>
            {restoring ? "복원 중..." : "Google Sheets에서 복원"}
          </button>
          {restoreMsg.indexOf("ok:") === 0 && <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 600, margin: "8px 0 0", textAlign: "center" }}>{restoreMsg.split(":")[1]}건 복원 완료!</p>}
          {restoreMsg === "none" && <p style={{ fontSize: 13, color: "#71717a", fontWeight: 600, margin: "8px 0 0", textAlign: "center" }}>새로 복원할 데이터가 없습니다</p>}
          {restoreMsg === "fail" && <p style={{ fontSize: 13, color: "#e1360a", fontWeight: 600, margin: "8px 0 0", textAlign: "center" }}>복원 실패. Sheets URL 또는 Apps Script 배포를 확인해주세요.</p>}
        </div>
      </div>
    </div>
  );
}
function AdminFinance(p) {
  var reports = p.reports, settings = p.settings, production = p.production;
  var fixedCosts = p.fixedCosts, setFixedCosts = p.setFixedCosts;
  var varCosts = p.varCosts, setVarCosts = p.setVarCosts;
  var prodSettings = p.prodSettings;
  var invLog = p.invLog || [];
  var r1 = useState(""), fcName = r1[0], setFcName = r1[1];
  var r2 = useState(""), fcAmt = r2[0], setFcAmt = r2[1];
  var r3 = useState(""), toast = r3[0], setToast = r3[1];
  var r4 = useState(getToday()), vcDate = r4[0], setVcDate = r4[1];
  var r5 = useState(""), vcCat = r5[0], setVcCat = r5[1];
  var r6 = useState(""), vcAmt = r6[0], setVcAmt = r6[1];
  var r30 = useState("month"), vcView = r30[0], setVcView = r30[1];
  var r31 = useState(20), vcShow = r31[0], setVcShow = r31[1];

  var now = new Date();
  var thisMonthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var price = settings.pricePerUnit || 5000;
  var unitProdCost = (Number(prodSettings.prodCost) || 0) + (Number(prodSettings.skewCost) || 0);

  var monthRev = useMemo(function() {
    var sold = 0;
    Object.entries(reports).forEach(function(e) {
      if (e[0].substring(0, 7) === thisMonthKey) {
        Object.values(e[1]).forEach(function(r) {
          if (r.savedAt) sold += (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
        });
      }
    });
    return sold * price;
  }, [reports, thisMonthKey, price]);

  var monthProdCost = useMemo(function() {
    var total = 0;
    var pCost = Number(prodSettings.prodCost) || 0;
    var sCost = Number(prodSettings.skewCost) || 0;
    production.forEach(function(pr) {
      if (pr.date && pr.date.substring(0, 7) === thisMonthKey) {
        var matCost = (Number(pr.kgPrice) || 0) * (Number(pr.usedKg) || 0) + (Number(pr.paPrice) || 0);
        var labCost = (pCost + sCost) * (Number(pr.qty) || 0);
        total += matCost + labCost;
      }
    });
    return total;
  }, [production, thisMonthKey, prodSettings]);

  var totalFixed = fixedCosts.reduce(function(a, c) { return a + (Number(c.amount) || 0); }, 0);
  var monthVar = varCosts.filter(function(v) { return v.date && v.date.substring(0, 7) === thisMonthKey; }).reduce(function(a, c) { return a + (Number(c.amount) || 0); }, 0);
  var monthInvCost = varCosts.filter(function(v) { return v.date && v.date.substring(0, 7) === thisMonthKey && v.category === "재고매입"; }).reduce(function(a, c) { return a + (Number(c.amount) || 0); }, 0);
  var monthVarExInv = monthVar - monthInvCost;

  var empSettings = settings.empSettings || {};
  function getEmpSetting(uid, field, fallback) {
    return empSettings[uid] && empSettings[uid][field] !== undefined ? empSettings[uid][field] : (settings[field] || fallback);
  }

  var monthSalary = useMemo(function() {
    var total = 0;
    Object.entries(reports).forEach(function(e) {
      if (e[0].substring(0, 7) === thisMonthKey) {
        Object.entries(e[1]).forEach(function(re) {
          var r = re[1];
          if (r.savedAt) {
            var uid = r.userId || re[0];
            var hw = getEmpSetting(uid, "hourlyWage", 10000);
            var sb = getEmpSetting(uid, "salesBonus", 1400);
            var sold = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
            var mins = 0;
            if (r.clockIn && r.clockOut) {
              var a = r.clockIn.split(":"), b = r.clockOut.split(":");
              mins = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
              if (mins < 0) mins += 1440;
            }
            var pay = r.payOverride !== undefined ? r.payOverride : Math.max(Math.round(mins / 60 * hw), sold * sb);
            total += pay;
          }
        });
      }
    });
    return total;
  }, [reports, thisMonthKey, settings]);

  var margin = monthRev - totalFixed - monthProdCost - monthVar - monthSalary;
  var isProfit = margin >= 0;
  var breakEven = !isProfit && price > 0 ? Math.ceil(Math.abs(margin) / price) : 0;

  function addFixed() {
    if (!fcName.trim() || !fcAmt) return;
    var u = fixedCosts.concat([{ id: Date.now(), name: fcName.trim(), amount: Number(fcAmt) }]);
    setFixedCosts(u); store.set("ft-fixed-costs", u);
    setFcName(""); setFcAmt("");
  }
  function delFixed(id) { var u = fixedCosts.filter(function(c) { return c.id !== id; }); setFixedCosts(u); store.set("ft-fixed-costs", u); }

  function addVar() {
    if (!vcCat.trim() || !vcAmt) return;
    var u = varCosts.concat([{ id: Date.now(), date: vcDate, category: vcCat.trim(), amount: Number(vcAmt) }]);
    setVarCosts(u); store.set("ft-variable-costs", u);
    setVcCat(""); setVcAmt("");
  }
  function delVar(id) { var u = varCosts.filter(function(c) { return c.id !== id; }); setVarCosts(u); store.set("ft-variable-costs", u); }

  var monthVarList = varCosts.filter(function(v) { return v.date && v.date.substring(0, 7) === thisMonthKey; }).sort(function(a, b) { return b.date.localeCompare(a.date); });
  var allVarList = varCosts.slice().sort(function(a, b) { return (b.date || "").localeCompare(a.date || ""); });
  var vcList = vcView === "all" ? allVarList : monthVarList;
  var allVarTotal = allVarList.reduce(function(a, c) { return a + (Number(c.amount) || 0); }, 0);

  var emps = (p.users || []).filter(function(u) { return u.role === "employee" && (u.status || "active") !== "deleted"; });
  var totalCosts = totalFixed + monthProdCost + monthVar;
  var empQuota = emps.length > 0 && price > 0 ? Math.ceil(totalCosts / emps.length / price) : 0;

  var empMonthSold = useMemo(function() {
    var m = {};
    Object.entries(reports).forEach(function(e) {
      if (e[0].substring(0, 7) === thisMonthKey) {
        Object.entries(e[1]).forEach(function(re) {
          var r = re[1];
          var uid = r.userId || re[0];
          if (r.savedAt) {
            if (!m[uid]) m[uid] = 0;
            m[uid] += (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          }
        });
      }
    });
    return m;
  }, [reports, thisMonthKey]);

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { padding: 0, border: "none", overflow: "hidden", marginBottom: 16 })}>
        <div style={{ padding: "22px 18px 16px", background: isProfit ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#e1360a,#c42d08)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{thisMonthKey} 마진</p>
          <p style={{ fontSize: 36, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{isProfit ? "+" : ""}{formatCurrency(margin)}</p>
          {!isProfit && breakEven > 0 && (
            <div style={{ marginTop: 7, padding: "9px 13px", background: "rgba(255,196,14,0.25)", borderRadius: 9, textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#ffc40e", margin: 0 }}>흑자 전환까지 {breakEven}개 판매 필요!</p>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px 16px", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a" }}>매출</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>+{formatCurrency(monthRev)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#71717a" }}>고정비</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(totalFixed)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#71717a" }}>생산비</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(monthProdCost)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#71717a" }}>변동비</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(monthVarExInv)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#71717a" }}>재고매입</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(monthInvCost)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#71717a" }}>급여</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(monthSalary)}</span>
          </div>
        </div>
      </div>
      {emps.length > 0 && empQuota > 0 && (
        <div style={Object.assign({}, CS, { padding: 20, marginBottom: 18 })}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 9px" }}>🎯 직원별 월 할당량</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16, padding: "10px 8px", background: "#f9fafb", borderRadius: 8 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>총 직원</p>
              <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{emps.length}명</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>전체 목표</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#e1360a", margin: 0 }}>{empQuota * emps.length}개</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>1인당</p>
              <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{empQuota}개</p>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 11px" }}>고정비+생산비+변동비 ÷ {emps.length}명 ÷ {formatCurrency(price)} 기준</p>
          {emps.map(function(emp) {
            var sold = empMonthSold[emp.id] || 0;
            var pct = empQuota > 0 ? Math.min(100, Math.round(sold / empQuota * 100)) : 0;
            var done = sold >= empQuota;
            return (
              <div key={emp.id} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{emp.name}{(emp.status || "active") === "resigned" ? <span style={{ fontSize: 12, color: "#e1360a", marginLeft: 4 }}>(퇴사)</span> : ""}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: done ? "#16a34a" : "#e1360a" }}>{sold} / {empQuota}개</span>
                </div>
                <div style={{ height: 11, borderRadius: 4, background: "#f4f4f5", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, width: pct + "%", background: done ? "#16a34a" : "#e1360a", transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📌 고정비</p>
        </div>
        {fixedCosts.map(function(fc) {
          return (
            <div key={fc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{fc.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e1360a" }}>{formatCurrency(fc.amount)}</span>
                <button onClick={function() { delFixed(fc.id); }} style={{ border: "none", background: "none", color: "#a1a1aa", fontSize: 14, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={fcName} onChange={function(e) { setFcName(e.target.value); }} placeholder="분류" style={Object.assign({}, IS, { flex: 1, padding: "6px 8px", fontSize: 13 })} />
          <input type="number" value={fcAmt} onChange={function(e) { setFcAmt(e.target.value); }} placeholder="금액" style={Object.assign({}, IS, { width: 90, padding: "6px 8px", fontSize: 13 })} inputMode="numeric" />
          <button onClick={addFixed} style={Object.assign({}, BP, { width: "auto", padding: "6px 12px", fontSize: 12 })}>추가</button>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 9px" }}>🏭 생산비 (자동)</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#71717a" }}>{thisMonthKey} 생산비</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(monthProdCost)}</span>
        </div>
        <p style={{ fontSize: 12, color: "#a1a1aa", margin: "4px 0 0" }}>생산비 {formatCurrency(Number(prodSettings.prodCost) || 0)} + 꽂이값 {formatCurrency(Number(prodSettings.skewCost) || 0)}/개 기준</p>
      </div>
      <div style={Object.assign({}, CS, { padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📊 변동비</p>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={function() { setVcView("month"); setVcShow(20); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 12 }, vcView === "month" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>이번달</button>
            <button onClick={function() { setVcView("all"); setVcShow(20); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 12 }, vcView === "all" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>전체</button>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "6px 8px", background: "#f9fafb", borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: "#71717a", fontWeight: 600 }}>{vcView === "all" ? "전체 " + allVarList.length + "건" : thisMonthKey + " " + monthVarList.length + "건"}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(vcView === "all" ? allVarTotal : monthVar)}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input type="date" value={vcDate} onChange={function(e) { setVcDate(e.target.value); }} style={Object.assign({}, IS, { width: "auto", padding: "4px 6px", fontSize: 12 })} />
          <input value={vcCat} onChange={function(e) { setVcCat(e.target.value); }} placeholder="분류" style={Object.assign({}, IS, { flex: 1, padding: "6px 8px", fontSize: 13 })} />
          <input type="number" value={vcAmt} onChange={function(e) { setVcAmt(e.target.value); }} placeholder="금액" style={Object.assign({}, IS, { width: 80, padding: "6px 8px", fontSize: 13 })} inputMode="numeric" />
          <button onClick={addVar} style={Object.assign({}, BP, { width: "auto", padding: "6px 10px", fontSize: 12 })}>+</button>
        </div>
        {vcList.length === 0 ? <p style={{ textAlign: "center", padding: 16, color: "#a1a1aa", fontSize: 13 }}>{vcView === "all" ? "변동비 기록 없음" : "이번 달 변동비 없음"}</p> :
          vcList.slice(0, vcShow).map(function(vc) {
            return (
              <div key={vc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #f4f4f5", fontSize: 14 }}>
                <div><span style={{ color: "#71717a", fontSize: 13 }}>{formatDate(vc.date)}</span> <span style={{ fontWeight: 600, marginLeft: 6 }}>{vc.category}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontWeight: 700, color: "#e1360a" }}>{formatCurrency(vc.amount)}</span>
                  <button onClick={function() { delVar(vc.id); }} style={{ border: "none", background: "none", color: "#a1a1aa", fontSize: 14, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            );
          })
        }
        {vcShow < vcList.length && <button onClick={function() { setVcShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 13, color: "#71717a", marginTop: 8 })}>더 보기</button>}
      </div>
    </div>
  );
}

/* ===== 관리자: 꼬치 ===== */

function AdminChicken(p) {
  var production = p.production, setProduction = p.setProduction;
  var prodSettings = p.prodSettings, setProdSettings = p.setProdSettings;
  var reports = p.reports;
  var r1 = useState(20), show = r1[0], setShow = r1[1];
  var r2 = useState(""), toast = r2[0], setToast = r2[1];
  var r3 = useState(false), adding = r3[0], setAdding = r3[1];
  var r4 = useState(null), editId = r4[0], setEditId = r4[1];
  var r5 = useState({ date: getToday(), type: "sunsal", qty: "", usedKg: "", kgPrice: "", paPrice: "" }), form = r5[0], setForm = r5[1];
  var prodCost = Number(prodSettings.prodCost) || 0;
  var skewCost = Number(prodSettings.skewCost) || 0;

  var now = new Date();
  var thisMonthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
  var weekKey = weekAgo.getFullYear() + "-" + String(weekAgo.getMonth() + 1).padStart(2, "0") + "-" + String(weekAgo.getDate()).padStart(2, "0");

  var stats = useMemo(function() {
    var m = 0, mMat = 0, mLab = 0, w = 0, wMat = 0, wLab = 0, d = 0, dMat = 0, dLab = 0;
    var today = getToday();
    production.forEach(function(pr) {
      var q = Number(pr.qty) || 0;
      var prKg = Number(pr.usedKg) || 0;
      var prKgPrice = Number(pr.kgPrice) || 0;
      var prPa = Number(pr.paPrice) || 0;
      var mat = prKgPrice * prKg + prPa;
      var lab = (prodCost + skewCost) * q;
      if (pr.date && pr.date.substring(0, 7) === thisMonthKey) { m += q; mMat += mat; mLab += lab; }
      if (pr.date >= weekKey) { w += q; wMat += mat; wLab += lab; }
      if (pr.date === today) { d += q; dMat += mat; dLab += lab; }
    });
    return { m: m, mMat: mMat, mLab: mLab, w: w, wMat: wMat, wLab: wLab, d: d, dMat: dMat, dLab: dLab };
  }, [production, thisMonthKey, weekKey, prodCost, skewCost]);

  var avgCost = useMemo(function() {
    var sorted = production.slice().sort(function(a, b) { return (b.savedAt || "").localeCompare(a.savedAt || ""); });
    var recent = sorted.slice(0, 7);
    if (recent.length === 0) return { avg: 0, date: "" };
    var sum = 0;
    var latestDate = "";
    recent.forEach(function(pr) {
      var q = Number(pr.qty) || 1;
      var prKg = Number(pr.usedKg) || 0;
      var prKgPrice = Number(pr.kgPrice) || 0;
      var prPa = Number(pr.paPrice) || 0;
      var perPiece = (prKgPrice * prKg + prPa) / q + prodCost + skewCost;
      sum += perPiece;
      if (!latestDate || pr.date > latestDate) latestDate = pr.date;
    });
    return { avg: Math.round(sum / recent.length), date: latestDate };
  }, [production, prodCost, skewCost]);

  var officeStock = useMemo(function() {
    var produced = { sunsal: 0, padak: 0 };
    var consumed = { sunsal: 0, padak: 0 };
    production.forEach(function(pr) {
      if (pr.type === "sunsal") produced.sunsal += Number(pr.qty) || 0;
      else produced.padak += Number(pr.qty) || 0;
    });
    Object.values(reports).forEach(function(dr) {
      Object.values(dr).forEach(function(r) {
        if (r.savedAt) {
          consumed.sunsal += (Number(r.sunsal) || 0) + (Number(r.loss) || 0);
          consumed.padak += (Number(r.padak) || 0);
        }
      });
    });
    return { sunsal: produced.sunsal - consumed.sunsal, padak: produced.padak - consumed.padak };
  }, [production, reports]);

  function saveProdSettings(field, val) {
    var u = Object.assign({}, prodSettings);
    u[field] = val;
    u.lastUpdated = getToday();
    setProdSettings(u); store.set("ft-prod-settings", u);
  }

  async function saveEntry() {
    if (!form.qty || !form.usedKg || !form.kgPrice) return;
    var prevProduction = production;
    var entry = { date: form.date, type: form.type, qty: Number(form.qty), usedKg: Number(form.usedKg), kgPrice: Number(form.kgPrice), paPrice: form.type === "padak" ? (Number(form.paPrice) || 0) : 0, savedAt: new Date().toISOString() };
    var u;
    if (editId) {
      u = production.map(function(pr) { return pr.id === editId ? Object.assign({}, pr, entry) : pr; });
    } else {
      entry.id = "pr_" + Date.now();
      u = production.concat([entry]);
    }
    // optimistic
    setProduction(u);
    setForm({ date: getToday(), type: "sunsal", qty: "", usedKg: "", kgPrice: "", paPrice: "" });
    setAdding(false); setEditId(null);
    var r = await store.setWithError("ft-production", u);
    if (r && r.ok) {
      setToast("저장 완료"); setTimeout(function() { setToast(""); }, 2000);
    } else {
      // 실패: optimistic 롤백 + 응급 큐 적재
      setProduction(prevProduction);
      var pendingCount = enqueuePendingAppData({ key: "ft-production", value: u, op: "set" });
      setToast("저장 실패 — 오프라인 큐 (" + pendingCount + "건 대기)");
      setTimeout(function() { setToast(""); }, 3500);
    }
  }

  function delEntry(id) {
    var u = production.filter(function(pr) { return pr.id !== id; });
    setProduction(u); store.set("ft-production", u);
  }

  function openEdit(pr) {
    setForm({ date: pr.date, type: pr.type, qty: pr.qty, usedKg: pr.usedKg || "", kgPrice: pr.kgPrice || "", paPrice: pr.paPrice || "" });
    setEditId(pr.id); setAdding(true);
  }

  var sorted = useMemo(function() {
    return production.slice().sort(function(a, b) { return (b.date + b.savedAt).localeCompare(a.date + a.savedAt); });
  }, [production]);

  var lastDate = prodSettings.lastUpdated || "";

  var fUsedKg = Number(form.usedKg) || 0;
  var fKgPrice = Number(form.kgPrice) || 0;
  var fQty = Number(form.qty) || 0;
  var fPaPrice = form.type === "padak" ? (Number(form.paPrice) || 0) : 0;
  var fMatCost = fKgPrice * fUsedKg + fPaPrice;
  var fLabCost = (prodCost + skewCost) * fQty;

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>🔧 생산단가 설정</p>
          {lastDate && <span style={{ fontSize: 12, color: "#18181b", opacity: 0.35 }}>({lastDate.replace(/-/g, ".").substring(2)} 기준)</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 11 }}>
          <NumInput label="생산비 (개당)" value={prodSettings.prodCost || ""} onChange={function(v) { saveProdSettings("prodCost", v); }} suffix="원" />
          <NumInput label="꽂이값 (개당)" value={prodSettings.skewCost || ""} onChange={function(v) { saveProdSettings("skewCost", v); }} suffix="원" />
        </div>
        <div style={{ padding: "11px 13px", background: "#fff8f6", borderRadius: 9, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#71717a" }}>평균 생산비</span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(avgCost.avg)}</span>
            {avgCost.date && <span style={{ fontSize: 12, color: "#18181b", opacity: 0.35, marginLeft: 6 }}>({avgCost.date.replace(/-/g, ".").substring(2)} 기준)</span>}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#a1a1aa", margin: "6px 0 0" }}>최근 7건 기준 · 생산일지 기반 자동계산</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 11, marginBottom: 16 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>월 생산</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{stats.m}<span style={{ fontSize: 13, color: "#a1a1aa" }}> 개</span></p>
          <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>생산가 {formatCurrency(stats.mMat)}</p>
          <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>제작비 {formatCurrency(stats.mLab)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>주 생산</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{stats.w}<span style={{ fontSize: 13, color: "#a1a1aa" }}> 개</span></p>
          <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>{formatCurrency(stats.wMat)}</p>
          <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>{formatCurrency(stats.wLab)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>일 생산</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{stats.d}<span style={{ fontSize: 13, color: "#a1a1aa" }}> 개</span></p>
          <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>{formatCurrency(stats.dMat)}</p>
          <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>{formatCurrency(stats.dLab)}</p>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 9px" }}>🍗 현재 재고</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ textAlign: "center", padding: 13, background: "#fff8f6", borderRadius: 9 }}>
            <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 4px" }}>순살</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: officeStock.sunsal < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.sunsal}</p>
          </div>
          <div style={{ textAlign: "center", padding: 13, background: "#fff8f6", borderRadius: 9 }}>
            <p style={{ fontSize: 13, color: "#71717a", margin: "0 0 4px" }}>파닭</p>
            <p style={{ fontSize: 32, fontWeight: 800, color: officeStock.padak < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.padak}</p>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f0f0f3", paddingTop: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 9px" }}>📋 생산 목록</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 0.4fr 0.6fr 0.6fr 0.6fr 0.3fr", padding: "6px 6px", fontSize: 12, fontWeight: 600, color: "#a1a1aa" }}>
          <span>일자</span><span>분류</span><span style={{ textAlign: "center" }}>개수</span><span style={{ textAlign: "right" }}>생산가</span><span style={{ textAlign: "right" }}>제작비</span><span style={{ textAlign: "right" }}>꼬치당</span><span />
        </div>
        {sorted.slice(0, show).map(function(pr) {
          var prKg = Number(pr.usedKg) || 0;
          var prKgPrice = Number(pr.kgPrice) || 0;
          var prPa = Number(pr.paPrice) || 0;
          var matC = prKgPrice * prKg + prPa;
          var labC = (prodCost + skewCost) * (Number(pr.qty) || 0);
          var q = Number(pr.qty) || 1;
          var perPiece = Math.round(matC / q) + prodCost + skewCost;
          return (
            <div key={pr.id} style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 0.4fr 0.6fr 0.6fr 0.6fr 0.3fr", padding: "9px 6px", borderBottom: "1px solid #f4f4f5", fontSize: 13, alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{formatDate(pr.date)}</span>
              <span style={{ color: pr.type === "sunsal" ? "#e1360a" : "#2563eb", fontWeight: 600 }}>{pr.type === "sunsal" ? "순살" : "파닭"}</span>
              <span style={{ textAlign: "center", fontWeight: 700 }}>{pr.qty}</span>
              <span style={{ textAlign: "right", color: "#71717a", fontSize: 12 }}>{formatCurrency(matC)}</span>
              <span style={{ textAlign: "right", color: "#71717a", fontSize: 12 }}>{formatCurrency(labC)}</span>
              <span style={{ textAlign: "right", fontWeight: 700, color: "#e1360a", fontSize: 12 }}>{formatCurrency(perPiece)}</span>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={function() { openEdit(pr); }} style={{ border: "none", background: "none", color: "#71717a", fontSize: 12, cursor: "pointer", padding: 0 }}>✎</button>
                <button onClick={function() { delEntry(pr.id); }} style={{ border: "none", background: "none", color: "#e1360a", fontSize: 12, cursor: "pointer", padding: 0 }}>✕</button>
              </div>
            </div>
          );
        })}
        {show < sorted.length && <button onClick={function() { setShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 13, color: "#71717a", marginTop: 8 })}>더 보기</button>}
      </div>
      {adding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: 30, width: "100%", maxWidth: 460 }}>
            <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px" }}>{editId ? "생산 수정" : "생산 추가"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={LS}>일자</label><input type="date" value={form.date} onChange={function(e) { setForm(Object.assign({}, form, { date: e.target.value })); }} style={IS} /></div>
              <div>
                <label style={LS}>분류</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={function() { setForm(Object.assign({}, form, { type: "sunsal" })); }} style={Object.assign({}, BO, { flex: 1, padding: "6px 0", fontSize: 13 }, form.type === "sunsal" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>순살</button>
                  <button onClick={function() { setForm(Object.assign({}, form, { type: "padak" })); }} style={Object.assign({}, BO, { flex: 1, padding: "6px 0", fontSize: 13 }, form.type === "padak" ? { background: "#2563eb", color: "#fff", borderColor: "#2563eb" } : {})}>파닭</button>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <NumInput label="kg당 금액" value={form.kgPrice} onChange={function(v) { setForm(Object.assign({}, form, { kgPrice: v })); }} suffix="원" />
              <NumInput label="소모 kg" value={form.usedKg} onChange={function(v) { setForm(Object.assign({}, form, { usedKg: v })); }} suffix="kg" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: form.type === "padak" ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 10 }}>
              {form.type === "padak" && <NumInput label="파값" value={form.paPrice} onChange={function(v) { setForm(Object.assign({}, form, { paPrice: v })); }} suffix="원" />}
              <NumInput label="생산개수" value={form.qty} onChange={function(v) { setForm(Object.assign({}, form, { qty: v })); }} suffix="개" />
            </div>
            {(fUsedKg > 0 || fQty > 0) && (
              <div style={{ padding: "8px 12px", background: "#f9fafb", borderRadius: 8, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#71717a" }}>생산가</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(fMatCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "#71717a" }}>제작비</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(fLabCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 4, borderTop: "1px solid #f0f0f3" }}>
                  <span style={{ fontWeight: 700 }}>합계</span>
                  <span style={{ fontWeight: 800, color: "#e1360a" }}>{formatCurrency(fMatCost + fLabCost)}</span>
                </div>
                {fQty > 0 && <p style={{ fontSize: 12, color: "#a1a1aa", margin: "4px 0 0", textAlign: "right" }}>꼬치당 {formatCurrency(Math.round(fMatCost / fQty) + prodCost + skewCost)}</p>}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button onClick={function() { setAdding(false); setEditId(null); }} style={Object.assign({}, BO, { flex: 1 })}>취소</button>
              <button onClick={saveEntry} style={Object.assign({}, BP, { flex: 1 })}>{editId ? "수정" : "추가"}</button>
            </div>
          </div>
        </div>
      )}
      <button onClick={function() { setForm({ date: getToday(), type: "sunsal", qty: "", usedKg: "", kgPrice: "", paPrice: "" }); setEditId(null); setAdding(true); }}
        style={{ position: "fixed", bottom: p.isUnfolded ? 28 : 96, right: p.isUnfolded ? 28 : 20, width: 62, height: 62, borderRadius: 31, background: "#e1360a", color: "#fff", border: "none", fontSize: 30, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(225,54,10,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>+</button>
      <Toast msg={toast} isUnfolded={p.isUnfolded} />
    </div>
  );
}


function AdminInventory(p) {
  var items = p.inventoryItems, setItems = p.setInventoryItems;
  var stock = p.inventoryStock, setStock = p.setInventoryStock;
  var requests = p.requests, setRequests = p.setRequests;
  var users = p.users;
  var oStock = p.officeStock, setOStock = p.setOfficeStock;
  var invLog = p.invLog, setInvLog = p.setInvLog;
  var varCosts = p.varCosts, setVarCosts = p.setVarCosts;
  var r1 = useState(""), newName = r1[0], setNewName = r1[1];
  var r2 = useState(""), toast = r2[0], setToast = r2[1];
  var r3 = useState(0), newPrice = r3[0], setNewPrice = r3[1];
  var r4 = useState(null), editPriceId = r4[0], setEditPriceId = r4[1];
  var r5 = useState(""), editPriceVal = r5[0], setEditPriceVal = r5[1];
  var r6 = useState(null), recvItemId = r6[0], setRecvItemId = r6[1];
  var r7 = useState(""), recvQty = r7[0], setRecvQty = r7[1];
  var r8 = useState("day"), statsPeriod = r8[0], setStatsPeriod = r8[1];
  var emps = users.filter(function(u) { return u.role === "employee" && (u.status || "active") === "active"; });
  var pending = requests.filter(function(r) { return r.status === "pending"; });

  function showToast(msg) { setToast(msg); setTimeout(function() { setToast(""); }, 2000); }

  async function addItem() {
    if (!newName.trim()) return;
    var prevItems = items;
    var ni = { id: "item_" + Date.now(), name: newName.trim(), unitPrice: Number(newPrice) || 0 };
    var u = items.concat([ni]);
    setItems(u);
    setNewName(""); setNewPrice(0);
    var r = await store.setWithError("ft-inv-items", u);
    if (r && r.ok) {
      showToast("품목 추가됨");
    } else {
      setItems(prevItems);
      var pc = enqueuePendingAppData({ key: "ft-inv-items", value: u, op: "set" });
      showToast("추가 실패 — 오프라인 큐 (" + pc + "건)");
    }
  }

  function delItem(id) {
    var u = items.filter(function(i) { return i.id !== id; });
    setItems(u); store.set("ft-inv-items", u);
  }

  function moveItem(idx, dir) {
    var ni = idx + dir;
    if (ni < 0 || ni >= items.length) return;
    var u = items.slice();
    var tmp = u[idx]; u[idx] = u[ni]; u[ni] = tmp;
    setItems(u); store.set("ft-inv-items", u);
  }

  function saveUnitPrice(id) {
    var u = items.map(function(i) { return i.id === id ? Object.assign({}, i, { unitPrice: Number(editPriceVal) || 0 }) : i; });
    setItems(u); store.set("ft-inv-items", u);
    setEditPriceId(null); showToast("단가 수정됨");
  }

  function addInvLogEntry(itemId, itemName, type, qty, unitPrice, empId, empName) {
    var entry = { id: Date.now(), date: getToday(), itemId: itemId, itemName: itemName, type: type, qty: qty, unitPrice: unitPrice, totalCost: qty * unitPrice, empId: empId || "", empName: empName || "" };
    var nl = invLog.concat([entry]);
    setInvLog(nl); store.set("ft-inv-log", nl);
    return entry;
  }

  function receiveStock(itemId) {
    var qty = Number(recvQty);
    if (!qty || qty <= 0) return;
    var item = items.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var price = item.unitPrice || 0;
    var os = Object.assign({}, oStock);
    os[itemId] = (os[itemId] || 0) + qty;
    setOStock(os); store.set("ft-inv-office", os);
    addInvLogEntry(itemId, item.name, "in", qty, price, "", "");
    if (price > 0) {
      var vc = varCosts.concat([{ id: Date.now(), date: getToday(), category: "재고매입", amount: qty * price }]);
      setVarCosts(vc); store.set("ft-variable-costs", vc);
    }
    setRecvItemId(null); setRecvQty(""); showToast(item.name + " " + qty + "개 입고 완료");
  }

  function handleReq(req, action) {
    if (action === "approved" && (oStock[req.itemId] || 0) < req.qty) {
      showToast("재고가 부족합니다"); return;
    }
    var u = requests.map(function(r) {
      if (r.id === req.id) return Object.assign({}, r, { status: action });
      return r;
    });
    if (action === "approved") {
      var s = JSON.parse(JSON.stringify(stock));
      if (!s[req.employeeId]) s[req.employeeId] = {};
      s[req.employeeId][req.itemId] = (s[req.employeeId][req.itemId] || 0) + req.qty;
      setStock(s); store.set("ft-inv-stock", s);
      var os = Object.assign({}, oStock);
      os[req.itemId] = (os[req.itemId] || 0) - req.qty;
      setOStock(os); store.set("ft-inv-office", os);
      var item = items.find(function(i) { return i.id === req.itemId; });
      addInvLogEntry(req.itemId, req.itemName, "out", req.qty, item ? (item.unitPrice || 0) : 0, req.employeeId, req.employeeName);
    }
    setRequests(u); store.set("ft-inv-requests", u);
    showToast(action === "approved" ? "승인 완료" : "거절 완료");
  }

  function adjStock(empId, itemId, delta) {
    var curEmp = (stock[empId] && stock[empId][itemId]) || 0;
    if (delta > 0 && (oStock[itemId] || 0) < delta) { showToast("재고가 부족합니다"); return; }
    if (delta < 0 && curEmp <= 0) return;
    var s = JSON.parse(JSON.stringify(stock));
    if (!s[empId]) s[empId] = {};
    s[empId][itemId] = curEmp + delta;
    setStock(s); store.set("ft-inv-stock", s);
    var item = items.find(function(i) { return i.id === itemId; });
    var emp = users.find(function(u) { return u.id === empId; });
    var iName = item ? item.name : "";
    var eName = emp ? emp.name : "";
    var iPrice = item ? (item.unitPrice || 0) : 0;
    if (delta > 0) {
      var os = Object.assign({}, oStock);
      os[itemId] = (os[itemId] || 0) - delta;
      setOStock(os); store.set("ft-inv-office", os);
      addInvLogEntry(itemId, iName, "out", delta, iPrice, empId, eName);
    } else if (delta < 0) {
      var os2 = Object.assign({}, oStock);
      os2[itemId] = (os2[itemId] || 0) + Math.abs(delta);
      setOStock(os2); store.set("ft-inv-office", os2);
    }
  }

  function adjOffice(itemId, delta) {
    var cur = oStock[itemId] || 0;
    if (delta < 0 && cur <= 0) return;
    var os = Object.assign({}, oStock);
    os[itemId] = Math.max(0, cur + delta);
    setOStock(os); store.set("ft-inv-office", os);
  }

  var totalOfficeValue = items.reduce(function(a, item) {
    return a + (oStock[item.id] || 0) * (item.unitPrice || 0);
  }, 0);

  function delLog(entry) {
    var nl = invLog.filter(function(l) { return l.id !== entry.id; });
    setInvLog(nl); store.set("ft-inv-log", nl);
    var os = Object.assign({}, oStock);
    if (entry.type === "in") {
      os[entry.itemId] = Math.max(0, (os[entry.itemId] || 0) - entry.qty);
    } else {
      os[entry.itemId] = (os[entry.itemId] || 0) + entry.qty;
    }
    setOStock(os); store.set("ft-inv-office", os);
    if (entry.type === "in" && entry.totalCost > 0) {
      var vc = varCosts.filter(function(v) { return !(v.category === "재고매입" && v.date === entry.date && Number(v.amount) === entry.totalCost && v.id <= entry.id + 1 && v.id >= entry.id - 1); });
      if (vc.length === varCosts.length) {
        vc = varCosts.slice();
        for (var i = vc.length - 1; i >= 0; i--) {
          if (vc[i].category === "재고매입" && vc[i].date === entry.date && Number(vc[i].amount) === entry.totalCost) { vc.splice(i, 1); break; }
        }
      }
      setVarCosts(vc); store.set("ft-variable-costs", vc);
    }
    showToast("기록 삭제됨");
  }

  var statsData = useMemo(function() {
    var now = new Date();
    var today = getToday();
    var weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
    var weekKey = weekAgo.getFullYear() + "-" + String(weekAgo.getMonth() + 1).padStart(2, "0") + "-" + String(weekAgo.getDate()).padStart(2, "0");
    var monthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    var filtered = invLog.filter(function(l) {
      if (!l.date) return false;
      if (statsPeriod === "day") return l.date === today;
      if (statsPeriod === "week") return l.date >= weekKey;
      return l.date.substring(0, 7) === monthKey;
    }).sort(function(a, b) { return b.id - a.id; });
    var inQty = 0, inAmt = 0, outQty = 0, outAmt = 0;
    var byItem = {};
    filtered.forEach(function(l) {
      if (l.type === "in") { inQty += l.qty; inAmt += l.totalCost; }
      else { outQty += l.qty; outAmt += l.totalCost; }
      if (!byItem[l.itemId]) byItem[l.itemId] = { name: l.itemName, inQty: 0, inAmt: 0, outQty: 0, outAmt: 0 };
      if (l.type === "in") { byItem[l.itemId].inQty += l.qty; byItem[l.itemId].inAmt += l.totalCost; }
      else { byItem[l.itemId].outQty += l.qty; byItem[l.itemId].outAmt += l.totalCost; }
    });
    return { inQty: inQty, inAmt: inAmt, outQty: outQty, outAmt: outAmt, byItem: byItem, list: filtered };
  }, [invLog, statsPeriod]);

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { marginBottom: 18 })}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>📦 품목 관리</p>
        <div style={{ display: "flex", gap: 11, marginBottom: 16 }}>
          <input value={newName} onChange={function(e) { setNewName(e.target.value); }} placeholder="품목명" style={Object.assign({}, IS, { flex: 1 })} />
          <input type="number" value={newPrice || ""} onChange={function(e) { setNewPrice(e.target.value); }} placeholder="단가" style={Object.assign({}, IS, { width: 80 })} inputMode="numeric" />
          <button onClick={addItem} style={Object.assign({}, BP, { width: "auto", padding: "10px 20px" })}>추가</button>
        </div>
        {items.map(function(item, idx) {
          var isEditing = editPriceId === item.id;
          return (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={function() { moveItem(idx, -1); }} disabled={idx === 0}
                    style={{ border: "none", background: "none", fontSize: 12, cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#d4d4d8" : "#71717a", padding: 0, lineHeight: 1 }}>▲</button>
                  <button onClick={function() { moveItem(idx, 1); }} disabled={idx === items.length - 1}
                    style={{ border: "none", background: "none", fontSize: 12, cursor: idx === items.length - 1 ? "default" : "pointer", color: idx === items.length - 1 ? "#d4d4d8" : "#71717a", padding: 0, lineHeight: 1 }}>▼</button>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                {isEditing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" value={editPriceVal} onChange={function(e) { setEditPriceVal(e.target.value); }} style={Object.assign({}, IS, { width: 70, padding: "2px 6px", fontSize: 12 })} inputMode="numeric" />
                    <button onClick={function() { saveUnitPrice(item.id); }} style={{ border: "none", background: "none", color: "#16a34a", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✓</button>
                    <button onClick={function() { setEditPriceId(null); }} style={{ border: "none", background: "none", color: "#a1a1aa", fontSize: 12, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <span onClick={function() { setEditPriceId(item.id); setEditPriceVal(String(item.unitPrice || 0)); }} style={{ fontSize: 12, color: "#71717a", cursor: "pointer", textDecoration: "underline dotted" }}>@{formatCurrency(item.unitPrice || 0)}</span>
                )}
              </div>
              <button onClick={function() { delItem(item.id); }} style={Object.assign({}, BO, { padding: "2px 9px", fontSize: 12, color: "#e1360a", borderColor: "#f5c6c0" })}>삭제</button>
            </div>
          );
        })}
      </div>

      <div style={Object.assign({}, CS, { marginBottom: 18 })}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>🏢 사무실 재고</p>
        {items.length === 0 ? <p style={{ color: "#a1a1aa", fontSize: 13, textAlign: "center", padding: 16 }}>품목을 먼저 추가하세요</p> : (
          <div>
            {items.map(function(item) {
              var qty = oStock[item.id] || 0;
              var isRecv = recvItemId === item.id;
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f4f4f5" }}>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600, minWidth: 0 }}>{item.name}</span>
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <button onClick={function() { adjOffice(item.id, -1); }} style={{ border: "none", background: "none", color: "#e1360a", fontSize: 16, cursor: "pointer", padding: "0 4px", fontWeight: 700, width: 30, textAlign: "center" }}>−</button>
                    <span style={{ fontSize: 16, fontWeight: 800, minWidth: 30, textAlign: "center" }}>{qty}</span>
                    <button onClick={function() { adjOffice(item.id, 1); }} style={{ border: "none", background: "none", color: "#16a34a", fontSize: 16, cursor: "pointer", padding: "0 4px", fontWeight: 700, width: 30, textAlign: "center" }}>+</button>
                  </div>
                  <span style={{ fontSize: 12, color: "#a1a1aa", minWidth: 76, textAlign: "right", flexShrink: 0, marginLeft: 2 }}>{item.unitPrice > 0 ? "(" + formatCurrency(qty * item.unitPrice) + ")" : ""}</span>
                  <div style={{ marginLeft: 8, flexShrink: 0 }}>
                    {isRecv ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="number" value={recvQty} onChange={function(e) { setRecvQty(e.target.value); }} placeholder="수량" style={Object.assign({}, IS, { width: 60, padding: "2px 6px", fontSize: 12 })} inputMode="numeric" />
                        <button onClick={function() { receiveStock(item.id); }} style={Object.assign({}, BO, { padding: "2px 9px", fontSize: 12, color: "#16a34a", borderColor: "#bbf7d0" })}>확인</button>
                        <button onClick={function() { setRecvItemId(null); setRecvQty(""); }} style={{ border: "none", background: "none", color: "#a1a1aa", fontSize: 12, cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={function() { setRecvItemId(item.id); setRecvQty(""); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 12, color: "#2563eb", borderColor: "#bfdbfe" })}>입고</button>
                    )}
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 11, padding: "9px 11px", background: "#f0f9ff", borderRadius: 9 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>사무실 재고 총 가치</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{formatCurrency(totalOfficeValue)}</span>
            </div>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div style={Object.assign({}, CS, { marginBottom: 18 })}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 11px" }}>🔔 보충 요청 ({pending.length})</p>
          {pending.map(function(req) {
            var offQty = oStock[req.itemId] || 0;
            var insufficient = offQty < req.qty;
            return (
              <div key={req.id} style={{ padding: "10px 0", borderBottom: "1px solid #f4f4f5" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{req.employeeName} — {req.itemName}</p>
                    <p style={{ fontSize: 13, color: "#71717a", margin: "2px 0 0" }}>{req.qty}개 요청</p>
                    {insufficient && <p style={{ fontSize: 12, color: "#e1360a", fontWeight: 600, margin: "2px 0 0" }}>⚠ 사무실 재고 부족 (현재 {offQty}개)</p>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={function() { handleReq(req, "approved"); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 12, color: "#16a34a", borderColor: "#bbf7d0" })}>승인</button>
                    <button onClick={function() { handleReq(req, "rejected"); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 12, color: "#e1360a", borderColor: "#f5c6c0" })}>거절</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 18 })}>
        <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 11px" }}>👥 직원별 재고 현황</p>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          {items.length === 0 ? <p style={{ color: "#a1a1aa", fontSize: 13, textAlign: "center", padding: 16 }}>품목을 먼저 추가하세요</p> :
            emps.map(function(emp) {
              var empStock = stock[emp.id] || {};
              return (
                <div key={emp.id} style={{ marginBottom: 18, paddingBottom: 13, borderBottom: "1px solid #f4f4f5" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 9px" }}>{emp.name}</p>
                  <div>
                    {items.map(function(item) {
                      var qty = empStock[item.id] || 0;
                      return (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#71717a", minWidth: 0 }}>{item.name}</span>
                          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <button onClick={function() { adjStock(emp.id, item.id, -1); }} style={{ border: "none", background: "none", color: "#e1360a", fontSize: 16, cursor: "pointer", padding: "0 4px", fontWeight: 700, width: 30, textAlign: "center" }}>−</button>
                            <span style={{ fontSize: 15, fontWeight: 800, minWidth: 30, textAlign: "center" }}>{qty}</span>
                            <button onClick={function() { adjStock(emp.id, item.id, 1); }} style={{ border: "none", background: "none", color: "#16a34a", fontSize: 16, cursor: "pointer", padding: "0 4px", fontWeight: 700, width: 30, textAlign: "center" }}>+</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      <div style={Object.assign({}, CS, { padding: 16 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📊 재고 사용 통계</p>
          <div style={{ display: "flex", gap: 6 }}>
            {["day", "week", "month"].map(function(pd) {
              var labels = { day: "일", week: "주", month: "월" };
              return <button key={pd} onClick={function() { setStatsPeriod(pd); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 12 }, statsPeriod === pd ? { background: "#2563eb", color: "#fff", borderColor: "#2563eb" } : {})}>{labels[pd]}</button>;
            })}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 18 }}>
          <div style={{ padding: "11px 13px", background: "#f0fdf4", borderRadius: 9, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, margin: "0 0 2px" }}>입고</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", margin: "0 0 2px" }}>{statsData.inQty}개</p>
            <p style={{ fontSize: 13, color: "#16a34a", margin: 0 }}>{formatCurrency(statsData.inAmt)}</p>
          </div>
          <div style={{ padding: "11px 13px", background: "#fef2f2", borderRadius: 9, textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#e1360a", fontWeight: 600, margin: "0 0 2px" }}>출고</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#e1360a", margin: "0 0 2px" }}>{statsData.outQty}개</p>
            <p style={{ fontSize: 13, color: "#e1360a", margin: 0 }}>{formatCurrency(statsData.outAmt)}</p>
          </div>
        </div>
        {Object.keys(statsData.byItem).length > 0 && (
          <div>
            <div style={{ display: "flex", padding: "6px 0", borderBottom: "2px solid #f0f0f3", fontSize: 12, fontWeight: 700, color: "#71717a" }}>
              <span style={{ flex: 1 }}>품목</span>
              <span style={{ width: 60, textAlign: "right" }}>입고</span>
              <span style={{ width: 60, textAlign: "right" }}>출고</span>
              <span style={{ width: 80, textAlign: "right" }}>입고 금액</span>
            </div>
            {Object.keys(statsData.byItem).map(function(id) {
              var d = statsData.byItem[id];
              return (
                <div key={id} style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid #f4f4f5", fontSize: 14 }}>
                  <span style={{ flex: 1, fontWeight: 600 }}>{d.name}</span>
                  <span style={{ width: 60, textAlign: "right", color: "#16a34a" }}>{d.inQty}개</span>
                  <span style={{ width: 60, textAlign: "right", color: "#e1360a" }}>{d.outQty}개</span>
                  <span style={{ width: 80, textAlign: "right", color: "#71717a" }}>{formatCurrency(d.inAmt)}</span>
                </div>
              );
            })}
          </div>
        )}
        {Object.keys(statsData.byItem).length === 0 && <p style={{ textAlign: "center", padding: 16, color: "#a1a1aa", fontSize: 13 }}>해당 기간 기록 없음</p>}
        {statsData.list.length > 0 && (
          <div style={{ marginTop: 13 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#71717a", margin: "0 0 7px" }}>입출고 기록</p>
            {statsData.list.map(function(l) {
              var isIn = l.type === "in";
              return (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isIn ? "#16a34a" : "#e1360a", padding: "1px 7px", borderRadius: 4, background: isIn ? "#f0fdf4" : "#fef2f2" }}>{isIn ? "입고" : "출고"}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{l.itemName}</span>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{l.qty}개</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 2 }}>
                      {formatDate(l.date)}{l.empName ? " · " + l.empName : ""}{l.totalCost > 0 ? " · " + formatCurrency(l.totalCost) : ""}
                    </div>
                  </div>
                  <button onClick={function() { delLog(l); }} style={{ border: "none", background: "none", color: "#a1a1aa", fontSize: 13, cursor: "pointer", padding: "4px", flexShrink: 0 }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Toast msg={toast} isUnfolded={p.isUnfolded} />
    </div>
  );
}

/* ===== 관리자: 직원 ===== */
function AdminEmployee(p) {
  var users = p.users, setUsers = p.setUsers, settings = p.settings, setSettings = p.setSettings, schedules = p.schedules, setSchedules = p.setSchedules;
  var reports = p.reports, setReports = p.setReports;
  var r1 = useState(null), selId = r1[0], setSelId = r1[1];
  var r2 = useState(false), adding = r2[0], setAdding = r2[1];
  var r3 = useState(""), toast = r3[0], setToast = r3[1];
  var r4 = useState({ name: "", phone: "", pin: "", hireDate: getToday() }), newEmp = r4[0], setNewEmp = r4[1];
  var r15 = useState(false), schEdit = r15[0], setSchEdit = r15[1];
  var r16 = useState(null), payViewId = r16[0], setPayViewId = r16[1];
  var r17 = useState(20), payShow = r17[0], setPayShow = r17[1];
  var r18 = useState("all"), empFilter = r18[0], setEmpFilter = r18[1];
  var allEmps = users.filter(function(u) { return u.role === "employee" && (u.status || "active") !== "deleted"; });
  var emps = empFilter === "all" ? allEmps : allEmps.filter(function(u) { return (u.status || "active") === empFilter; });
  var vehicles = settings.vehicles || {};
  var empSettings = settings.empSettings || {};
  var dayLabels = ["월", "화", "수", "목", "금", "토"];
  var dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat"];

  function updateSchedule(empId, key, val) {
    var u = JSON.parse(JSON.stringify(schedules || {}));
    if (!u[empId]) u[empId] = {};
    u[empId][key] = val;
    setSchedules(u);
    store.set("ft-schedules", u);
  }

  function saveUser(id, field, val) {
    var u = users.map(function(x) {
      if (x.id === id) { var n = Object.assign({}, x); n[field] = val; return n; }
      return x;
    });
    setUsers(u); store.set("ft-users", u);
  }

  function saveVehicle(id, val) {
    var v = Object.assign({}, vehicles); v[id] = val;
    var s = Object.assign({}, settings, { vehicles: v });
    setSettings(s); store.set("ft-settings", s);
  }

  function saveEmpSetting(id, field, val) {
    var es = Object.assign({}, empSettings);
    if (!es[id]) es[id] = {};
    es[id][field] = Number(val) || 0;
    var s = Object.assign({}, settings, { empSettings: es });
    setSettings(s); store.set("ft-settings", s);
  }

  function addEmp() {
    if (!newEmp.name.trim() || newEmp.pin.length !== 6) { setToast("이름과 PIN 6자리 필요"); setTimeout(function() { setToast(""); }, 2000); return; }
    if (users.some(function(u) { return u.pin === newEmp.pin && (u.status || "active") === "active"; })) { setToast("이미 사용 중인 PIN"); setTimeout(function() { setToast(""); }, 2000); return; }
    var ne = { id: "emp_" + Date.now(), name: newEmp.name.trim(), role: "employee", pin: newEmp.pin, phone: newEmp.phone, hireDate: newEmp.hireDate, status: "active" };
    var u = users.concat([ne]);
    setUsers(u); store.set("ft-users", u);
    setNewEmp({ name: "", phone: "", pin: "", hireDate: getToday() });
    setAdding(false);
    setToast("직원 추가됨"); setTimeout(function() { setToast(""); }, 2000);
  }

  function resignEmp(id) {
    var u = users.map(function(x) { return x.id === id ? Object.assign({}, x, { status: "resigned" }) : x; });
    setUsers(u); store.set("ft-users", u);
    setToast("퇴사 처리 완료"); setTimeout(function() { setToast(""); }, 2000);
  }

  function permanentDeleteEmp(id) {
    if (!confirm("영구 삭제하면 직원 목록에서 완전히 숨겨집니다.\n데이터는 보존되지만 복원할 수 없습니다.\n계속하시겠습니까?")) return;
    var u = users.map(function(x) { return x.id === id ? Object.assign({}, x, { status: "deleted" }) : x; });
    setUsers(u); store.set("ft-users", u);
    setSelId(null);
    setToast("영구 삭제 완료"); setTimeout(function() { setToast(""); }, 2000);
  }

  function reactivateEmp(id) {
    var u = users.map(function(x) { return x.id === id ? Object.assign({}, x, { status: "active" }) : x; });
    setUsers(u); store.set("ft-users", u);
    setToast("복원 완료"); setTimeout(function() { setToast(""); }, 2000);
  }

  function getES(id, field) {
    return empSettings[id] && empSettings[id][field] !== undefined ? empSettings[id][field] : (settings[field] || 0);
  }

  function getEmpPay(empId) {
    var hw = getES(empId, "hourlyWage");
    var sb = getES(empId, "salesBonus");
    var list = [];
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      Object.entries(dr).forEach(function(re) {
        var rk = re[0], r = re[1];
        var uid = r.userId || rk;
        if (uid === empId && r.savedAt) {
          var sold = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          var mins = 0;
          if (r.clockIn && r.clockOut) {
            var a = r.clockIn.split(":"), b = r.clockOut.split(":");
            mins = (Number(b[0]) * 60 + Number(b[1])) - (Number(a[0]) * 60 + Number(a[1]));
            if (mins < 0) mins += 1440;
          }
          var autoPay = Math.max(Math.round(mins / 60 * hw), sold * sb);
          list.push({ date: date, rk: rk, sold: sold, mins: mins, autoPay: autoPay, pay: r.payOverride !== undefined ? r.payOverride : autoPay, paid: r.paid || false, hasOverride: r.payOverride !== undefined });
        }
      });
    });
    return list.sort(function(a, b) { return b.date.localeCompare(a.date); });
  }

  async function updatePay(date, rk, field, val) {
    var prevReports = reports;
    var u = JSON.parse(JSON.stringify(reports));
    if (!(u[date] && u[date][rk])) return;
    u[date][rk][field] = val;
    setReports(u);
    var updated = u[date][rk];
    var row = reportStore.toRow(rk, date, updated);
    markInflightUpsert(rk, date, updated);
    var ok = await reportStore.upsert(row);
    clearInflightUpsert(rk);
    if (!ok) {
      console.error("[AdminEmployee.updatePay] 저장 실패, 롤백 + 큐 적재");
      var pendingCount = enqueuePendingReport(row);
      setReports(prevReports);
      setToast("지급 변경 저장 실패 — 오프라인 큐 (" + pendingCount + "건)");
      setTimeout(function() { setToast(""); }, 3500);
    }
  }

  if (payViewId) {
    var payEmp = users.find(function(u) { return u.id === payViewId; });
    var payName = payEmp ? payEmp.name : "";
    var payList = getEmpPay(payViewId);
    var payTotal = payList.reduce(function(a, r) { return a + r.pay; }, 0);
    var payPaid = payList.filter(function(r) { return r.paid; }).reduce(function(a, r) { return a + r.pay; }, 0);
    var payUnpaid = payTotal - payPaid;
    return (
      <div style={PAGE}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={function() { setPayViewId(null); }} style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 13 })}>← 돌아가기</button>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{payName}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 11, marginBottom: 20 }}>
          <div style={Object.assign({}, CS, { textAlign: "center", padding: 13, minWidth: 0 })}>
            <p style={{ fontSize: 12, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>총 급여</p>
            <p style={{ fontSize: 15, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(payTotal)}</p>
          </div>
          <div style={Object.assign({}, CS, { textAlign: "center", padding: 13, minWidth: 0 })}>
            <p style={{ fontSize: 12, color: "#16a34a", margin: "0 0 2px", fontWeight: 600 }}>지급완료</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#16a34a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(payPaid)}</p>
          </div>
          <div style={Object.assign({}, CS, { textAlign: "center", padding: 13, minWidth: 0 })}>
            <p style={{ fontSize: 12, color: "#e1360a", margin: "0 0 2px", fontWeight: 600 }}>미지급</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#e1360a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatCurrency(payUnpaid)}</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.5fr", padding: "9px 9px", fontSize: 12, fontWeight: 600, color: "#a1a1aa", borderBottom: "1px solid #f0f0f3" }}>
          <span>일자</span><span style={{ textAlign: "center" }}>자동계산</span><span style={{ textAlign: "center" }}>급여</span><span style={{ textAlign: "center" }}>상태</span>
        </div>
        {payList.length === 0 ? <p style={{ textAlign: "center", padding: 36, color: "#a1a1aa", fontSize: 15 }}>급여 기록이 없습니다</p> :
          payList.slice(0, payShow).map(function(py) {
            return (
              <div key={py.rk} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.5fr", padding: "11px 9px", borderBottom: "1px solid #f4f4f5", fontSize: 14, alignItems: "center" }}>
                <div>
                  <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>{formatDate(py.date)}</p>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{py.sold}개 · {Math.floor(py.mins / 60)}시간 {py.mins % 60}분</p>
                </div>
                <span style={{ textAlign: "center", color: "#a1a1aa", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{formatCurrency(py.autoPay)}</span>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <input type="number" value={py.pay} inputMode="numeric"
                    onChange={function(e) { updatePay(py.date, py.rk, "payOverride", e.target.value === "" ? undefined : Number(e.target.value)); }}
                    style={{ width: "100%", padding: "7px 4px", borderRadius: 7, border: "1px solid " + (py.hasOverride ? "#e1360a" : "#f0f0f3"), fontSize: 13, fontWeight: 700, textAlign: "center", outline: "none", background: py.hasOverride ? "#fff8f6" : "#fafafa", color: "#18181b", boxSizing: "border-box" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <button onClick={function() { updatePay(py.date, py.rk, "paid", !py.paid); }}
                    style={{ border: "none", background: py.paid ? "#dcfce7" : "#fef2f2", color: py.paid ? "#16a34a" : "#e1360a", fontSize: 11, fontWeight: 700, padding: "3px 6px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {py.paid ? "지급" : "미지급"}
                  </button>
                </div>
              </div>
            );
          })
        }
        {payShow < payList.length && <button onClick={function() { setPayShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 14, color: "#71717a", marginTop: 9 })}>더 보기</button>}
      </div>
    );
  }

  return (
    <div style={PAGE}>
      {/* 출근지 현황 */}
      <div style={Object.assign({}, CS, { padding: 16, marginBottom: 18 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📍 직원 출근지 현황</p>
          <button onClick={function() { setSchEdit(!schEdit); }}
            style={Object.assign({}, BO, { padding: "4px 12px", fontSize: 12 }, schEdit ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>
            {schEdit ? "완료" : "수정"}
          </button>
        </div>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "57px 30px repeat(6, " + (schEdit ? "140px" : "88px") + ")", gap: schEdit ? 6 : 4, fontSize: 12, minWidth: schEdit ? 970 : 650 }}>
            <div /><div />
            {dayLabels.map(function(d) { return <div key={d} style={{ textAlign: "center", fontWeight: 700, color: "#71717a", padding: "4px 0" }}>{d}</div>; })}
            {allEmps.filter(function(u) { return (u.status || "active") === "active"; }).map(function(emp) {
              var sch = (schedules || {})[emp.id] || {};
              var mainRow = [
                <div key={emp.id + "_n"} style={{ fontWeight: 600, color: "#18181b", fontSize: 12, gridRow: "span 2", display: "flex", alignItems: "center" }}>{emp.name}</div>,
                <div key={emp.id + "_ml"} style={{ fontSize: 12, fontWeight: 700, color: "#e1360a", display: "flex", alignItems: "center" }}>메인</div>
              ].concat(dayKeys.map(function(dk) {
                var v = sch[dk + "_main"] || "";
                if (schEdit) {
                  return <input key={emp.id + "_m_" + dk} value={v} placeholder="-"
                    onChange={function(e) { updateSchedule(emp.id, dk + "_main", e.target.value); }}
                    style={{ width: "100%", padding: "8px 6px", borderRadius: 6, border: "1px solid #f0f0f3", fontSize: 12, fontWeight: 600, textAlign: "center", outline: "none", background: "#fff", color: "#e1360a", boxSizing: "border-box" }} />;
                }
                return <div key={emp.id + "_m_" + dk} style={{ textAlign: "center", padding: "3px 2px", background: v ? "#fff8f6" : "#fafafa", borderRadius: 4, color: v ? "#e1360a" : "#d4d4d8", fontWeight: 600 }}>{v || "-"}</div>;
              }));
              var subRow = [
                <div key={emp.id + "_sl"} style={{ fontSize: 12, fontWeight: 600, color: "#a1a1aa", display: "flex", alignItems: "center" }}>서브</div>
              ].concat(dayKeys.map(function(dk) {
                var v = sch[dk + "_sub"] || "";
                if (schEdit) {
                  return <input key={emp.id + "_s_" + dk} value={v} placeholder="-"
                    onChange={function(e) { updateSchedule(emp.id, dk + "_sub", e.target.value); }}
                    style={{ width: "100%", padding: "8px 6px", borderRadius: 6, border: "1px solid #f0f0f3", fontSize: 12, fontWeight: 600, textAlign: "center", outline: "none", background: "#fff", color: "#16a34a", boxSizing: "border-box" }} />;
                }
                return <div key={emp.id + "_s_" + dk} style={{ textAlign: "center", padding: "3px 2px", background: v ? "#f0fdf4" : "#fafafa", borderRadius: 4, color: v ? "#16a34a" : "#d4d4d8", fontWeight: 600 }}>{v || "-"}</div>;
              }));
              return mainRow.concat(subRow);
            })}
          </div>
        </div>
      </div>
      {/* 직원 필터 + 목록 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 11px" }}>
        <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>👥 직원 목록</p>
        <div style={{ display: "flex", gap: 7 }}>
          {[{ k: "all", l: "전체" }, { k: "active", l: "재직" }, { k: "resigned", l: "퇴사" }].map(function(f) {
            return (
              <button key={f.k} onClick={function() { setEmpFilter(f.k); }}
                style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 12 }, empFilter === f.k ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>
                {f.l}
              </button>
            );
          })}
        </div>
      </div>
      {emps.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 14 }}>{empFilter === "resigned" ? "퇴사 직원이 없습니다" : "직원이 없습니다"}</div>}
      {emps.map(function(emp) {
        var isOpen = selId === emp.id;
        var vn = vehicles[emp.id] || "";
        var empStatus = emp.status || "active";
        var isResigned = empStatus === "resigned";
        return (
          <div key={emp.id} style={Object.assign({}, CS, { marginBottom: 11, padding: 0 }, isResigned ? { opacity: 0.75 } : {})}>
            <div onClick={function() { setSelId(isOpen ? null : emp.id); }}
              style={{ padding: "13px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{emp.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: isResigned ? "#fef2f2" : "#dcfce7", color: isResigned ? "#e1360a" : "#16a34a" }}>
                  {isResigned ? "🔴 퇴사" : "🟢 재직"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                {vn && <span style={{ fontSize: 12, color: "#e1360a", fontWeight: 600 }}>{vn}</span>}
                <span style={{ fontSize: 16, color: "#a1a1aa" }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: "0 18px 18px", borderTop: "1px solid #f4f4f5" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginTop: 13 }}>
                  <div><label style={LS}>전화번호</label><input value={emp.phone || ""} onChange={function(e) { saveUser(emp.id, "phone", e.target.value); }} placeholder="010-0000-0000" style={IS} /></div>
                  <div><label style={LS}>입사일자</label><input type="date" value={emp.hireDate || ""} onChange={function(e) { saveUser(emp.id, "hireDate", e.target.value); }} style={IS} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginTop: 9 }}>
                  <div><label style={LS}>차량 배정</label><input value={vn} onChange={function(e) { saveVehicle(emp.id, e.target.value); }} placeholder="차량명" style={IS} /></div>
                  <div><label style={LS}>PIN</label><input value={emp.pin} onChange={function(e) { saveUser(emp.id, "pin", e.target.value.replace(/\D/g, "").slice(0, 6)); }} style={IS} inputMode="numeric" maxLength={6} /></div>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#71717a", margin: "16px 0 7px" }}>💲 개별 급여 설정</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 11 }}>
                  <NumInput label="판매단가" value={getES(emp.id, "pricePerUnit")} onChange={function(v) { saveEmpSetting(emp.id, "pricePerUnit", v); }} suffix="원" />
                  <NumInput label="시급" value={getES(emp.id, "hourlyWage")} onChange={function(v) { saveEmpSetting(emp.id, "hourlyWage", v); }} suffix="원" />
                  <NumInput label="판매수당" value={getES(emp.id, "salesBonus")} onChange={function(v) { saveEmpSetting(emp.id, "salesBonus", v); }} suffix="원" />
                </div>
                <div style={{ display: "flex", gap: 11, marginTop: 16 }}>
                  <button onClick={function() { setPayViewId(emp.id); setPayShow(20); }}
                    style={Object.assign({}, BP, { flex: 1, fontSize: 14 })}>
                    💵 급여 관리
                  </button>
                  {(emp.status || "active") === "active" && (
                    <button onClick={function() { resignEmp(emp.id); }}
                      style={Object.assign({}, BO, { padding: "9px 13px", fontSize: 14, color: "#e1360a", borderColor: "#f5c6c0" })}>
                      퇴사처리
                    </button>
                  )}
                  {(emp.status || "active") === "resigned" && (
                    <button onClick={function() { reactivateEmp(emp.id); }}
                      style={Object.assign({}, BO, { padding: "9px 13px", fontSize: 14, color: "#16a34a", borderColor: "#bbf7d0" })}>
                      복원
                    </button>
                  )}
                  {(emp.status || "active") === "resigned" && (
                    <button onClick={function() { permanentDeleteEmp(emp.id); }}
                      style={Object.assign({}, BO, { padding: "9px 13px", fontSize: 14, color: "#a1a1aa", borderColor: "#f0f0f3" })}>
                      영구삭제
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {/* 직원 추가 모달 */}
      {adding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: 30, width: "100%", maxWidth: 460 }}>
            <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px" }}>👤 직원 추가</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={LS}>이름</label><input value={newEmp.name} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { name: e.target.value })); }} placeholder="이름" style={IS} /></div>
              <div><label style={LS}>전화번호</label><input value={newEmp.phone} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { phone: e.target.value })); }} placeholder="010-0000-0000" style={IS} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={LS}>PIN 6자리</label><input value={newEmp.pin} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { pin: e.target.value.replace(/\D/g, "").slice(0, 6) })); }} placeholder="000000" style={IS} inputMode="numeric" maxLength={6} /></div>
              <div><label style={LS}>입사일자</label><input type="date" value={newEmp.hireDate} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { hireDate: e.target.value })); }} style={IS} /></div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={function() { setAdding(false); }} style={Object.assign({}, BO, { flex: 1 })}>취소</button>
              <button onClick={addEmp} style={Object.assign({}, BP, { flex: 1 })}>추가</button>
            </div>
          </div>
        </div>
      )}
      {/* FAB */}
      <button onClick={function() { setAdding(true); }} style={{ position: "fixed", bottom: p.isUnfolded ? 28 : 96, right: p.isUnfolded ? 28 : 20, width: 62, height: 62, borderRadius: 31, background: "#e1360a", color: "#fff", border: "none", fontSize: 30, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(225,54,10,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>+</button>
      <Toast msg={toast} isUnfolded={p.isUnfolded} />
    </div>
  );
}


function AdminReport(p) {
  var reports = p.reports, setReports = p.setReports, users = p.users, settings = p.settings;
  var employees = users.filter(function(u) { return u.role === "employee"; });
  var r1 = useState(null), selEmpId = r1[0], setSelEmpId = r1[1];
  var r2 = useState(null), selKey = r2[0], setSelKey = r2[1];
  var r3 = useState(null), selDate = r3[0], setSelDate = r3[1];
  var r4 = useState(10), show = r4[0], setShow = r4[1];
  var r5 = useState(""), toast = r5[0], setToast = r5[1];
  var nowAR = new Date();
  var arv1 = useState(nowAR.getFullYear()), arViewYear = arv1[0], setArViewYear = arv1[1];
  var arv2 = useState(nowAR.getMonth() + 1), arViewMonth = arv2[0], setArViewMonth = arv2[1];
  var arv3 = useState(false), arViewAll = arv3[0], setArViewAll = arv3[1];
  var emptyForm = { clockIn: "", clockOut: "", ship_sunsal: "", ship_padak: "", sunsal: "", padak: "", loss: "", chobeol: "", transfer: "", cash: "" };
  var r6 = useState(emptyForm), formData = r6[0], setFormData = r6[1];
  var r7 = useState(false), editing = r7[0], setEditing = r7[1];

  var selEmp = users.find(function(u) { return u.id === selEmpId; });

  var list = useMemo(function() {
    if (!selEmpId) return [];
    var l = [];
    Object.entries(reports).forEach(function(e) {
      var date = e[0], dr = e[1];
      Object.entries(dr).forEach(function(re) {
        var rk = re[0], r = re[1];
        var uid = r.userId || rk;
        if (uid === selEmpId && r.savedAt) {
          var sold = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          l.push({ date: date, rk: rk, sold: sold, rev: sold * (settings.pricePerUnit || 5000), savedAt: r.savedAt, ship_sunsal: r.ship_sunsal || 0, ship_padak: r.ship_padak || 0, sunsal: r.sunsal || 0, padak: r.padak || 0, loss: r.loss || 0, employeeName: r.employeeName || "" });
        }
      });
    });
    l.sort(function(a, b) { return (b.date + b.savedAt).localeCompare(a.date + a.savedAt); });
    return l;
  }, [reports, selEmpId, settings]);

  function openReport(date, rk) {
    var ex = reports[date] ? reports[date][rk] : null;
    if (ex) {
      setFormData({ clockIn: ex.clockIn || "", clockOut: ex.clockOut || "", ship_sunsal: ex.ship_sunsal || "", ship_padak: ex.ship_padak || "", sunsal: ex.sunsal || "", padak: ex.padak || "", loss: ex.loss || "", chobeol: ex.chobeol || "", transfer: ex.transfer || "", cash: ex.cash || "" });
      setEditing(false);
    }
    setSelDate(date);
    setSelKey(rk);
  }

  function up(k, v) {
    var obj = Object.assign({}, formData);
    obj[k] = v;
    setFormData(obj);
  }

  async function save() {
    var prevReports = reports;
    try {
      var u = JSON.parse(JSON.stringify(reports));
      if (!u[selDate]) u[selDate] = {};
      var ex = u[selDate][selKey] || {};
      var reportData = Object.assign({}, ex, formData, { savedAt: new Date().toISOString() });
      u[selDate][selKey] = reportData;
      // optimistic
      setReports(u);
      setEditing(false);
      var row = reportStore.toRow(selKey, selDate, reportData);
      markInflightUpsert(selKey, selDate, reportData);
      var result = await reportStore.upsertWithError(row);
      clearInflightUpsert(selKey);
      if (result && result.ok) {
        setToast("수정 완료!");
        setTimeout(function() { setToast(""); }, 2000);
      } else {
        console.error("[AdminReport.save] DB 저장 실패:", result && result.message);
        var pendingCount = enqueuePendingReport(row);
        setReports(prevReports);
        setEditing(true);
        setToast("저장 실패 — 오프라인 큐에 보관됨 (" + pendingCount + "건 대기, 네트워크 복귀 시 자동 재시도)");
        setTimeout(function() { setToast(""); }, 4500);
      }
    } catch(e) {
      console.error("[AdminReport.save] 오류:", e);
      try { setReports(prevReports); } catch(_) {}
      setEditing(true);
      setToast("저장 실패: " + (e && e.message ? e.message : "오류"));
      setTimeout(function() { setToast(""); }, 3000);
    }
  }

  async function deleteReport() {
    if (!confirm("이 일보를 삭제하시겠습니까?")) return;
    var prevReports = reports;
    var prevSelKey = selKey;
    var prevSelDate = selDate;
    var u = JSON.parse(JSON.stringify(reports));
    var hadKey = !!(u[selDate] && u[selDate][selKey]);
    if (hadKey) {
      delete u[selDate][selKey];
      if (Object.keys(u[selDate]).length === 0) delete u[selDate];
      setReports(u);
    } else {
      setReports(u);
    }
    setSelKey(null);
    setSelDate(null);
    if (!hadKey) {
      setToast("삭제 완료!");
      setTimeout(function() { setToast(""); }, 2000);
      return;
    }
    // in-flight delete 가드 + 결과 대기
    markInflightDelete(prevSelKey);
    var ok = await reportStore.remove(prevSelKey);
    clearInflightDelete(prevSelKey);
    if (ok) {
      setToast("삭제 완료!");
      setTimeout(function() { setToast(""); }, 2000);
    } else {
      // 롤백: 화면 복원
      setReports(prevReports);
      setSelKey(prevSelKey);
      setSelDate(prevSelDate);
      setToast("삭제 실패 — 네트워크 확인 후 다시 시도하세요");
      setTimeout(function() { setToast(""); }, 3500);
    }
  }

  function goBack() {
    setSelKey(null);
    setSelDate(null);
    setEditing(false);
  }

  function goBackToCards() {
    setSelEmpId(null);
    setSelKey(null);
    setSelDate(null);
    setEditing(false);
    setShow(10);
  }

  var empStats = useMemo(function() {
    var m = {};
    var price = settings.pricePerUnit || 5000;
    employees.forEach(function(emp) { m[emp.id] = { count: 0, totalSold: 0, totalRev: 0 }; });
    Object.entries(reports).forEach(function(e) {
      var dr = e[1];
      Object.entries(dr).forEach(function(re) {
        var r = re[1];
        var uid = r.userId || re[0];
        if (m[uid] && r.savedAt) {
          var sold = (Number(r.sunsal) || 0) + (Number(r.padak) || 0);
          m[uid].count++;
          m[uid].totalSold += sold;
          m[uid].totalRev += sold * price;
        }
      });
    });
    return m;
  }, [reports, employees, settings]);

  // hooks는 early return 전에 호출해야 함 (React 규칙)
  var arMonthKey = arViewYear + "-" + String(arViewMonth).padStart(2, "0");
  var adminFiltered = useMemo(function() {
    if (!selEmpId) return [];
    if (arViewAll) return list;
    return list.filter(function(r) { return r.date.substring(0, 7) === arMonthKey; });
  }, [list, selEmpId, arMonthKey, arViewAll]);

  var adminMonthSummary = useMemo(function() {
    var s = 0, rv = 0;
    adminFiltered.forEach(function(r) { s += r.sold; rv += r.rev; });
    return { sold: s, rev: rv, count: adminFiltered.length };
  }, [adminFiltered]);

  function arPrevMonth() { if (arViewMonth === 1) { setArViewMonth(12); setArViewYear(arViewYear - 1); } else { setArViewMonth(arViewMonth - 1); } setShow(10); }
  function arNextMonth() { if (arViewMonth === 12) { setArViewMonth(1); setArViewYear(arViewYear + 1); } else { setArViewMonth(arViewMonth + 1); } setShow(10); }

  // 상세 보기/수정 화면
  if (selKey !== null && selDate !== null) {
    var shipped = (Number(formData.ship_sunsal) || 0) + (Number(formData.ship_padak) || 0);
    var sold = (Number(formData.sunsal) || 0) + (Number(formData.padak) || 0);
    var rem = shipped - sold - (Number(formData.loss) || 0);
    var rev = sold * (settings.pricePerUnit || 5000);

    return (
      <div style={PAGE}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button onClick={goBack} style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 13 })}>← 목록</button>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#18181b", margin: 0 }}>📅 {formatDate(selDate)}</p>
          {!editing ? <button onClick={function() { setEditing(true); }} style={Object.assign({}, BO, { padding: "4px 14px", fontSize: 13 })}>수정</button> : <div style={{ width: 48 }} />}
        </div>
        <div style={Object.assign({}, CS, { padding: "11px 16px", marginBottom: 16, background: "#fff8f6" })}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#e1360a", margin: 0 }}>👤 {selEmp ? selEmp.name : ""}</p>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "0 0 11px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>🕐 출퇴근</p>
            {formData.clockIn && formData.clockOut && (function() {
              var ci = formData.clockIn.split(":");
              var co = formData.clockOut.split(":");
              var mins = (Number(co[0]) * 60 + Number(co[1])) - (Number(ci[0]) * 60 + Number(ci[1]));
              if (mins < 0) mins += 1440;
              var h = Math.floor(mins / 60);
              var m = mins % 60;
              return <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a", opacity: 0.7 }}>{h}시간 {m}분</span>;
            })()}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={LS}>출근</label>
              <input type="time" value={formData.clockIn} disabled={!editing}
                onChange={function(e) { up("clockIn", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={LS}>퇴근</label>
              <input type="time" value={formData.clockOut} disabled={!editing}
                onChange={function(e) { up("clockOut", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "0 0 11px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>📤 출고</p>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#18181b", opacity: 0.35 }}>{shipped}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumInput label="순살" value={formData.ship_sunsal} onChange={function(v) { up("ship_sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.ship_padak} onChange={function(v) { up("ship_padak", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, margin: "0 0 11px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>🧾 판매</p>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#e1360a", background: "#fff8f6", padding: "2px 9px", borderRadius: 7 }}>{sold}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <NumInput label="순살" value={formData.sunsal} onChange={function(v) { up("sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.padak} onChange={function(v) { up("padak", v); }} disabled={!editing} suffix="개" />
            <NumInput label="로스" value={formData.loss} onChange={function(v) { up("loss", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: "0 0 11px" }}>📊 잔여</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            <div>
              <label style={LS}>출고-판매-로스 (자동)</label>
              <div style={{ padding: "9px 13px", borderRadius: 9, background: "#f4f4f5", border: "1px solid #f0f0f3", fontSize: 20, fontWeight: 800, color: rem < 0 ? "#e1360a" : "#18181b" }}>{rem} 개</div>
            </div>
            <NumInput label="초벌" value={formData.chobeol} onChange={function(v) { up("chobeol", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 16, marginBottom: 16 })}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: "0 0 11px" }}>💰 매출</p>
          <div style={{ marginBottom: 16 }}>
            <label style={LS}>총 매출 (자동)</label>
            <div style={{ padding: "9px 13px", borderRadius: 9, background: "#fff8f6", border: "1px solid #f5c6c0", fontSize: 20, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(rev)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumInput label="계좌이체" value={formData.transfer} onChange={function(v) { up("transfer", v); }} disabled={!editing} suffix="원" />
            <NumInput label="현금" value={formData.cash} onChange={function(v) { up("cash", v); }} disabled={!editing} suffix="원" />
          </div>
        </div>
        {editing && <button onClick={save} style={Object.assign({}, BP, { marginBottom: 10 })}>수정 저장</button>}
        <button onClick={deleteReport} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 14, color: "#e1360a", borderColor: "#f5c6c0", marginTop: editing ? 0 : 8 })}>🗑 일보 삭제</button>
        <Toast msg={toast} isUnfolded={p.isUnfolded} />
      </div>
    );
  }


  if (selEmpId && selEmp) {
    return (
      <div style={PAGE}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <button onClick={goBackToCards} style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 13 })}>← 직원 목록</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{selEmp.name}</p>
            {(selEmp.status || "active") !== "active" && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: (selEmp.status || "active") === "resigned" ? "#fef2f2" : "#f4f4f5", color: (selEmp.status || "active") === "resigned" ? "#e1360a" : "#a1a1aa" }}>
                {(selEmp.status || "active") === "resigned" ? "퇴사" : "삭제됨"}
              </span>
            )}
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: "11px 16px", marginBottom: 12, background: "#fff8f6" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#71717a" }}>총 {list.length}건</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#e1360a" }}>{formatCurrency((empStats[selEmpId] || {}).totalRev || 0)}</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button onClick={function() { setArViewAll(!arViewAll); setShow(10); }} style={Object.assign({}, BO, { padding: "6px 14px", fontSize: 13 }, arViewAll ? { background: "#18181b", color: "#fff", borderColor: "#18181b" } : {})}>전체</button>
        </div>
        {!arViewAll && (
          <div style={Object.assign({}, CS, { padding: "12px 16px", marginBottom: 16 })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <button onClick={arPrevMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#71717a", padding: "4px 9px" }}>{"\u25C0"}</button>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#18181b" }}>{arViewYear}년 {arViewMonth}월</span>
              <button onClick={arNextMonth} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#71717a", padding: "4px 9px" }}>{"\u25B6"}</button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
              <span style={{ fontSize: 13, color: "#71717a" }}>{adminMonthSummary.count}건</span>
              <span style={{ fontSize: 13, color: "#71717a" }}>판매 {adminMonthSummary.sold}개</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a" }}>{formatCurrency(adminMonthSummary.rev)}</span>
            </div>
          </div>
        )}
        {adminFiltered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#a1a1aa", fontSize: 14 }}>{arViewAll ? "작성된 일보가 없습니다" : arViewYear + "년 " + arViewMonth + "월 일보가 없습니다"}</div>
        ) : adminFiltered.slice(0, show).map(function(item, i) {
          return (
            <div key={i} onClick={function() { openReport(item.date, item.rk); }} style={Object.assign({}, CS, { marginBottom: 10, padding: "16px 18px", cursor: "pointer" })}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{formatDate(item.date)}</p>
                  <p style={{ fontSize: 13, color: "#a1a1aa", margin: "4px 0 0" }}>출고 {(Number(item.ship_sunsal) || 0) + (Number(item.ship_padak) || 0)} · 판매 {item.sold} · 로스 {item.loss}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(item.rev)}</p>
                  <p style={{ fontSize: 12, color: "#a1a1aa", margin: "2px 0 0" }}>{(function() { var d = new Date(item.savedAt); return (d.getMonth()+1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); })()}</p>
                </div>
              </div>
            </div>
          );
        })}
        {show < adminFiltered.length && <button onClick={function() { setShow(function(c) { return c + 10; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 14, color: "#71717a" })}>더 보기</button>}
        <Toast msg={toast} isUnfolded={p.isUnfolded} />
      </div>
    );
  }

  // 직원 프로필 카드 화면
  var activeEmps = employees.filter(function(u) { return (u.status || "active") === "active"; });
  var inactiveEmps = employees.filter(function(u) { return (u.status || "active") !== "active"; });

  return (
    <div style={PAGE}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 18 }}>
        {activeEmps.map(function(emp) {
          var st = empStats[emp.id] || { count: 0, totalSold: 0, totalRev: 0 };
          return (
            <div key={emp.id} onClick={function() { setSelEmpId(emp.id); setShow(10); }}
              style={Object.assign({}, CS, { padding: "22px 16px", textAlign: "center", cursor: "pointer", marginBottom: 0 })}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: "#e1360a", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 9px" }}>
                <span style={{ fontSize: 22, color: "#fff", fontWeight: 800 }}>{emp.name.charAt(0)}</span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 2px", color: "#18181b" }}>{emp.name}</p>
              <p style={{ fontSize: 13, color: "#a1a1aa", margin: "0 0 9px" }}>일보 {st.count}건</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(st.totalRev)}</p>
            </div>
          );
        })}
      </div>
      {inactiveEmps.length > 0 && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#a1a1aa", margin: "9px 0 9px" }}>퇴사 · 삭제 직원</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            {inactiveEmps.map(function(emp) {
              var st = empStats[emp.id] || { count: 0, totalSold: 0, totalRev: 0 };
              var empStatus = emp.status || "active";
              return (
                <div key={emp.id} onClick={function() { setSelEmpId(emp.id); setShow(10); }}
                  style={Object.assign({}, CS, { padding: "22px 16px", textAlign: "center", cursor: "pointer", marginBottom: 0, opacity: 0.6, borderStyle: "dashed" })}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: "#a1a1aa", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 9px" }}>
                    <span style={{ fontSize: 22, color: "#fff", fontWeight: 800 }}>{emp.name.charAt(0)}</span>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 2px", color: "#18181b" }}>{emp.name}</p>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: empStatus === "resigned" ? "#fef2f2" : "#f4f4f5", color: empStatus === "resigned" ? "#e1360a" : "#a1a1aa" }}>
                    {empStatus === "resigned" ? "퇴사" : "삭제됨"}
                  </span>
                  <p style={{ fontSize: 13, color: "#a1a1aa", margin: "7px 0 0" }}>일보 {st.count}건</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Toast msg={toast} isUnfolded={p.isUnfolded} />
    </div>
  );
}


// ── SideNav (UNFOLDED 전용) ──────────────────────────────────────────────────
function SideNav(p) {
  var headerHeight = 61;
  return (
    <nav style={{
      position: "fixed", top: headerHeight, left: 0,
      width: 280, height: "calc(100vh - " + headerHeight + "px)",
      background: "#fff", borderRight: "1px solid #f0f0f3",
      display: "flex", flexDirection: "column",
      overflowY: "auto", zIndex: 50,
      paddingTop: 8, paddingBottom: 24, boxSizing: "border-box"
    }}>
      {p.tabs.map(function(t) {
        var isActive = p.active === t.id;
        return (
          <button key={t.id} onClick={function() { p.onSelect(t.id); }}
            style={{
              display: "flex", alignItems: "center", gap: 13,
              padding: "14px 22px", width: "100%",
              background: isActive ? "#fff8f6" : "none",
              border: "none",
              borderLeft: isActive ? "3px solid #e1360a" : "3px solid transparent",
              cursor: "pointer", fontSize: 15,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#e1360a" : "#18181b",
              textAlign: "left", boxSizing: "border-box"
            }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge > 0 && (
              <span style={{ marginLeft: "auto", background: "#ffc40e", color: "#18181b",
                fontSize: 11, fontWeight: 700, borderRadius: 99,
                minWidth: 20, height: 20, display: "flex", alignItems: "center",
                justifyContent: "center", padding: "0 5px" }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ── Viewport 감지 훅 (구버전 — 하위 호환) ──────────────────────────────────
function useViewport() {
  var init = typeof window !== "undefined" ? window.innerWidth : 540;
  var rs = useState(init), vw = rs[0], setVw = rs[1];
  useEffect(function() {
    function onResize() { setVw(window.innerWidth); }
    window.addEventListener("resize", onResize);
    return function() { window.removeEventListener("resize", onResize); };
  }, []);
  return vw;
}

function App() {
  var r1 = useState(null), user = r1[0], setUser = r1[1];
  var r2 = useState("vehicle"), tab = r2[0], setTab = r2[1];
  var r3 = useState(false), loaded = r3[0], setLoaded = r3[1];
  var r4 = useState(DEFAULT_USERS), users = r4[0], setUsers = r4[1];
  var r5 = useState(DEFAULT_SETTINGS), settings = r5[0], setSettings = r5[1];
  var r6 = useState({}), attendance = r6[0], setAttendance = r6[1];
  var r7 = useState({}), reports = r7[0], setReports = r7[1];
  var r8 = useState([]), inventoryItems = r8[0], setInventoryItems = r8[1];
  var r9 = useState({}), inventoryStock = r9[0], setInventoryStock = r9[1];
  var r10 = useState([]), requests = r10[0], setRequests = r10[1];
  var r13 = useState({}), gasData = r13[0], setGasData = r13[1];
  var r14 = useState({}), schedules = r14[0], setSchedules = r14[1];
  var r20 = useState([]), fixedCosts = r20[0], setFixedCosts = r20[1];
  var r21 = useState([]), varCosts = r21[0], setVarCosts = r21[1];
  var r22 = useState([]), production = r22[0], setProduction = r22[1];
  var r23 = useState({}), prodSettings = r23[0], setProdSettings = r23[1];
  var r24 = useState({}), officeStock = r24[0], setOfficeStock = r24[1];
  var r25 = useState([]), invLog = r25[0], setInvLog = r25[1];
  var r26 = useState(false), reportsLoaded = r26[0], setReportsLoaded = r26[1];
  var r_bp = useState(window.innerWidth >= 600 ? "unfolded" : "folded");
  var bp = r_bp[0], setBp = r_bp[1];

  useEffect(function() {
    function handleResize() { setBp(window.innerWidth >= 600 ? "unfolded" : "folded"); }
    window.addEventListener("resize", handleResize);
    return function() { window.removeEventListener("resize", handleResize); };
  }, []);

  useEffect(function() {
    Promise.all([
      store.get("ft-users", null), store.get("ft-settings", DEFAULT_SETTINGS),
      store.get("ft-attendance", {}), reportStore.getAll(),
      store.get("ft-inv-items", []), store.get("ft-inv-stock", {}), store.get("ft-inv-requests", []),
      store.get("ft-gas", {}), store.get("ft-schedules", {}),
      store.get("ft-fixed-costs", []), store.get("ft-variable-costs", []),
      store.get("ft-production", []), store.get("ft-prod-settings", {}),
      store.get("ft-inv-office", {}), store.get("ft-inv-log", []),
      store.get("ft-reports", {})
    ]).then(function(res) {
      if (res[0] && Array.isArray(res[0]) && res[0].length > 0) {
        var needsMigration = false;
        var migrated = res[0].map(function(u) {
          if (!u.status) { needsMigration = true; return Object.assign({}, u, { status: "active" }); }
          return u;
        });
        setUsers(migrated);
        if (needsMigration) store.set("ft-users", migrated);
      }
      setSettings(res[1]); setAttendance(res[2]);
      // reports: 새 테이블 우선, fallback으로 기존 ft-reports
      var reportRows = res[3];
      var legacyReports = res[15] || {};
      var loadedReports;
      try {
        if (reportRows && Array.isArray(reportRows) && reportRows.length > 0) {
          loadedReports = reportStore.toReportsObj(reportRows);
        } else {
          loadedReports = normalizeReportKeys(legacyReports);
        }
      } catch(e) {
        console.error('[App] reports 변환 오류:', e);
        loadedReports = normalizeReportKeys(legacyReports);
      }
      if (!loadedReports || typeof loadedReports !== "object") loadedReports = {};
      // 초기 로드 직전 in-flight 변경분이 있으면 (StrictMode 재마운트 등) 보존
      loadedReports = applyInflightOverlay(loadedReports);
      setReports(loadedReports);
      if (loadedReports && Object.keys(loadedReports).length > 0) setReportsLoaded(true);
      setInventoryItems(res[4]); setInventoryStock(res[5]); setRequests(res[6]);
      setGasData(res[7]); setSchedules(res[8]);
      setFixedCosts(res[9]); setVarCosts(normalizeDateField(res[10]));
      setProduction(normalizeDateField(res[11])); setProdSettings(res[12]);
      setOfficeStock(res[13]); setInvLog(normalizeDateField(res[14]));

      // 세션 복원
      try {
        var session = localStorage.getItem("ft-session");
        if (session) {
          var s = JSON.parse(session);
          var loadedUsers = res[0] && Array.isArray(res[0]) ? res[0] : DEFAULT_USERS;
          var savedUser = loadedUsers.find(function(u) { return u.id === s.userId && (u.status || "active") === "active"; });
          if (savedUser) { setUser(savedUser); setTab(s.tab || (savedUser.role === "admin" ? "admin-home" : "vehicle")); }
        }
      } catch(e) {}

      setLoaded(true);
    });
  }, []);

  // 탭 포커스 시 Supabase에서 최신 데이터 다시 로드
  useEffect(function() {
    function reload() {
      if (document.visibilityState !== "visible") return;
      Promise.all([
        store.get("ft-settings", DEFAULT_SETTINGS),
        reportStore.getAll(),
        store.get("ft-inv-items", []), store.get("ft-inv-stock", {}), store.get("ft-inv-requests", []),
        store.get("ft-gas", {}), store.get("ft-schedules", {}),
        store.get("ft-fixed-costs", []), store.get("ft-variable-costs", []),
        store.get("ft-production", []), store.get("ft-prod-settings", {}),
        store.get("ft-inv-office", {}), store.get("ft-inv-log", [])
      ]).then(function(res) {
        setSettings(res[0]);
        var reportRows = res[1];
        if (reportRows && reportRows.length > 0) {
          var reloadedReports = reportStore.toReportsObj(reportRows);
          // in-flight upsert/delete 보존 (visibility race 가드)
          // — 사용자가 방금 저장 중인 row가 DB에 아직 안 잡혔을 때 stale 결과로 덮어쓰기 방지
          reloadedReports = applyInflightOverlay(reloadedReports);
          setReports(reloadedReports);
          if (Object.keys(reloadedReports).length > 0) setReportsLoaded(true);
        }
        setInventoryItems(res[2]); setInventoryStock(res[3]); setRequests(res[4]);
        setGasData(res[5]); setSchedules(res[6]);
        setFixedCosts(res[7]); setVarCosts(normalizeDateField(res[8]));
        setProduction(normalizeDateField(res[9])); setProdSettings(res[10]);
        setOfficeStock(res[11]); setInvLog(normalizeDateField(res[12]));
      });
    }
    document.addEventListener("visibilitychange", reload);
    return function() { document.removeEventListener("visibilitychange", reload); };
  }, []);

  // ── 관리자(admin) 한정 Realtime 일보 구독 ──────────────────────────────
  // 직원이 작성/수정/삭제한 reports 변경분을 1초 내 admin 화면에 반영.
  // staff 화면에는 미구독 (다른 직원 일보 노출 방지 + 트래픽 절감).
  // 머지는 idempotent — 자기 자신이 발행한 변경이 다시 와도 결과 동일.
  // publication 미적용 상태면 SUBSCRIBED는 떠도 이벤트 미수신 (코드는 안전).
  useEffect(function() {
    if (!user || user.role !== "admin") return;

    function mergeRow(row) {
      if (!row || !row.id || !row.date) return;
      // toReportsObj가 row 1건도 정상 변환 (객체 형태로 normalize)
      var converted;
      try {
        var o = reportStore.toReportsObj([row]);
        converted = o[row.date] && o[row.date][row.id];
      } catch(e) { console.error('[realtime] mergeRow 변환 오류:', e); return; }
      if (!converted) return;
      setReports(function(prev) {
        var next = Object.assign({}, prev || {});
        // 다른 날짜에 같은 id가 있으면 (날짜 변경 수정) 제거 후 새 위치에 삽입
        Object.keys(next).forEach(function(d) {
          if (d !== row.date && next[d] && next[d][row.id]) {
            next[d] = Object.assign({}, next[d]);
            delete next[d][row.id];
            if (Object.keys(next[d]).length === 0) delete next[d];
          }
        });
        var dateMap = next[row.date] ? Object.assign({}, next[row.date]) : {};
        dateMap[row.id] = converted;
        next[row.date] = dateMap;
        return next;
      });
    }

    function removeRow(old) {
      if (!old || !old.id) return;
      setReports(function(prev) {
        if (!prev) return prev;
        var next = Object.assign({}, prev);
        // REPLICA IDENTITY FULL 적용 시 old.date 있음 → 빠른 경로
        if (old.date && next[old.date] && next[old.date][old.id]) {
          next[old.date] = Object.assign({}, next[old.date]);
          delete next[old.date][old.id];
          if (Object.keys(next[old.date]).length === 0) delete next[old.date];
          return next;
        }
        // 미적용 시 (PK만 옴) → 전 날짜 순회
        var found = false;
        Object.keys(next).forEach(function(d) {
          if (next[d] && next[d][old.id]) {
            next[d] = Object.assign({}, next[d]);
            delete next[d][old.id];
            if (Object.keys(next[d]).length === 0) delete next[d];
            found = true;
          }
        });
        return found ? next : prev;
      });
    }

    var unsubscribe = subscribeReports({
      onInsert: mergeRow,
      onUpdate: mergeRow,
      onDelete: removeRow,
      onStatus: function(status) {
        // status: SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED
        // 진단 노이즈 줄이기 위해 console.log는 supabase.js 내부에서만 1회
      },
    });
    return unsubscribe;
  }, [user && user.role]);

  // 응급 큐 flush — 부팅 시 1회 + online 이벤트마다 (reports + app_data 둘 다)
  // 데이터 영구 손실 방지 안전망. 큐 비워지면 "오프라인 저장 N건 동기화 완료" 토스트.
  var r_pendingToast = useState(""), pendingToast = r_pendingToast[0], setPendingToast = r_pendingToast[1];
  // 영구 배지: reports 큐 + app_data 큐 합산 (사용자/관리자 모두 인지)
  var r_pendingReports = useState(0), pendingReports = r_pendingReports[0], setPendingReports = r_pendingReports[1];
  var r_pendingAppData = useState(0), pendingAppData = r_pendingAppData[0], setPendingAppData = r_pendingAppData[1];
  var pendingCount = pendingReports + pendingAppData;

  // 큐 변동 이벤트 구독 → 배지 갱신 (reports 큐 + app_data 큐 별도 추적)
  useEffect(function() {
    function syncCounts() {
      try { setPendingReports(getPendingReportsCount()); } catch(_) {}
      try { setPendingAppData(getPendingAppDataCount()); } catch(_) {}
    }
    syncCounts();
    function onReports(e) {
      var c = (e && e.detail && typeof e.detail.count === "number") ? e.detail.count : getPendingReportsCount();
      setPendingReports(c);
    }
    function onAppData(e) {
      var c = (e && e.detail && typeof e.detail.count === "number") ? e.detail.count : getPendingAppDataCount();
      setPendingAppData(c);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("pending-reports-changed", onReports);
      window.addEventListener("pending-app-data-changed", onAppData);
    }
    return function() {
      if (typeof window !== "undefined") {
        window.removeEventListener("pending-reports-changed", onReports);
        window.removeEventListener("pending-app-data-changed", onAppData);
      }
    };
  }, []);

  useEffect(function() {
    function tryFlush(reason) {
      var beforeReports = getPendingReportsCount();
      var beforeAppData = getPendingAppDataCount();
      if (beforeReports === 0 && beforeAppData === 0) return;

      // reports 큐 + app_data 큐 병렬 flush
      Promise.all([
        beforeReports > 0 ? flushPendingReports() : Promise.resolve({ tried: 0, succeeded: 0, remaining: 0 }),
        beforeAppData > 0 ? flushPendingAppData() : Promise.resolve({ tried: 0, succeeded: 0, remaining: 0 }),
      ]).then(function(results) {
        var rep = results[0] || { succeeded: 0, remaining: 0 };
        var ad = results[1] || { succeeded: 0, remaining: 0 };
        var totalSucc = rep.succeeded + ad.succeeded;
        var totalRem = rep.remaining + ad.remaining;
        if (totalSucc > 0) {
          console.log('[pendingFlush] (' + reason + ') reports:', rep.succeeded, '/ app_data:', ad.succeeded, '/ 남은:', totalRem);
          var parts = [];
          if (rep.succeeded > 0) parts.push("일보 " + rep.succeeded + "건");
          if (ad.succeeded > 0) parts.push("설정/데이터 " + ad.succeeded + "건");
          setPendingToast("오프라인 저장 " + parts.join(", ") + " 동기화 완료" + (totalRem > 0 ? " (" + totalRem + "건 남음)" : ""));
          setTimeout(function() { setPendingToast(""); }, 4000);
          // reports 성공분 화면 반영
          if (rep.succeeded > 0) {
            reportStore.getAll().then(function(rows) {
              if (rows && rows.length > 0) {
                var obj = reportStore.toReportsObj(rows);
                obj = applyInflightOverlay(obj);
                setReports(obj);
              }
            });
          }
        } else if (rep.tried + ad.tried > 0) {
          console.warn('[pendingFlush] (' + reason + ') 0건 성공, 모두 보류 (reports:', rep.remaining, '/ app_data:', ad.remaining, ')');
        }
      });
    }
    // 부팅 직후 1회
    var bootTimer = setTimeout(function() { tryFlush("boot"); }, 1500);
    function onOnline() { tryFlush("online"); }
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
    return function() {
      clearTimeout(bootTimer);
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
    };
  }, []);

  function login(pin) {
    var emp = users.find(function(e) { return e.pin === pin && (e.status || "active") === "active"; });
    if (emp) {
      setUser(emp);
      setTab(emp.role === "admin" ? "admin-home" : "vehicle");
      try { localStorage.setItem("ft-session", JSON.stringify({ userId: emp.id, tab: emp.role === "admin" ? "admin-home" : "vehicle" })); } catch(e) {}
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
    setTab("vehicle");
    try { localStorage.removeItem("ft-session"); } catch(e) {}
  }

  var isUnfolded = bp === "unfolded";

  if (!loaded) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}><p style={{ color: "#a1a1aa" }}>로딩 중...</p></div>;
  if (!user) return <LoginScreen onLogin={login} isUnfolded={isUnfolded} />;

  var isAdmin = user.role === "admin";
  var eTabs = [{ id: "vehicle", label: "내차량", icon: "🚛" }, { id: "inventory", label: "재고", icon: "📦" }, { id: "report", label: "일보", icon: "📋" }, { id: "salary", label: "급여", icon: "💵" }, { id: "revenue", label: "매출", icon: "💰" }];
  var aTabs = [{ id: "admin-home", label: "홈", icon: "🏠" }, { id: "admin-report", label: "일보", icon: "📋" }, { id: "admin-finance", label: "재무", icon: "💰" }, { id: "admin-chicken", label: "꼬치", icon: "🍗" }, { id: "admin-inv", label: "재고", icon: "📦" }, { id: "admin-emp", label: "직원", icon: "👥" }];
  var tabs = isAdmin ? aTabs : eTabs;
  var titles = { vehicle: "내 차량", report: "판매일보", salary: "급여", inventory: "재고", revenue: "매출", "admin-home": "홈", "admin-report": "직원 일보", "admin-finance": "재무", "admin-chicken": "꼬치 관리", "admin-inv": "재고 관리", "admin-emp": "직원 관리" };

  // 공통 페이지 컨텐츠
  var pageContent = (
    <ErrorBoundary>
      {!isAdmin && tab === "vehicle" && <EmpVehicle user={user} reports={reports} settings={settings} gasData={gasData} setGasData={setGasData} schedules={schedules} setSchedules={setSchedules} />}
      {!isAdmin && tab === "report" && <EmpReport user={user} reports={reports} setReports={setReports} settings={settings} isUnfolded={isUnfolded} />}
      {!isAdmin && tab === "salary" && <EmpSalary user={user} reports={reports} settings={settings} />}
      {!isAdmin && tab === "inventory" && <EmpInventory user={user} inventoryItems={inventoryItems} inventoryStock={inventoryStock} setInventoryStock={setInventoryStock} requests={requests} setRequests={setRequests} isUnfolded={isUnfolded} />}
      {!isAdmin && tab === "revenue" && <EmpRevenue user={user} reports={reports} settings={settings} />}
      {isAdmin && tab === "admin-home" && <AdminHome reports={reports} setReports={setReports} users={users} settings={settings} production={production} gasData={gasData} schedules={schedules} fixedCosts={fixedCosts} varCosts={varCosts} prodSettings={prodSettings} inventoryItems={inventoryItems} inventoryStock={inventoryStock} requests={requests} officeStock={officeStock} invLog={invLog} />}
      {isAdmin && tab === "admin-report" && <AdminReport reports={reports} setReports={setReports} users={users} settings={settings} isUnfolded={isUnfolded} />}
      {isAdmin && tab === "admin-finance" && <AdminFinance reports={reports} settings={settings} production={production} fixedCosts={fixedCosts} setFixedCosts={setFixedCosts} varCosts={varCosts} setVarCosts={setVarCosts} prodSettings={prodSettings} users={users} invLog={invLog} />}
      {isAdmin && tab === "admin-chicken" && <AdminChicken production={production} setProduction={setProduction} prodSettings={prodSettings} setProdSettings={setProdSettings} reports={reports} isUnfolded={isUnfolded} />}
      {isAdmin && tab === "admin-inv" && <AdminInventory inventoryItems={inventoryItems} setInventoryItems={setInventoryItems} inventoryStock={inventoryStock} setInventoryStock={setInventoryStock} requests={requests} setRequests={setRequests} users={users} officeStock={officeStock} setOfficeStock={setOfficeStock} invLog={invLog} setInvLog={setInvLog} varCosts={varCosts} setVarCosts={setVarCosts} isUnfolded={isUnfolded} />}
      {isAdmin && tab === "admin-emp" && <AdminEmployee users={users} setUsers={setUsers} settings={settings} setSettings={setSettings} schedules={schedules} setSchedules={setSchedules} reports={reports} setReports={setReports} isUnfolded={isUnfolded} />}
    </ErrorBoundary>
  );

  // ── 레이아웃 렌더 ──────────────────────────────────────────────────────────
  return (
    <div style={isUnfolded
      ? { minHeight: "100vh", background: "#fafafa", display: "flex", flexDirection: "column" }
      : { minHeight: "100vh", background: "#fafafa", maxWidth: 540, margin: "0 auto" }
    }>
      <Header title={titles[tab]} userName={user.name} onLogout={logout} />
      {/* 응급 큐 영구 배지 — reports 큐 + app_data 큐 합산 */}
      {pendingCount > 0 && (
        <div
          title={"일보 " + pendingReports + "건, 설정/데이터 " + pendingAppData + "건 — 네트워크 복귀 시 자동 전송"}
          style={{
            position: "sticky", top: 61, zIndex: 90,
            marginLeft: isUnfolded ? 280 : 0,
            background: "#fef3c7", color: "#92400e",
            padding: "8px 16px", fontSize: 13, fontWeight: 600,
            textAlign: "center",
            borderBottom: "1px solid #fde68a",
          }}>
          ⏳ 오프라인 저장 {pendingCount}건 대기 중
          {(pendingReports > 0 && pendingAppData > 0)
            ? <span style={{ fontWeight: 400, marginLeft: 6 }}>(일보 {pendingReports} / 데이터 {pendingAppData})</span>
            : null}
          {" — 네트워크 복귀 시 자동 전송"}
        </div>
      )}
      {isUnfolded && <SideNav tabs={tabs} active={tab} onSelect={setTab} />}
      <div style={isUnfolded ? { marginLeft: 280, minHeight: "calc(100vh - 61px)", overflowY: "auto" } : {}}>
        {pageContent}
      </div>
      {!isUnfolded && <BottomNav tabs={tabs} active={tab} onSelect={setTab} />}
      {/* 응급 큐 flush 결과 토스트 (앱 전역) */}
      <Toast msg={pendingToast} isUnfolded={isUnfolded} />
    </div>
  );
}

export default App;
