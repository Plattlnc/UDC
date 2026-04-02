import React, { useState, useEffect, useMemo } from "react";
import { store } from "./supabase.js";

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
function formatDate(s) {
  var d = new Date(s + "T00:00:00");
  return (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + ["일","월","화","수","목","금","토"][d.getDay()] + ")";
}
function formatTime(iso) {
  if (!iso) return "--:--";
  var d = new Date(iso);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function formatCurrency(n) {
  return n === 0 ? "0원" : n.toLocaleString("ko-KR") + "원";
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
    <div style={Object.assign({}, CS, { padding: 14, marginBottom: 12 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={prevM} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#71717a", padding: "4px 8px" }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>{year}년 {month}월</span>
        <button onClick={nextM} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#71717a", padding: "4px 8px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, textAlign: "center" }}>
        {dayNames.map(function(dn) {
          return <div key={dn} style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", padding: 4 }}>{dn}</div>;
        })}
        {cells.map(function(d, idx) {
          if (d === null) return <div key={"e" + idx} />;
          var isSel = selMonth && d === selDay;
          return (
            <button key={idx} onClick={function() { pick(d); }}
              style={{ border: isSel ? "2px solid #e1360a" : "1px solid transparent", borderRadius: 10, background: isSel ? "#fff8f6" : "transparent", color: isSel ? "#e1360a" : "#18181b", fontSize: 13, fontWeight: isSel ? 700 : 500, cursor: "pointer", padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}


var CS = {
  background: "#fff", borderRadius: 12, padding: 16,
  border: "1px solid #e4e4e7", marginBottom: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
};
var LS = { fontSize: 12, fontWeight: 500, color: "#71717a", marginBottom: 4, display: "block" };
var BP = { width: "100%", padding: 12, borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "#e1360a", color: "#fff" };
var BO = { padding: "8px 16px", borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "#fff", color: "#18181b" };
var IS = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 14, fontWeight: 500, color: "#18181b", outline: "none", background: "#fafafa", boxSizing: "border-box" };
var PAGE = { padding: "16px 16px 90px", maxWidth: 480, margin: "0 auto" };

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
        {p.suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#a1a1aa", fontWeight: 500 }}>{p.suffix}</span>}
      </div>
    </div>
  );
}

function Toast(p) {
  if (!p.msg) return null;
  return (
    <div style={{ position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", background: "#e1360a", color: "#fff", padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 200 }}>
      {p.msg}
    </div>
  );
}

function Header(p) {
  return (
    <div style={{ padding: "14px 16px", background: "#fff", borderBottom: "1px solid #e4e4e7", position: "sticky", top: 0, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#18181b" }}>{p.title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a", background: "#f4f4f5", padding: "4px 10px", borderRadius: 6 }}>{p.userName}</span>
        <button onClick={p.onLogout} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 11, color: "#71717a" })}>로그아웃</button>
      </div>
    </div>
  );
}

function BottomNav(p) {
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e4e4e7", display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom,10px)", zIndex: 100 }}>
      {p.tabs.map(function(t) {
        return (
          <button key={t.id} onClick={function() { p.onSelect(t.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 16px", position: "relative" }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: p.active === t.id ? 800 : 500, color: p.active === t.id ? "#e1360a" : "#a1a1aa" }}>{t.label}</span>
            {p.active === t.id && <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 20, height: 2, borderRadius: 1, background: "#e1360a" }} />}
            {t.badge > 0 && <div style={{ position: "absolute", top: 0, right: 6, background: "#ffc40e", color: "#18181b", fontSize: 10, fontWeight: 700, borderRadius: 99, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{t.badge}</div>}
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
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", padding: 20 }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, background: "#e1360a", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 36, color: "#fff", fontWeight: 900 }}>U</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#e1360a", margin: "12px 0 4px" }}>UDC 대시보드</h1>
      <p style={{ color: "#a1a1aa", fontSize: 13, margin: "0 0 28px" }}>PIN 6자리를 입력하세요</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        {[0, 1, 2, 3, 4, 5].map(function(i) {
          return <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid " + (err ? "#e1360a" : pin.length > i ? "#e1360a" : "#d4d4d8"), background: pin.length > i ? "#e1360a" : "transparent", transition: "all 0.15s" }} />;
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,68px)", gap: 10 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"].map(function(n, i) {
          return (
            <button key={i} onClick={function() { if (n === "⌫") setPin(function(q) { return q.slice(0, -1); }); else if (n !== null) tap(String(n)); }}
              style={{ width: 68, height: 68, borderRadius: 16, border: "1px solid #e4e4e7", background: n === null ? "transparent" : "#fafafa", color: "#18181b", fontSize: n === "⌫" ? 20 : 24, fontWeight: 600, cursor: n === null ? "default" : "pointer", visibility: n === null ? "hidden" : "visible", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {n}
            </button>
          );
        })}
      </div>
      {err && <p style={{ color: "#e1360a", fontSize: 13, marginTop: 16, fontWeight: 600 }}>PIN이 올바르지 않습니다</p>}
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
      <p style={{ fontSize: 14, fontWeight: 600, color: "#71717a", margin: "0 0 12px", textAlign: "center" }}>{formatDate(today)}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>🍗 월간 판매</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{stats.mSold}<span style={{ fontSize: 13, fontWeight: 500, color: "#a1a1aa" }}> 개</span></p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>🍗 주간 판매</p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{stats.wSold}<span style={{ fontSize: 13, fontWeight: 500, color: "#a1a1aa" }}> 개</span></p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 월간매출</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.mRev)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 주간매출</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.wRev)}</p>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: "16px 0" })}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", padding: "0 16px" }}>📋 근무 현황</p>
        {hist.length === 0 ? <p style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 13 }}>근무 이력이 없습니다</p> : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "8px 16px", borderBottom: "1px solid #f4f4f5", fontSize: 11, fontWeight: 600, color: "#a1a1aa" }}>
              <span>날짜</span><span style={{ textAlign: "center" }}>출/퇴근</span><span style={{ textAlign: "right" }}>근무시간</span>
            </div>
            {hist.slice(0, show).map(function(r, i) {
              var wt = calcMins(r.clockIn, r.clockOut);
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 16px", borderBottom: "1px solid #f4f4f5", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{formatDate(r.date)}</span>
                  <span style={{ textAlign: "center", color: "#71717a", fontSize: 12 }}>{r.clockIn} ~ {r.clockOut || "--:--"}</span>
                  <span style={{ textAlign: "right", fontWeight: 600, color: wt ? "#18181b" : "#a1a1aa" }}>{wt || "-"}</span>
                </div>
              );
            })}
            {show < hist.length && <button onClick={function() { setShow(function(c) { return c + 10; }); }} style={Object.assign({}, BO, { width: "calc(100% - 32px)", margin: "12px 16px 0", textAlign: "center", fontSize: 12, color: "#71717a" })}>더 보기</button>}
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
      <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#18181b" }}>{isSub ? "서브" : "메인"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: needReplace ? "#e1360a" : "#71717a", marginLeft: 8 }}>{pct}%</span>
            {needReplace && <span style={{ fontSize: 10, fontWeight: 700, color: "#e1360a", marginLeft: 6 }}>교체필요</span>}
            {isSub && <span style={{ fontSize: 10, color: "#a1a1aa", marginLeft: 6 }}>수동</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {isSub && (
              <button onClick={useSub} disabled={subUsedCount >= 5}
                style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 11, color: subUsedCount < 5 ? "#e1360a" : "#d4d4d8", borderColor: subUsedCount < 5 ? "#f5c6c0" : "#e4e4e7" })}>
                사용 −1
              </button>
            )}
            <button onClick={isSub ? replaceSub : replaceMain}
              style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 11, color: "#16a34a", borderColor: "#bbf7d0", background: "#f0fdf4" })}>
              교체완료
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {[0, 1, 2, 3, 4].map(function(i) {
            var filled = i < blocks;
            return (
              <div key={i} style={{ flex: 1, height: 28, borderRadius: 6, background: filled ? (needReplace ? "#fca5a5" : "#e1360a") : "#f4f4f5", transition: "all 0.3s" }} />
            );
          })}
        </div>
        <p style={{ fontSize: 10, color: "#18181b", opacity: 0.35, margin: "4px 0 0", fontWeight: 500 }}>
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
      <div style={Object.assign({}, CS, { textAlign: "center", padding: "20px 16px" })}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#71717a", margin: "0 0 4px" }}>배정 차량</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: vehicleName === "없음" ? "#a1a1aa" : "#18181b", margin: 0 }}>{vehicleName}</p>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#18181b", margin: "4px 0 10px" }}>🔥 야끼바 가스</p>
      {renderGauge(mainBlocks, mainPct, mainDate, "main")}
      {renderGauge(subBlocks, subPct, subDate, "sub")}
      <div style={Object.assign({}, CS, { padding: 14 })}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#18181b", margin: "0 0 12px" }}>📍 주간 출근지</p>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "44px repeat(6, 80px)", gap: 6, minWidth: 530 }}>
            <div />
            {dayLabels.map(function(label) {
              return <div key={label} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#71717a", padding: "4px 0" }}>{label}</div>;
            })}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#e1360a", display: "flex", alignItems: "center" }}>메인</div>
            {dayKeys.map(function(dk) {
              return (
                <input key={"m_" + dk} value={mySch[dk + "_main"] || ""} placeholder="-"
                  onChange={function(e) { updateSchedule(dk + "_main", e.target.value); }}
                  style={{ width: "100%", padding: "8px 6px", borderRadius: 6, border: "1px solid #e4e4e7", fontSize: 12, fontWeight: 600, textAlign: "center", outline: "none", background: "#fafafa", color: "#18181b", boxSizing: "border-box" }} />
              );
            })}
            <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", display: "flex", alignItems: "center" }}>서브</div>
            {dayKeys.map(function(dk) {
              return (
                <input key={"s_" + dk} value={mySch[dk + "_sub"] || ""} placeholder="-"
                  onChange={function(e) { updateSchedule(dk + "_sub", e.target.value); }}
                  style={{ width: "100%", padding: "8px 6px", borderRadius: 6, border: "1px solid #e4e4e7", fontSize: 12, fontWeight: 600, textAlign: "center", outline: "none", background: "#fafafa", color: "#18181b", boxSizing: "border-box" }} />
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

  function save() {
    var u = JSON.parse(JSON.stringify(reports));
    var saveDate = isNew ? newDate : selDate;
    if (!u[saveDate]) u[saveDate] = {};
    var key;
    if (isNew) {
      key = user.id + "_" + Date.now();
    } else {
      key = selKey;
    }
    u[saveDate][key] = Object.assign({}, formData, { savedAt: new Date().toISOString(), employeeName: user.name, userId: user.id });
    p.setReports(u);
    store.set("ft-reports", u);
    setEditing(false);
    setIsNew(false);
    setShowCal(false);
    setSelDate(saveDate);
    setSelKey(key);
    setToast("저장 완료!");
    setTimeout(function() { setToast(""); }, 2000);
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

  if (selKey !== null) {
    var isSaved = !isNew && selDate && reports[selDate] && reports[selDate][selKey] && reports[selDate][selKey].savedAt;
    return (
      <div style={PAGE}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={goBack} style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 12 })}>← 목록</button>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>📅 {formatDate(displayDate)}</p>
          {isSaved && !editing ? <button onClick={function() { setEditing(true); }} style={Object.assign({}, BO, { padding: "4px 14px", fontSize: 12 })}>수정</button> : <div style={{ width: 48 }} />}
        </div>
        {isNew && showCal && <DatePicker value={newDate} onChange={function(d) { setNewDate(d); }} />}
        {isNew && showCal && (
          <button onClick={function() { setShowCal(false); }}
            style={Object.assign({}, BO, { width: "100%", marginBottom: 12, textAlign: "center", fontSize: 12, color: "#e1360a", borderColor: "#f5c6c0" })}>
            날짜 확정: {formatDate(newDate)}
          </button>
        )}
        {isNew && !showCal && (
          <button onClick={function() { setShowCal(true); }}
            style={Object.assign({}, BO, { width: "100%", marginBottom: 12, textAlign: "center", fontSize: 12 })}>
            📅 날짜 변경: {formatDate(newDate)}
          </button>
        )}
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "0 0 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: 0 }}>🕐 출퇴근</p>
            {formData.clockIn && formData.clockOut && (function() {
              var ci = formData.clockIn.split(":");
              var co = formData.clockOut.split(":");
              var mins = (Number(co[0]) * 60 + Number(co[1])) - (Number(ci[0]) * 60 + Number(ci[1]));
              if (mins < 0) mins += 1440;
              var h = Math.floor(mins / 60);
              var m = mins % 60;
              return <span style={{ fontSize: 12, fontWeight: 700, color: "#e1360a", opacity: 0.7 }}>{h}시간 {m}분</span>;
            })()}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 1 140px" }}>
              <label style={LS}>출근</label>
              <input type="time" value={formData.clockIn} disabled={!editing}
                onChange={function(e) { up("clockIn", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
            <div style={{ flex: "0 1 140px" }}>
              <label style={LS}>퇴근</label>
              <input type="time" value={formData.clockOut} disabled={!editing}
                onChange={function(e) { up("clockOut", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "0 0 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: 0 }}>📤 출고</p>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#18181b", opacity: 0.35 }}>{shipped}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <NumInput label="순살" value={formData.ship_sunsal} onChange={function(v) { up("ship_sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.ship_padak} onChange={function(v) { up("ship_padak", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "0 0 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: 0 }}>🧾 판매</p>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e1360a", background: "#fff8f6", padding: "2px 8px", borderRadius: 6 }}>{sold}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <NumInput label="순살" value={formData.sunsal} onChange={function(v) { up("sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.padak} onChange={function(v) { up("padak", v); }} disabled={!editing} suffix="개" />
            <NumInput label="로스" value={formData.loss} onChange={function(v) { up("loss", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: "0 0 10px" }}>📊 잔여</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LS}>출고-판매-로스 (자동)</label>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f4f4f5", border: "1px solid #e4e4e7", fontSize: 16, fontWeight: 800, color: rem < 0 ? "#e1360a" : "#18181b" }}>{rem} 개</div>
            </div>
            <NumInput label="초벌" value={formData.chobeol} onChange={function(v) { up("chobeol", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: "0 0 10px" }}>💰 매출</p>
          <div style={{ marginBottom: 10 }}>
            <label style={LS}>총 매출 (자동)</label>
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fff8f6", border: "1px solid #f5c6c0", fontSize: 16, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(rev)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <NumInput label="계좌이체" value={formData.transfer} onChange={function(v) { up("transfer", v); }} disabled={!editing} suffix="원" />
            <NumInput label="현금" value={formData.cash} onChange={function(v) { up("cash", v); }} disabled={!editing} suffix="원" />
          </div>
        </div>
        {editing && <button onClick={save} style={BP}>{isNew ? "기록 저장" : "수정 저장"}</button>}
        <Toast msg={toast} />
      </div>
    );
  }

  return (
    <div style={PAGE}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button onClick={function() { setSortBy("date"); setShow(10); }} style={Object.assign({}, BO, { padding: "6px 14px", fontSize: 12 }, sortBy === "date" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>날짜순</button>
        <button onClick={function() { setSortBy("revenue"); setShow(10); }} style={Object.assign({}, BO, { padding: "6px 14px", fontSize: 12 }, sortBy === "revenue" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>매출순</button>
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#a1a1aa", fontSize: 13 }}>작성된 일보가 없습니다</div>
      ) : list.slice(0, show).map(function(item, i) {
        return (
          <div key={i} onClick={function() { openReport(item.date, item.rk); }} style={Object.assign({}, CS, { marginBottom: 8, padding: "14px 16px", cursor: "pointer" })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{formatDate(item.date)}</p>
                <p style={{ fontSize: 11, color: "#a1a1aa", margin: "4px 0 0" }}>출고 {(Number(item.ship_sunsal) || 0) + (Number(item.ship_padak) || 0)} · 판매 {item.sold} · 로스 {item.loss}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(item.rev)}</p>
                <p style={{ fontSize: 10, color: "#a1a1aa", margin: "2px 0 0" }}>{(function() { var d = new Date(item.savedAt); return (d.getMonth()+1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); })()}</p>
              </div>
            </div>
          </div>
        );
      })}
      {show < list.length && <button onClick={function() { setShow(function(c) { return c + 10; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 12, color: "#71717a" })}>더 보기</button>}
      <button onClick={openNew} style={{ position: "fixed", bottom: 80, right: 20, width: 52, height: 52, borderRadius: 26, background: "#e1360a", color: "#fff", border: "none", fontSize: 24, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(225,54,10,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>+</button>
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

  function submit() {
    if (!ri || !rq) return;
    var item = items.find(function(i) { return i.id === ri; });
    var nr = { id: Date.now(), itemId: ri, itemName: item ? item.name : "", qty: Number(rq), employeeId: user.id, employeeName: user.name, createdAt: new Date().toISOString(), status: "pending" };
    p.setRequests(requests.concat([nr]));
    store.set("ft-inv-requests", requests.concat([nr]));
    setRi(null); setRq("");
    setToast("요청 완료!");
    setTimeout(function() { setToast(""); }, 2000);
  }

  return (
    <div style={PAGE}>
      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>📦 내 재고 현황</p>
      <p style={{ fontSize: 11, color: "#a1a1aa", margin: "0 0 14px" }}>사용 후 (−) 버튼으로 차감하세요</p>
      {items.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 13 }}>등록된 품목이 없습니다</div> :
        items.map(function(item) {
          var qty = my[item.id] || 0;
          var used = my[item.id + "_used"] || 0;
          var total = qty + used;
          var low = qty <= 2;
          return (
            <div key={item.id} style={Object.assign({}, CS, { marginBottom: 10, padding: "16px 16px" }, low ? { border: "1px solid #f5c6c0", background: "#fef2f2" } : {})}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#18181b" }}>{item.name}</p>
                  {low && <span style={{ fontSize: 10, color: "#e1360a", fontWeight: 600 }}>재고 부족</span>}
                </div>
                <span style={{ fontSize: 22, fontWeight: 800, color: low ? "#e1360a" : "#18181b" }}>{qty}<span style={{ fontSize: 12, fontWeight: 500, color: "#a1a1aa" }}> 개</span></span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f9fafb", borderRadius: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>누적 사용</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#e1360a" }}>{used}개 <span style={{ fontSize: 10, fontWeight: 500, color: "#a1a1aa" }}>/ 총 {total}개</span></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={function() { use(item.id); }} disabled={qty <= 0}
                  style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid " + (qty > 0 ? "#e1360a" : "#e4e4e7"), background: qty > 0 ? "#fff8f6" : "#f4f4f5", fontSize: 20, cursor: qty > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: qty > 0 ? "#e1360a" : "#d4d4d8", fontWeight: 700 }}>−</button>
                <div style={{ flex: 1 }} />
                <button onClick={function() { setRi(item.id); setRq(""); }} style={Object.assign({}, BO, { padding: "8px 16px", fontSize: 12, color: "#e1360a", borderColor: "#f5c6c0", background: "#fff8f6" })}>보충요청</button>
              </div>
            </div>
          );
        })
      }
      {ri && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 340 }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 16px" }}>📋 보충 요청</p>
            <NumInput label="요청 수량" value={rq} onChange={setRq} placeholder="수량" />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={function() { setRi(null); }} style={Object.assign({}, BO, { flex: 1 })}>취소</button>
              <button onClick={submit} style={Object.assign({}, BP, { flex: 1 })}>요청하기</button>
            </div>
          </div>
        </div>
      )}
      <Toast msg={toast} />
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
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>누적 총 매출</p>
        <p style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>{formatCurrency(tot.rev)}</p>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>이체 <span style={{ color: "#ffc40e", fontWeight: 700 }}>{formatCurrency(tot.transfer)}</span></span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>현금 <span style={{ color: "#86efac", fontWeight: 700 }}>{formatCurrency(tot.cash)}</span></span>
        </div>
      </div>
      <div style={Object.assign({}, CS, { background: "#fafafa" })}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#71717a", margin: "0 0 4px" }}>이번 달 매출</p>
        <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>{formatCurrency(thisMonth.rev)}</p>
        <div style={{ display: "flex", gap: 16 }}>
          <span style={{ fontSize: 11, color: "#a1a1aa" }}>이체 {formatCurrency(thisMonth.transfer)}</span>
          <span style={{ fontSize: 11, color: "#a1a1aa" }}>현금 {formatCurrency(thisMonth.cash)}</span>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #e4e4e7", marginTop: 4, paddingTop: 12 }}>
        {hist.length === 0 ? <div style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 13 }}>매출 기록이 없습니다</div> :
          flatItems.slice(0, show).map(function(item, i) {
            if (item.type === "header") {
              return <p key={"h" + i} style={{ fontSize: 13, fontWeight: 700, color: "#e1360a", margin: "16px 0 8px", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>{item.month}</p>;
            }
            var r = item.data;
            return (
              <div key={"r" + i} style={Object.assign({}, CS, { marginBottom: 6, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" })}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{formatDate(r.date)}</p>
                  <p style={{ fontSize: 11, color: "#a1a1aa", margin: "2px 0 0" }}>판매 {r.sold}개 · 이체 {formatCurrency(r.transfer)} · 현금 {formatCurrency(r.cash)}</p>
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(r.rev)}</p>
              </div>
            );
          })
        }
        {show < flatItems.length && <button onClick={function() { setShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 12, color: "#71717a", marginTop: 8 })}>더 보기</button>}
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
        <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 4px" }}>누적 급여</p>
        <p style={{ fontSize: 28, fontWeight: 800, color: "#fff", margin: 0 }}>{formatCurrency(totals.all)}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 월간 급여</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#e1360a", margin: "0 0 8px" }}>{formatCurrency(totals.month)}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600 }}>지급 {formatCurrency(totals.mPaid)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600 }}>미지급 {formatCurrency(totals.mUnpaid)}</span>
          </div>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 4px" })}>💰 주간 급여</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#e1360a", margin: "0 0 8px" }}>{formatCurrency(totals.week)}</p>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600 }}>지급 {formatCurrency(totals.wPaid)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 2 }}>
            <span style={{ color: "#18181b", opacity: 0.4, fontWeight: 600 }}>미지급 {formatCurrency(totals.wUnpaid)}</span>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 1fr 0.8fr", padding: "8px 12px", fontSize: 10, fontWeight: 600, color: "#a1a1aa" }}>
          <span>일자</span><span style={{ textAlign: "center" }}>판매</span><span style={{ textAlign: "center" }}>근무시간</span><span style={{ textAlign: "right" }}>급여</span><span style={{ textAlign: "right" }}>상태</span>
        </div>
        {list.length === 0 ? <p style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 13 }}>급여 기록이 없습니다</p> :
          list.slice(0, show).map(function(r, i) {
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 1fr 0.8fr", padding: "10px 12px", borderBottom: "1px solid #f4f4f5", fontSize: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 11 }}>{formatDate(r.date)}</span>
                <span style={{ textAlign: "center", color: "#71717a" }}>{r.sold}개</span>
                <span style={{ textAlign: "center", color: "#71717a" }}>{fmtHours(r.mins)}</span>
                <span style={{ textAlign: "right", fontWeight: 700, color: "#e1360a" }}>{formatCurrency(r.pay)}</span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: r.paid ? "#dcfce7" : "#fef2f2", color: r.paid ? "#16a34a" : "#e1360a" }}>
                    {r.paid ? "지급" : "미지급"}
                  </span>
                </span>
              </div>
            );
          })
        }
        {show < list.length && <button onClick={function() { setShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 12, color: "#71717a", marginTop: 8 })}>더 보기</button>}
      </div>
    </div>
  );
}


/* ===== 관리자: 홈 ===== */

/* ===== 관리자: 홈 ===== */
function AdminHome(p) {
  var reports = p.reports, settings = p.settings, production = p.production;
  var r1 = useState(getToday()), selDay = r1[0], setSelDay = r1[1];
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={Object.assign({}, CS, { background: "linear-gradient(135deg,#e1360a,#c42d08)", border: "none" })}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)", margin: "0 0 2px" }}>월 총 매출</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>{formatCurrency(stats.mRev)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>월 총 판매</p>
          <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{stats.mSold}<span style={{ fontSize: 12, color: "#a1a1aa" }}> 개</span></p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>주간 매출</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.wRev)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>주간 판매</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{stats.wSold}<span style={{ fontSize: 12, color: "#a1a1aa" }}> 개</span></p>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>📅 일일 현황</p>
          <input type="date" value={selDay} onChange={function(e) { setSelDay(e.target.value); }}
            style={Object.assign({}, IS, { width: "auto", padding: "4px 10px", fontSize: 12 })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px" }}>매출</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(stats.dRev)}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px" }}>판매</p>
            <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{stats.dSold}<span style={{ fontSize: 12, color: "#a1a1aa" }}> 개</span></p>
          </div>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 14 })}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>🍗 사무실 재고</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ textAlign: "center", padding: 12, background: "#fff8f6", borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px" }}>순살</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: officeStock.sunsal < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.sunsal}</p>
          </div>
          <div style={{ textAlign: "center", padding: 12, background: "#fff8f6", borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px" }}>파닭</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: officeStock.padak < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.padak}</p>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 13, fontWeight: 700, margin: "12px 0 10px" }}>👥 직원별 현황</p>
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
          <div key={emp.id} style={Object.assign({}, CS, { marginBottom: 8, padding: "12px 16px" })}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px", color: "#18181b" }}>{emp.name}{(emp.status || "active") === "resigned" ? <span style={{ fontSize: 10, fontWeight: 600, color: "#e1360a", marginLeft: 6 }}>(퇴사)</span> : ""}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>누적</p>
                <p style={{ fontSize: 15, fontWeight: 800, margin: "0 0 1px" }}>{ts}개</p>
                <p style={{ fontSize: 10, color: "#e1360a", fontWeight: 600, margin: 0 }}>{formatCurrency(ts * price)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>{mLabel}</p>
                <p style={{ fontSize: 15, fontWeight: 800, margin: "0 0 1px" }}>{ms}개</p>
                <p style={{ fontSize: 10, color: "#e1360a", fontWeight: 600, margin: 0 }}>{formatCurrency(ms * price)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>최근7일</p>
                <p style={{ fontSize: 15, fontWeight: 800, margin: "0 0 1px" }}>{ws}개</p>
                <p style={{ fontSize: 10, color: "#e1360a", fontWeight: 600, margin: 0 }}>{formatCurrency(ws * price)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>{formatDate(selDay).split("(")[0].trim()}</p>
                <p style={{ fontSize: 15, fontWeight: 800, margin: "0 0 1px" }}>{ds}개</p>
                <p style={{ fontSize: 10, color: "#e1360a", fontWeight: 600, margin: 0 }}>{formatCurrency(ds * price)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function AdminFinance(p) {
  var reports = p.reports, settings = p.settings, production = p.production;
  var fixedCosts = p.fixedCosts, setFixedCosts = p.setFixedCosts;
  var varCosts = p.varCosts, setVarCosts = p.setVarCosts;
  var prodSettings = p.prodSettings;
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
  var unitCost = (Number(prodSettings.kgPrice) || 0) * 12;

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
    production.forEach(function(pr) {
      if (pr.date && pr.date.substring(0, 7) === thisMonthKey) {
        var matCost = (Number(prodSettings.kgPrice) || 0) * 12 * (Number(pr.boxes) || 0);
        var labCost = (Number(prodSettings.prodCost) || 0) * (Number(pr.qty) || 0);
        total += matCost + labCost;
      }
    });
    return total;
  }, [production, thisMonthKey, prodSettings]);

  var totalFixed = fixedCosts.reduce(function(a, c) { return a + (Number(c.amount) || 0); }, 0);
  var monthVar = varCosts.filter(function(v) { return v.date && v.date.substring(0, 7) === thisMonthKey; }).reduce(function(a, c) { return a + (Number(c.amount) || 0); }, 0);

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
      <div style={Object.assign({}, CS, { padding: 0, border: "none", overflow: "hidden", marginBottom: 12 })}>
        <div style={{ padding: "20px 16px 14px", background: isProfit ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#e1360a,#c42d08)" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: 1 }}>{thisMonthKey} 마진</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 4px" }}>{isProfit ? "+" : ""}{formatCurrency(margin)}</p>
          {!isProfit && breakEven > 0 && (
            <div style={{ marginTop: 6, padding: "8px 12px", background: "rgba(255,196,14,0.25)", borderRadius: 8, textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#ffc40e", margin: 0 }}>흑자 전환까지 {breakEven}개 판매 필요!</p>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px 16px", background: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>매출</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>+{formatCurrency(monthRev)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>고정비</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(totalFixed)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>생산비</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(monthProdCost)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>변동비</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(monthVar)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>급여</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a" }}>-{formatCurrency(monthSalary)}</span>
          </div>
        </div>
      </div>
      {emps.length > 0 && empQuota > 0 && (
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 12 })}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px" }}>🎯 직원별 월 할당량</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, padding: "10px 8px", background: "#f9fafb", borderRadius: 8 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>총 직원</p>
              <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{emps.length}명</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>전체 목표</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#e1360a", margin: 0 }}>{empQuota * emps.length}개</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>1인당</p>
              <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{empQuota}개</p>
            </div>
          </div>
          <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 10px" }}>고정비+생산비+변동비 ÷ {emps.length}명 ÷ {formatCurrency(price)} 기준</p>
          {emps.map(function(emp) {
            var sold = empMonthSold[emp.id] || 0;
            var pct = empQuota > 0 ? Math.min(100, Math.round(sold / empQuota * 100)) : 0;
            var done = sold >= empQuota;
            return (
              <div key={emp.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{emp.name}{(emp.status || "active") === "resigned" ? <span style={{ fontSize: 9, color: "#e1360a", marginLeft: 4 }}>(퇴사)</span> : ""}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: done ? "#16a34a" : "#e1360a" }}>{sold} / {empQuota}개</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: "#f4f4f5", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 4, width: pct + "%", background: done ? "#16a34a" : "#e1360a", transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>📌 고정비</p>
        </div>
        {fixedCosts.map(function(fc) {
          return (
            <div key={fc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fc.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#e1360a" }}>{formatCurrency(fc.amount)}</span>
                <button onClick={function() { delFixed(fc.id); }} style={{ border: "none", background: "none", color: "#a1a1aa", fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={fcName} onChange={function(e) { setFcName(e.target.value); }} placeholder="분류" style={Object.assign({}, IS, { flex: 1, padding: "6px 8px", fontSize: 12 })} />
          <input type="number" value={fcAmt} onChange={function(e) { setFcAmt(e.target.value); }} placeholder="금액" style={Object.assign({}, IS, { width: 90, padding: "6px 8px", fontSize: 12 })} inputMode="numeric" />
          <button onClick={addFixed} style={Object.assign({}, BP, { width: "auto", padding: "6px 12px", fontSize: 11 })}>추가</button>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px" }}>🏭 생산비 (자동)</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#71717a" }}>{thisMonthKey} 생산비</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(monthProdCost)}</span>
        </div>
        <p style={{ fontSize: 10, color: "#a1a1aa", margin: "4px 0 0" }}>박스당 {formatCurrency(unitCost)} + 제작비 {formatCurrency(Number(prodSettings.prodCost) || 0)}/개 기준</p>
      </div>
      <div style={Object.assign({}, CS, { padding: 14 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>📊 변동비</p>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={function() { setVcView("month"); setVcShow(20); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 10 }, vcView === "month" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>이번달</button>
            <button onClick={function() { setVcView("all"); setVcShow(20); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 10 }, vcView === "all" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>전체</button>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "6px 8px", background: "#f9fafb", borderRadius: 6 }}>
          <span style={{ fontSize: 11, color: "#71717a", fontWeight: 600 }}>{vcView === "all" ? "전체 " + allVarList.length + "건" : thisMonthKey + " " + monthVarList.length + "건"}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(vcView === "all" ? allVarTotal : monthVar)}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input type="date" value={vcDate} onChange={function(e) { setVcDate(e.target.value); }} style={Object.assign({}, IS, { width: "auto", padding: "4px 6px", fontSize: 11 })} />
          <input value={vcCat} onChange={function(e) { setVcCat(e.target.value); }} placeholder="분류" style={Object.assign({}, IS, { flex: 1, padding: "6px 8px", fontSize: 12 })} />
          <input type="number" value={vcAmt} onChange={function(e) { setVcAmt(e.target.value); }} placeholder="금액" style={Object.assign({}, IS, { width: 80, padding: "6px 8px", fontSize: 12 })} inputMode="numeric" />
          <button onClick={addVar} style={Object.assign({}, BP, { width: "auto", padding: "6px 10px", fontSize: 11 })}>+</button>
        </div>
        {vcList.length === 0 ? <p style={{ textAlign: "center", padding: 16, color: "#a1a1aa", fontSize: 12 }}>{vcView === "all" ? "변동비 기록 없음" : "이번 달 변동비 없음"}</p> :
          vcList.slice(0, vcShow).map(function(vc) {
            return (
              <div key={vc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5", fontSize: 12 }}>
                <div><span style={{ color: "#71717a", fontSize: 11 }}>{formatDate(vc.date)}</span> <span style={{ fontWeight: 600, marginLeft: 6 }}>{vc.category}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: "#e1360a" }}>{formatCurrency(vc.amount)}</span>
                  <button onClick={function() { delVar(vc.id); }} style={{ border: "none", background: "none", color: "#a1a1aa", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              </div>
            );
          })
        }
        {vcShow < vcList.length && <button onClick={function() { setVcShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 12, color: "#71717a", marginTop: 8 })}>더 보기</button>}
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
  var r5 = useState({ date: getToday(), type: "sunsal", qty: "", boxes: "" }), form = r5[0], setForm = r5[1];
  var kgPrice = Number(prodSettings.kgPrice) || 0;
  var prodCost = Number(prodSettings.prodCost) || 0;
  var boxPrice = kgPrice * 12;

  var now = new Date();
  var thisMonthKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  var weekAgo = new Date(now.getTime() - 7 * 24 * 3600000);
  var weekKey = weekAgo.getFullYear() + "-" + String(weekAgo.getMonth() + 1).padStart(2, "0") + "-" + String(weekAgo.getDate()).padStart(2, "0");

  var stats = useMemo(function() {
    var m = 0, mMat = 0, mLab = 0, w = 0, wMat = 0, wLab = 0, d = 0, dMat = 0, dLab = 0;
    var today = getToday();
    production.forEach(function(pr) {
      var q = Number(pr.qty) || 0;
      var b = Number(pr.boxes) || 0;
      var mat = kgPrice * 12 * b;
      var lab = prodCost * q;
      if (pr.date && pr.date.substring(0, 7) === thisMonthKey) { m += q; mMat += mat; mLab += lab; }
      if (pr.date >= weekKey) { w += q; wMat += mat; wLab += lab; }
      if (pr.date === today) { d += q; dMat += mat; dLab += lab; }
    });
    return { m: m, mMat: mMat, mLab: mLab, w: w, wMat: wMat, wLab: wLab, d: d, dMat: dMat, dLab: dLab };
  }, [production, thisMonthKey, weekKey, kgPrice, prodCost]);

  var avgCost = useMemo(function() {
    var sorted = production.slice().sort(function(a, b) { return (b.savedAt || "").localeCompare(a.savedAt || ""); });
    var recent = sorted.slice(0, 7);
    if (recent.length === 0) return { avg: 0, date: "" };
    var sum = 0;
    var latestDate = "";
    recent.forEach(function(pr) {
      var q = Number(pr.qty) || 1;
      var b = Number(pr.boxes) || 0;
      var perPiece = (kgPrice * 12 * b / q) + prodCost;
      sum += perPiece;
      if (!latestDate || pr.date > latestDate) latestDate = pr.date;
    });
    return { avg: Math.round(sum / recent.length), date: latestDate };
  }, [production, kgPrice, prodCost]);

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

  function saveEntry() {
    if (!form.qty || !form.boxes) return;
    var entry = { date: form.date, type: form.type, qty: Number(form.qty), boxes: Number(form.boxes), savedAt: new Date().toISOString() };
    var u;
    if (editId) {
      u = production.map(function(pr) { return pr.id === editId ? Object.assign({}, pr, entry) : pr; });
    } else {
      entry.id = "pr_" + Date.now();
      u = production.concat([entry]);
    }
    setProduction(u); store.set("ft-production", u);
    setForm({ date: getToday(), type: "sunsal", qty: "", boxes: "" });
    setAdding(false); setEditId(null);
    setToast("저장 완료"); setTimeout(function() { setToast(""); }, 2000);
  }

  function delEntry(id) {
    var u = production.filter(function(pr) { return pr.id !== id; });
    setProduction(u); store.set("ft-production", u);
  }

  function openEdit(pr) {
    setForm({ date: pr.date, type: pr.type, qty: pr.qty, boxes: pr.boxes || "" });
    setEditId(pr.id); setAdding(true);
  }

  var sorted = useMemo(function() {
    return production.slice().sort(function(a, b) { return (b.date + b.savedAt).localeCompare(a.date + a.savedAt); });
  }, [production]);

  var lastDate = prodSettings.lastUpdated || "";

  var fBoxes = Number(form.boxes) || 0;
  var fQty = Number(form.qty) || 0;
  var fMatCost = kgPrice * 12 * fBoxes;
  var fLabCost = prodCost * fQty;

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>🔧 생산단가 설정</p>
          {lastDate && <span style={{ fontSize: 10, color: "#18181b", opacity: 0.35 }}>({lastDate.replace(/-/g, ".").substring(2)} 기준)</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <NumInput label="KG당가격" value={prodSettings.kgPrice || ""} onChange={function(v) { saveProdSettings("kgPrice", v); }} suffix="원" />
          <NumInput label="제작비용 (개당)" value={prodSettings.prodCost || ""} onChange={function(v) { saveProdSettings("prodCost", v); }} suffix="원" />
        </div>
        <div style={{ padding: "10px 12px", background: "#fff8f6", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#71717a" }}>평균 생산비</span>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(avgCost.avg)}</span>
            {avgCost.date && <span style={{ fontSize: 10, color: "#18181b", opacity: 0.35, marginLeft: 6 }}>({avgCost.date.replace(/-/g, ".").substring(2)} 기준)</span>}
          </div>
        </div>
        <p style={{ fontSize: 10, color: "#a1a1aa", margin: "6px 0 0" }}>최근 7건 기준 · 1박스 = 12kg = {formatCurrency(boxPrice)}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>월 생산</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>{stats.m}<span style={{ fontSize: 11, color: "#a1a1aa" }}> 개</span></p>
          <p style={{ fontSize: 10, color: "#71717a", margin: 0 }}>생산가 {formatCurrency(stats.mMat)}</p>
          <p style={{ fontSize: 10, color: "#71717a", margin: 0 }}>제작비 {formatCurrency(stats.mLab)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>주 생산</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>{stats.w}<span style={{ fontSize: 11, color: "#a1a1aa" }}> 개</span></p>
          <p style={{ fontSize: 10, color: "#71717a", margin: 0 }}>{formatCurrency(stats.wMat)}</p>
          <p style={{ fontSize: 10, color: "#71717a", margin: 0 }}>{formatCurrency(stats.wLab)}</p>
        </div>
        <div style={CS}>
          <p style={Object.assign({}, LS, { margin: "0 0 2px" })}>일 생산</p>
          <p style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>{stats.d}<span style={{ fontSize: 11, color: "#a1a1aa" }}> 개</span></p>
          <p style={{ fontSize: 10, color: "#71717a", margin: 0 }}>{formatCurrency(stats.dMat)}</p>
          <p style={{ fontSize: 10, color: "#71717a", margin: 0 }}>{formatCurrency(stats.dLab)}</p>
        </div>
      </div>
      <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px" }}>🍗 현재 재고</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ textAlign: "center", padding: 12, background: "#fff8f6", borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px" }}>순살</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: officeStock.sunsal < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.sunsal}</p>
          </div>
          <div style={{ textAlign: "center", padding: 12, background: "#fff8f6", borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: "#71717a", margin: "0 0 4px" }}>파닭</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: officeStock.padak < 0 ? "#e1360a" : "#18181b", margin: 0 }}>{officeStock.padak}</p>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 8px" }}>📋 생산 목록</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 0.4fr 0.6fr 0.6fr 0.6fr 0.3fr", padding: "6px 6px", fontSize: 9, fontWeight: 600, color: "#a1a1aa" }}>
          <span>일자</span><span>분류</span><span style={{ textAlign: "center" }}>개수</span><span style={{ textAlign: "right" }}>생산가</span><span style={{ textAlign: "right" }}>제작비</span><span style={{ textAlign: "right" }}>꼬치당</span><span />
        </div>
        {sorted.slice(0, show).map(function(pr) {
          var matC = kgPrice * 12 * (Number(pr.boxes) || 0);
          var labC = prodCost * (Number(pr.qty) || 0);
          var q = Number(pr.qty) || 1;
          var perPiece = Math.round(matC / q) + prodCost;
          return (
            <div key={pr.id} style={{ display: "grid", gridTemplateColumns: "1fr 0.5fr 0.4fr 0.6fr 0.6fr 0.6fr 0.3fr", padding: "8px 6px", borderBottom: "1px solid #f4f4f5", fontSize: 11, alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 10 }}>{formatDate(pr.date)}</span>
              <span style={{ color: pr.type === "sunsal" ? "#e1360a" : "#2563eb", fontWeight: 600 }}>{pr.type === "sunsal" ? "순살" : "파닭"}</span>
              <span style={{ textAlign: "center", fontWeight: 700 }}>{pr.qty}</span>
              <span style={{ textAlign: "right", color: "#71717a", fontSize: 10 }}>{formatCurrency(matC)}</span>
              <span style={{ textAlign: "right", color: "#71717a", fontSize: 10 }}>{formatCurrency(labC)}</span>
              <span style={{ textAlign: "right", fontWeight: 700, color: "#e1360a", fontSize: 10 }}>{formatCurrency(perPiece)}</span>
              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <button onClick={function() { openEdit(pr); }} style={{ border: "none", background: "none", color: "#71717a", fontSize: 10, cursor: "pointer", padding: 0 }}>✎</button>
                <button onClick={function() { delEntry(pr.id); }} style={{ border: "none", background: "none", color: "#e1360a", fontSize: 10, cursor: "pointer", padding: 0 }}>✕</button>
              </div>
            </div>
          );
        })}
        {show < sorted.length && <button onClick={function() { setShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 12, color: "#71717a", marginTop: 8 })}>더 보기</button>}
      </div>
      {adding && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>{editId ? "생산 수정" : "생산 추가"}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div><label style={LS}>일자</label><input type="date" value={form.date} onChange={function(e) { setForm(Object.assign({}, form, { date: e.target.value })); }} style={IS} /></div>
              <div>
                <label style={LS}>분류</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={function() { setForm(Object.assign({}, form, { type: "sunsal" })); }} style={Object.assign({}, BO, { flex: 1, padding: "6px 0", fontSize: 12 }, form.type === "sunsal" ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>순살</button>
                  <button onClick={function() { setForm(Object.assign({}, form, { type: "padak" })); }} style={Object.assign({}, BO, { flex: 1, padding: "6px 0", fontSize: 12 }, form.type === "padak" ? { background: "#2563eb", color: "#fff", borderColor: "#2563eb" } : {})}>파닭</button>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <NumInput label="소모박스" value={form.boxes} onChange={function(v) { setForm(Object.assign({}, form, { boxes: v })); }} suffix="박스" />
              <NumInput label="생산개수" value={form.qty} onChange={function(v) { setForm(Object.assign({}, form, { qty: v })); }} suffix="개" />
            </div>
            {(fBoxes > 0 || fQty > 0) && (
              <div style={{ padding: "8px 12px", background: "#f9fafb", borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#71717a" }}>생산가</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(fMatCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#71717a" }}>제작비</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(fLabCost)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 4, borderTop: "1px solid #e4e4e7" }}>
                  <span style={{ fontWeight: 700 }}>합계</span>
                  <span style={{ fontWeight: 800, color: "#e1360a" }}>{formatCurrency(fMatCost + fLabCost)}</span>
                </div>
                {fQty > 0 && <p style={{ fontSize: 10, color: "#a1a1aa", margin: "4px 0 0", textAlign: "right" }}>꼬치당 {formatCurrency(Math.round(fMatCost / fQty) + prodCost)}</p>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={function() { setAdding(false); setEditId(null); }} style={Object.assign({}, BO, { flex: 1 })}>취소</button>
              <button onClick={saveEntry} style={Object.assign({}, BP, { flex: 1 })}>{editId ? "수정" : "추가"}</button>
            </div>
          </div>
        </div>
      )}
      <button onClick={function() { setForm({ date: getToday(), type: "sunsal", qty: "", boxes: "" }); setEditId(null); setAdding(true); }}
        style={{ position: "fixed", bottom: 80, right: 20, width: 52, height: 52, borderRadius: 26, background: "#e1360a", color: "#fff", border: "none", fontSize: 24, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(225,54,10,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>+</button>
      <Toast msg={toast} />
    </div>
  );
}


function AdminInventory(p) {
  var items = p.inventoryItems, setItems = p.setInventoryItems;
  var stock = p.inventoryStock, setStock = p.setInventoryStock;
  var requests = p.requests, setRequests = p.setRequests;
  var users = p.users;
  var r1 = useState(""), newName = r1[0], setNewName = r1[1];
  var r2 = useState(""), toast = r2[0], setToast = r2[1];
  var emps = users.filter(function(u) { return u.role === "employee" && (u.status || "active") === "active"; });
  var pending = requests.filter(function(r) { return r.status === "pending"; });

  function addItem() {
    if (!newName.trim()) return;
    var ni = { id: "item_" + Date.now(), name: newName.trim() };
    var u = items.concat([ni]);
    setItems(u); store.set("ft-inv-items", u);
    setNewName(""); setToast("품목 추가됨"); setTimeout(function() { setToast(""); }, 2000);
  }

  function delItem(id) {
    var u = items.filter(function(i) { return i.id !== id; });
    setItems(u); store.set("ft-inv-items", u);
  }

  function moveItem(idx, dir) {
    var ni = idx + dir;
    if (ni < 0 || ni >= items.length) return;
    var u = items.slice();
    var tmp = u[idx];
    u[idx] = u[ni];
    u[ni] = tmp;
    setItems(u); store.set("ft-inv-items", u);
  }

  function handleReq(req, action) {
    var u = requests.map(function(r) {
      if (r.id === req.id) return Object.assign({}, r, { status: action });
      return r;
    });
    if (action === "approved") {
      var s = JSON.parse(JSON.stringify(stock));
      if (!s[req.employeeId]) s[req.employeeId] = {};
      s[req.employeeId][req.itemId] = (s[req.employeeId][req.itemId] || 0) + req.qty;
      setStock(s); store.set("ft-inv-stock", s);
    }
    setRequests(u); store.set("ft-inv-requests", u);
    setToast(action === "approved" ? "승인 완료" : "거절 완료");
    setTimeout(function() { setToast(""); }, 2000);
  }

  function adjStock(empId, itemId, delta) {
    var s = JSON.parse(JSON.stringify(stock));
    if (!s[empId]) s[empId] = {};
    s[empId][itemId] = Math.max(0, (s[empId][itemId] || 0) + delta);
    setStock(s); store.set("ft-inv-stock", s);
  }

  return (
    <div style={PAGE}>
      <div style={Object.assign({}, CS, { marginBottom: 14 })}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>📦 품목 관리</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input value={newName} onChange={function(e) { setNewName(e.target.value); }} placeholder="품목명 입력" style={Object.assign({}, IS, { flex: 1 })} />
          <button onClick={addItem} style={Object.assign({}, BP, { width: "auto", padding: "8px 16px" })}>추가</button>
        </div>
        {items.map(function(item, idx) {
          return (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={function() { moveItem(idx, -1); }} disabled={idx === 0}
                    style={{ border: "none", background: "none", fontSize: 10, cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#d4d4d8" : "#71717a", padding: 0, lineHeight: 1 }}>▲</button>
                  <button onClick={function() { moveItem(idx, 1); }} disabled={idx === items.length - 1}
                    style={{ border: "none", background: "none", fontSize: 10, cursor: idx === items.length - 1 ? "default" : "pointer", color: idx === items.length - 1 ? "#d4d4d8" : "#71717a", padding: 0, lineHeight: 1 }}>▼</button>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
              </div>
              <button onClick={function() { delItem(item.id); }} style={Object.assign({}, BO, { padding: "2px 8px", fontSize: 10, color: "#e1360a", borderColor: "#f5c6c0" })}>삭제</button>
            </div>
          );
        })}
      </div>
      {pending.length > 0 && (
        <div style={Object.assign({}, CS, { marginBottom: 14 })}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>🔔 보충 요청 ({pending.length})</p>
          {pending.map(function(req) {
            return (
              <div key={req.id} style={{ padding: "10px 0", borderBottom: "1px solid #f4f4f5" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{req.employeeName} — {req.itemName}</p>
                    <p style={{ fontSize: 11, color: "#71717a", margin: "2px 0 0" }}>{req.qty}개 요청</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={function() { handleReq(req, "approved"); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 11, color: "#16a34a", borderColor: "#bbf7d0" })}>승인</button>
                    <button onClick={function() { handleReq(req, "rejected"); }} style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 11, color: "#e1360a", borderColor: "#f5c6c0" })}>거절</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={Object.assign({}, CS, { padding: 14 })}>
        <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>👥 직원별 재고 현황</p>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          {items.length === 0 ? <p style={{ color: "#a1a1aa", fontSize: 12, textAlign: "center", padding: 16 }}>품목을 먼저 추가하세요</p> :
            emps.map(function(emp) {
              var empStock = stock[emp.id] || {};
              return (
                <div key={emp.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #f4f4f5" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>{emp.name}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {items.map(function(item) {
                      var qty = empStock[item.id] || 0;
                      return (
                        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "#fafafa", borderRadius: 6, border: "1px solid #e4e4e7" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#71717a" }}>{item.name}</span>
                          <button onClick={function() { adjStock(emp.id, item.id, -1); }} style={{ border: "none", background: "none", color: "#e1360a", fontSize: 14, cursor: "pointer", padding: "0 2px", fontWeight: 700 }}>−</button>
                          <span style={{ fontSize: 13, fontWeight: 800, minWidth: 18, textAlign: "center" }}>{qty}</span>
                          <button onClick={function() { adjStock(emp.id, item.id, 1); }} style={{ border: "none", background: "none", color: "#16a34a", fontSize: 14, cursor: "pointer", padding: "0 2px", fontWeight: 700 }}>+</button>
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
      <Toast msg={toast} />
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
    if (users.some(function(u) { return u.pin === newEmp.pin; })) { setToast("이미 사용 중인 PIN"); setTimeout(function() { setToast(""); }, 2000); return; }
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

  function updatePay(date, rk, field, val) {
    var u = JSON.parse(JSON.stringify(reports));
    if (u[date] && u[date][rk]) {
      u[date][rk][field] = val;
      setReports(u); store.set("ft-reports", u);
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={function() { setPayViewId(null); }} style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 12 })}>← 돌아가기</button>
          <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{payName}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={Object.assign({}, CS, { textAlign: "center", padding: 12 })}>
            <p style={{ fontSize: 10, color: "#a1a1aa", margin: "0 0 2px", fontWeight: 600 }}>총 급여</p>
            <p style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{formatCurrency(payTotal)}</p>
          </div>
          <div style={Object.assign({}, CS, { textAlign: "center", padding: 12 })}>
            <p style={{ fontSize: 10, color: "#16a34a", margin: "0 0 2px", fontWeight: 600 }}>지급완료</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#16a34a", margin: 0 }}>{formatCurrency(payPaid)}</p>
          </div>
          <div style={Object.assign({}, CS, { textAlign: "center", padding: 12 })}>
            <p style={{ fontSize: 10, color: "#e1360a", margin: "0 0 2px", fontWeight: 600 }}>미지급</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(payUnpaid)}</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.5fr", padding: "8px 8px", fontSize: 10, fontWeight: 600, color: "#a1a1aa", borderBottom: "1px solid #e4e4e7" }}>
          <span>일자</span><span style={{ textAlign: "center" }}>자동계산</span><span style={{ textAlign: "center" }}>급여</span><span style={{ textAlign: "center" }}>상태</span>
        </div>
        {payList.length === 0 ? <p style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 13 }}>급여 기록이 없습니다</p> :
          payList.slice(0, payShow).map(function(py) {
            return (
              <div key={py.rk} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.7fr 0.8fr 0.5fr", padding: "10px 8px", borderBottom: "1px solid #f4f4f5", fontSize: 12, alignItems: "center" }}>
                <div>
                  <p style={{ fontWeight: 600, margin: 0, fontSize: 12 }}>{formatDate(py.date)}</p>
                  <p style={{ fontSize: 10, color: "#a1a1aa", margin: "2px 0 0" }}>{py.sold}개 · {Math.floor(py.mins / 60)}시간 {py.mins % 60}분</p>
                </div>
                <span style={{ textAlign: "center", color: "#a1a1aa", fontSize: 11 }}>{formatCurrency(py.autoPay)}</span>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <input type="number" value={py.pay} inputMode="numeric"
                    onChange={function(e) { updatePay(py.date, py.rk, "payOverride", e.target.value === "" ? undefined : Number(e.target.value)); }}
                    style={{ width: "100%", padding: "6px 4px", borderRadius: 6, border: "1px solid " + (py.hasOverride ? "#e1360a" : "#e4e4e7"), fontSize: 12, fontWeight: 700, textAlign: "center", outline: "none", background: py.hasOverride ? "#fff8f6" : "#fafafa", color: "#18181b", boxSizing: "border-box" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <button onClick={function() { updatePay(py.date, py.rk, "paid", !py.paid); }}
                    style={{ border: "none", background: py.paid ? "#dcfce7" : "#fef2f2", color: py.paid ? "#16a34a" : "#e1360a", fontSize: 10, fontWeight: 700, padding: "5px 8px", borderRadius: 6, cursor: "pointer" }}>
                    {py.paid ? "지급" : "미지급"}
                  </button>
                </div>
              </div>
            );
          })
        }
        {payShow < payList.length && <button onClick={function() { setPayShow(function(c) { return c + 20; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 12, color: "#71717a", marginTop: 8 })}>더 보기</button>}
      </div>
    );
  }

  return (
    <div style={PAGE}>
      {/* 출근지 현황 */}
      <div style={Object.assign({}, CS, { padding: 14, marginBottom: 14 })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>📍 직원 출근지 현황</p>
          <button onClick={function() { setSchEdit(!schEdit); }}
            style={Object.assign({}, BO, { padding: "4px 12px", fontSize: 11 }, schEdit ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>
            {schEdit ? "완료" : "수정"}
          </button>
        </div>
        <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "52px 28px repeat(6, " + (schEdit ? "72px" : "64px") + ")", gap: 3, fontSize: 10, minWidth: schEdit ? 510 : 470 }}>
            <div /><div />
            {dayLabels.map(function(d) { return <div key={d} style={{ textAlign: "center", fontWeight: 700, color: "#71717a", padding: "4px 0" }}>{d}</div>; })}
            {allEmps.filter(function(u) { return (u.status || "active") === "active"; }).map(function(emp) {
              var sch = (schedules || {})[emp.id] || {};
              var mainRow = [
                <div key={emp.id + "_n"} style={{ fontWeight: 600, color: "#18181b", fontSize: 11, gridRow: "span 2", display: "flex", alignItems: "center" }}>{emp.name}</div>,
                <div key={emp.id + "_ml"} style={{ fontSize: 9, fontWeight: 700, color: "#e1360a", display: "flex", alignItems: "center" }}>메인</div>
              ].concat(dayKeys.map(function(dk) {
                var v = sch[dk + "_main"] || "";
                if (schEdit) {
                  return <input key={emp.id + "_m_" + dk} value={v} placeholder="-"
                    onChange={function(e) { updateSchedule(emp.id, dk + "_main", e.target.value); }}
                    style={{ width: "100%", padding: "3px 2px", borderRadius: 4, border: "1px solid #e4e4e7", fontSize: 10, fontWeight: 600, textAlign: "center", outline: "none", background: "#fff", color: "#e1360a", boxSizing: "border-box" }} />;
                }
                return <div key={emp.id + "_m_" + dk} style={{ textAlign: "center", padding: "3px 2px", background: v ? "#fff8f6" : "#fafafa", borderRadius: 4, color: v ? "#e1360a" : "#d4d4d8", fontWeight: 600 }}>{v || "-"}</div>;
              }));
              var subRow = [
                <div key={emp.id + "_sl"} style={{ fontSize: 9, fontWeight: 600, color: "#a1a1aa", display: "flex", alignItems: "center" }}>서브</div>
              ].concat(dayKeys.map(function(dk) {
                var v = sch[dk + "_sub"] || "";
                if (schEdit) {
                  return <input key={emp.id + "_s_" + dk} value={v} placeholder="-"
                    onChange={function(e) { updateSchedule(emp.id, dk + "_sub", e.target.value); }}
                    style={{ width: "100%", padding: "3px 2px", borderRadius: 4, border: "1px solid #e4e4e7", fontSize: 10, fontWeight: 600, textAlign: "center", outline: "none", background: "#fff", color: "#16a34a", boxSizing: "border-box" }} />;
                }
                return <div key={emp.id + "_s_" + dk} style={{ textAlign: "center", padding: "3px 2px", background: v ? "#f0fdf4" : "#fafafa", borderRadius: 4, color: v ? "#16a34a" : "#d4d4d8", fontWeight: 600 }}>{v || "-"}</div>;
              }));
              return mainRow.concat(subRow);
            })}
          </div>
        </div>
      </div>
      {/* 직원 필터 + 목록 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 10px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>👥 직원 목록</p>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ k: "all", l: "전체" }, { k: "active", l: "재직" }, { k: "resigned", l: "퇴사" }].map(function(f) {
            return (
              <button key={f.k} onClick={function() { setEmpFilter(f.k); }}
                style={Object.assign({}, BO, { padding: "4px 10px", fontSize: 10 }, empFilter === f.k ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {})}>
                {f.l}
              </button>
            );
          })}
        </div>
      </div>
      {emps.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#a1a1aa", fontSize: 13 }}>{empFilter === "resigned" ? "퇴사 직원이 없습니다" : "직원이 없습니다"}</div>}
      {emps.map(function(emp) {
        var isOpen = selId === emp.id;
        var vn = vehicles[emp.id] || "";
        var empStatus = emp.status || "active";
        var isResigned = empStatus === "resigned";
        return (
          <div key={emp.id} style={Object.assign({}, CS, { marginBottom: 8, padding: 0 }, isResigned ? { opacity: 0.75 } : {})}>
            <div onClick={function() { setSelId(isOpen ? null : emp.id); }}
              style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{emp.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: isResigned ? "#fef2f2" : "#dcfce7", color: isResigned ? "#e1360a" : "#16a34a" }}>
                  {isResigned ? "🔴 퇴사" : "🟢 재직"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {vn && <span style={{ fontSize: 10, color: "#e1360a", fontWeight: 600 }}>{vn}</span>}
                <span style={{ fontSize: 14, color: "#a1a1aa" }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f4f4f5" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                  <div><label style={LS}>전화번호</label><input value={emp.phone || ""} onChange={function(e) { saveUser(emp.id, "phone", e.target.value); }} placeholder="010-0000-0000" style={IS} /></div>
                  <div><label style={LS}>입사일자</label><input type="date" value={emp.hireDate || ""} onChange={function(e) { saveUser(emp.id, "hireDate", e.target.value); }} style={IS} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div><label style={LS}>차량 배정</label><input value={vn} onChange={function(e) { saveVehicle(emp.id, e.target.value); }} placeholder="차량명" style={IS} /></div>
                  <div><label style={LS}>PIN</label><input value={emp.pin} onChange={function(e) { saveUser(emp.id, "pin", e.target.value.replace(/\D/g, "").slice(0, 6)); }} style={IS} inputMode="numeric" maxLength={6} /></div>
                </div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#71717a", margin: "14px 0 6px" }}>💲 개별 급여 설정</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <NumInput label="판매단가" value={getES(emp.id, "pricePerUnit")} onChange={function(v) { saveEmpSetting(emp.id, "pricePerUnit", v); }} suffix="원" />
                  <NumInput label="시급" value={getES(emp.id, "hourlyWage")} onChange={function(v) { saveEmpSetting(emp.id, "hourlyWage", v); }} suffix="원" />
                  <NumInput label="판매수당" value={getES(emp.id, "salesBonus")} onChange={function(v) { saveEmpSetting(emp.id, "salesBonus", v); }} suffix="원" />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={function() { setPayViewId(emp.id); setPayShow(20); }}
                    style={Object.assign({}, BP, { flex: 1, fontSize: 12 })}>
                    💵 급여 관리
                  </button>
                  {(emp.status || "active") === "active" && (
                    <button onClick={function() { resignEmp(emp.id); }}
                      style={Object.assign({}, BO, { padding: "8px 12px", fontSize: 12, color: "#e1360a", borderColor: "#f5c6c0" })}>
                      퇴사처리
                    </button>
                  )}
                  {(emp.status || "active") === "resigned" && (
                    <button onClick={function() { reactivateEmp(emp.id); }}
                      style={Object.assign({}, BO, { padding: "8px 12px", fontSize: 12, color: "#16a34a", borderColor: "#bbf7d0" })}>
                      복원
                    </button>
                  )}
                  {(emp.status || "active") === "resigned" && (
                    <button onClick={function() { permanentDeleteEmp(emp.id); }}
                      style={Object.assign({}, BO, { padding: "8px 12px", fontSize: 12, color: "#a1a1aa", borderColor: "#e4e4e7" })}>
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
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380 }}>
            <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>👤 직원 추가</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div><label style={LS}>이름</label><input value={newEmp.name} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { name: e.target.value })); }} placeholder="이름" style={IS} /></div>
              <div><label style={LS}>전화번호</label><input value={newEmp.phone} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { phone: e.target.value })); }} placeholder="010-0000-0000" style={IS} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div><label style={LS}>PIN 6자리</label><input value={newEmp.pin} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { pin: e.target.value.replace(/\D/g, "").slice(0, 6) })); }} placeholder="000000" style={IS} inputMode="numeric" maxLength={6} /></div>
              <div><label style={LS}>입사일자</label><input type="date" value={newEmp.hireDate} onChange={function(e) { setNewEmp(Object.assign({}, newEmp, { hireDate: e.target.value })); }} style={IS} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={function() { setAdding(false); }} style={Object.assign({}, BO, { flex: 1 })}>취소</button>
              <button onClick={addEmp} style={Object.assign({}, BP, { flex: 1 })}>추가</button>
            </div>
          </div>
        </div>
      )}
      {/* FAB */}
      <button onClick={function() { setAdding(true); }} style={{ position: "fixed", bottom: 80, right: 20, width: 52, height: 52, borderRadius: 26, background: "#e1360a", color: "#fff", border: "none", fontSize: 24, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(225,54,10,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90 }}>+</button>
      <Toast msg={toast} />
    </div>
  );
}


function AdminReport(p) {
  var reports = p.reports, setReports = p.setReports, users = p.users, settings = p.settings;
  var employees = users.filter(function(u) { return u.role === "employee" && (u.status || "active") !== "deleted"; });
  var r1 = useState(employees.length > 0 ? employees[0].id : null), selEmpId = r1[0], setSelEmpId = r1[1];
  var r2 = useState(null), selKey = r2[0], setSelKey = r2[1];
  var r3 = useState(null), selDate = r3[0], setSelDate = r3[1];
  var r4 = useState(10), show = r4[0], setShow = r4[1];
  var r5 = useState(""), toast = r5[0], setToast = r5[1];
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

  function save() {
    var u = JSON.parse(JSON.stringify(reports));
    if (!u[selDate]) u[selDate] = {};
    var ex = u[selDate][selKey] || {};
    u[selDate][selKey] = Object.assign({}, ex, formData, { savedAt: new Date().toISOString() });
    setReports(u);
    store.set("ft-reports", u);
    setEditing(false);
    setToast("수정 완료!");
    setTimeout(function() { setToast(""); }, 2000);
  }

  function deleteReport() {
    if (!confirm("이 일보를 삭제하시겠습니까?")) return;
    var u = JSON.parse(JSON.stringify(reports));
    if (u[selDate] && u[selDate][selKey]) {
      delete u[selDate][selKey];
      if (Object.keys(u[selDate]).length === 0) delete u[selDate];
    }
    setReports(u);
    store.set("ft-reports", u);
    setSelKey(null);
    setSelDate(null);
    setToast("삭제 완료!");
    setTimeout(function() { setToast(""); }, 2000);
  }

  function goBack() {
    setSelKey(null);
    setSelDate(null);
    setEditing(false);
  }

  // 상세 보기/수정 화면
  if (selKey !== null && selDate !== null) {
    var shipped = (Number(formData.ship_sunsal) || 0) + (Number(formData.ship_padak) || 0);
    var sold = (Number(formData.sunsal) || 0) + (Number(formData.padak) || 0);
    var rem = shipped - sold - (Number(formData.loss) || 0);
    var rev = sold * (settings.pricePerUnit || 5000);

    return (
      <div style={PAGE}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={goBack} style={Object.assign({}, BO, { padding: "6px 12px", fontSize: 12 })}>← 목록</button>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>📅 {formatDate(selDate)}</p>
          {!editing ? <button onClick={function() { setEditing(true); }} style={Object.assign({}, BO, { padding: "4px 14px", fontSize: 12 })}>수정</button> : <div style={{ width: 48 }} />}
        </div>
        <div style={Object.assign({}, CS, { padding: "10px 14px", marginBottom: 10, background: "#fff8f6" })}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#e1360a", margin: 0 }}>👤 {selEmp ? selEmp.name : ""}</p>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "0 0 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: 0 }}>🕐 출퇴근</p>
            {formData.clockIn && formData.clockOut && (function() {
              var ci = formData.clockIn.split(":");
              var co = formData.clockOut.split(":");
              var mins = (Number(co[0]) * 60 + Number(co[1])) - (Number(ci[0]) * 60 + Number(ci[1]));
              if (mins < 0) mins += 1440;
              var h = Math.floor(mins / 60);
              var m = mins % 60;
              return <span style={{ fontSize: 12, fontWeight: 700, color: "#e1360a", opacity: 0.7 }}>{h}시간 {m}분</span>;
            })()}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: "0 1 140px" }}>
              <label style={LS}>출근</label>
              <input type="time" value={formData.clockIn} disabled={!editing}
                onChange={function(e) { up("clockIn", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
            <div style={{ flex: "0 1 140px" }}>
              <label style={LS}>퇴근</label>
              <input type="time" value={formData.clockOut} disabled={!editing}
                onChange={function(e) { up("clockOut", e.target.value); }}
                style={Object.assign({}, IS, { width: "100%" }, !editing ? { background: "#f4f4f5", color: "#a1a1aa" } : {})} />
            </div>
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "0 0 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: 0 }}>📤 출고</p>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#18181b", opacity: 0.35 }}>{shipped}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <NumInput label="순살" value={formData.ship_sunsal} onChange={function(v) { up("ship_sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.ship_padak} onChange={function(v) { up("ship_padak", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "0 0 10px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: 0 }}>🧾 판매</p>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#e1360a", background: "#fff8f6", padding: "2px 8px", borderRadius: 6 }}>{sold}개</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <NumInput label="순살" value={formData.sunsal} onChange={function(v) { up("sunsal", v); }} disabled={!editing} suffix="개" />
            <NumInput label="파닭" value={formData.padak} onChange={function(v) { up("padak", v); }} disabled={!editing} suffix="개" />
            <NumInput label="로스" value={formData.loss} onChange={function(v) { up("loss", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: "0 0 10px" }}>📊 잔여</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LS}>출고-판매-로스 (자동)</label>
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f4f4f5", border: "1px solid #e4e4e7", fontSize: 16, fontWeight: 800, color: rem < 0 ? "#e1360a" : "#18181b" }}>{rem} 개</div>
            </div>
            <NumInput label="초벌" value={formData.chobeol} onChange={function(v) { up("chobeol", v); }} disabled={!editing} suffix="개" />
          </div>
        </div>
        <div style={Object.assign({}, CS, { padding: 14, marginBottom: 10 })}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#18181b", margin: "0 0 10px" }}>💰 매출</p>
          <div style={{ marginBottom: 10 }}>
            <label style={LS}>총 매출 (자동)</label>
            <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fff8f6", border: "1px solid #f5c6c0", fontSize: 16, fontWeight: 800, color: "#e1360a" }}>{formatCurrency(rev)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <NumInput label="계좌이체" value={formData.transfer} onChange={function(v) { up("transfer", v); }} disabled={!editing} suffix="원" />
            <NumInput label="현금" value={formData.cash} onChange={function(v) { up("cash", v); }} disabled={!editing} suffix="원" />
          </div>
        </div>
        {editing && <button onClick={save} style={Object.assign({}, BP, { marginBottom: 8 })}>수정 저장</button>}
        {editing && <button onClick={deleteReport} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 13, color: "#e1360a", borderColor: "#f5c6c0" })}>🗑 일보 삭제</button>}
        <Toast msg={toast} />
      </div>
    );
  }

  // 목록 화면
  return (
    <div style={PAGE}>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {employees.map(function(emp) {
          var isActive = selEmpId === emp.id;
          var isResigned = (emp.status || "active") === "resigned";
          return (
            <button key={emp.id} onClick={function() { setSelEmpId(emp.id); setShow(10); }}
              style={Object.assign({}, BO, { padding: "6px 14px", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }, isActive ? { background: "#e1360a", color: "#fff", borderColor: "#e1360a" } : {}, isResigned && !isActive ? { opacity: 0.6 } : {})}>
              {emp.name}{isResigned ? " (퇴사)" : ""}
            </button>
          );
        })}
      </div>
      {selEmp && (
        <div style={Object.assign({}, CS, { padding: "10px 14px", marginBottom: 10, background: "#fff8f6" })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#e1360a", margin: 0 }}>👤 {selEmp.name}</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#71717a", margin: 0 }}>총 {list.length}건</p>
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#a1a1aa", fontSize: 13 }}>작성된 일보가 없습니다</div>
      ) : list.slice(0, show).map(function(item, i) {
        return (
          <div key={i} onClick={function() { openReport(item.date, item.rk); }} style={Object.assign({}, CS, { marginBottom: 8, padding: "14px 16px", cursor: "pointer" })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{formatDate(item.date)}</p>
                <p style={{ fontSize: 11, color: "#a1a1aa", margin: "4px 0 0" }}>출고 {(Number(item.ship_sunsal) || 0) + (Number(item.ship_padak) || 0)} · 판매 {item.sold} · 로스 {item.loss}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#e1360a", margin: 0 }}>{formatCurrency(item.rev)}</p>
                <p style={{ fontSize: 10, color: "#a1a1aa", margin: "2px 0 0" }}>{(function() { var d = new Date(item.savedAt); return (d.getMonth()+1) + "/" + d.getDate() + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"); })()}</p>
              </div>
            </div>
          </div>
        );
      })}
      {show < list.length && <button onClick={function() { setShow(function(c) { return c + 10; }); }} style={Object.assign({}, BO, { width: "100%", textAlign: "center", fontSize: 12, color: "#71717a" })}>더 보기</button>}
      <Toast msg={toast} />
    </div>
  );
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

  useEffect(function() {
    Promise.all([
      store.get("ft-users", null), store.get("ft-settings", DEFAULT_SETTINGS),
      store.get("ft-attendance", {}), store.get("ft-reports", {}),
      store.get("ft-inv-items", []), store.get("ft-inv-stock", {}), store.get("ft-inv-requests", []),
      store.get("ft-gas", {}), store.get("ft-schedules", {}),
      store.get("ft-fixed-costs", []), store.get("ft-variable-costs", []),
      store.get("ft-production", []), store.get("ft-prod-settings", {})
    ]).then(function(res) {
      if (res[0]) {
        var needsMigration = false;
        var migrated = res[0].map(function(u) {
          if (!u.status) { needsMigration = true; return Object.assign({}, u, { status: "active" }); }
          return u;
        });
        setUsers(migrated);
        if (needsMigration) store.set("ft-users", migrated);
      } else {
        store.set("ft-users", DEFAULT_USERS);
      }
      setSettings(res[1]); setAttendance(res[2]); setReports(res[3]);
      setInventoryItems(res[4]); setInventoryStock(res[5]); setRequests(res[6]);
      setGasData(res[7]); setSchedules(res[8]);
      setFixedCosts(res[9]); setVarCosts(res[10]);
      setProduction(res[11]); setProdSettings(res[12]);
      setLoaded(true);
    });
  }, []);

  function login(pin) {
    var emp = users.find(function(e) { return e.pin === pin && (e.status || "active") === "active"; });
    if (emp) { setUser(emp); setTab(emp.role === "admin" ? "admin-home" : "vehicle"); return true; }
    return false;
  }

  if (!loaded) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}><p style={{ color: "#a1a1aa" }}>로딩 중...</p></div>;
  if (!user) return <LoginScreen onLogin={login} />;

  var isAdmin = user.role === "admin";
  var eTabs = [{ id: "vehicle", label: "내차량", icon: "🚛" }, { id: "inventory", label: "재고", icon: "📦" }, { id: "report", label: "일보", icon: "📋" }, { id: "salary", label: "급여", icon: "💵" }, { id: "revenue", label: "매출", icon: "💰" }];
  var aTabs = [{ id: "admin-home", label: "홈", icon: "🏠" }, { id: "admin-report", label: "일보", icon: "📋" }, { id: "admin-finance", label: "재무", icon: "💰" }, { id: "admin-chicken", label: "꼬치", icon: "🍗" }, { id: "admin-inv", label: "재고", icon: "📦" }, { id: "admin-emp", label: "직원", icon: "👥" }];
  var titles = { vehicle: "내 차량", report: "판매일보", salary: "급여", inventory: "재고", revenue: "매출", "admin-home": "홈", "admin-report": "직원 일보", "admin-finance": "재무", "admin-chicken": "꼬치 관리", "admin-inv": "재고 관리", "admin-emp": "직원 관리" };

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", maxWidth: 480, margin: "0 auto" }}>
      <Header title={titles[tab]} userName={user.name} onLogout={function() { setUser(null); setTab("vehicle"); }} />
      {!isAdmin && tab === "vehicle" && <EmpVehicle user={user} reports={reports} settings={settings} gasData={gasData} setGasData={setGasData} schedules={schedules} setSchedules={setSchedules} />}
      {!isAdmin && tab === "report" && <EmpReport user={user} reports={reports} setReports={setReports} settings={settings} />}
      {!isAdmin && tab === "salary" && <EmpSalary user={user} reports={reports} settings={settings} />}
      {!isAdmin && tab === "inventory" && <EmpInventory user={user} inventoryItems={inventoryItems} inventoryStock={inventoryStock} setInventoryStock={setInventoryStock} requests={requests} setRequests={setRequests} />}
      {!isAdmin && tab === "revenue" && <EmpRevenue user={user} reports={reports} settings={settings} />}
      {isAdmin && tab === "admin-home" && <AdminHome reports={reports} users={users} settings={settings} production={production} />}
      {isAdmin && tab === "admin-report" && <AdminReport reports={reports} setReports={setReports} users={users} settings={settings} />}
      {isAdmin && tab === "admin-finance" && <AdminFinance reports={reports} settings={settings} production={production} fixedCosts={fixedCosts} setFixedCosts={setFixedCosts} varCosts={varCosts} setVarCosts={setVarCosts} prodSettings={prodSettings} users={users} />}
      {isAdmin && tab === "admin-chicken" && <AdminChicken production={production} setProduction={setProduction} prodSettings={prodSettings} setProdSettings={setProdSettings} reports={reports} />}
      {isAdmin && tab === "admin-inv" && <AdminInventory inventoryItems={inventoryItems} setInventoryItems={setInventoryItems} inventoryStock={inventoryStock} setInventoryStock={setInventoryStock} requests={requests} setRequests={setRequests} users={users} />}
      {isAdmin && tab === "admin-emp" && <AdminEmployee users={users} setUsers={setUsers} settings={settings} setSettings={setSettings} schedules={schedules} setSchedules={setSchedules} reports={reports} setReports={setReports} />}
      <BottomNav tabs={isAdmin ? aTabs : eTabs} active={tab} onSelect={setTab} />
    </div>
  );
}

export default App;
