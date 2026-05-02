import { createClient } from '@supabase/supabase-js'

// ★ 여기에 본인의 Supabase URL과 anon key를 넣으세요
const SUPABASE_URL = 'https://ewgcdvsaptnifdwntqmc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Z2NkdnNhcHRuaWZkd250cW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTU5MzUsImV4cCI6MjA5MDYzMTkzNX0.HOn5yognTZ6oIQgOQ3BH8qdMYR8v6heEJHHFBMrtOy0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// window.storage 호환 레이어
export const store = {
  get: function(key, fallback) {
    return supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .single()
      .then(function(res) {
        return res.data ? res.data.value : fallback;
      })
      .catch(function() { return fallback; });
  },
  set: function(key, value) {
    return supabase
      .from('app_data')
      .upsert({ key: key, value: value, updated_at: new Date().toISOString() })
      .then(function(res) {
        if (res.error) {
          console.error('[store.set] 저장 실패:', key, res.error.message);
          // 1회 재시도
          return supabase
            .from('app_data')
            .upsert({ key: key, value: value, updated_at: new Date().toISOString() })
            .then(function(r2) {
              if (r2.error) { console.error('[store.set] 재시도 실패:', key, r2.error.message); return false; }
              return true;
            });
        }
        return true;
      })
      .catch(function(e) { console.error('[store.set] 네트워크 오류:', key, e); return false; });
  },
  merge: function(key, partialData, fallback) {
    return store.get(key, fallback || {}).then(function(current) {
      var merged;
      if (current && typeof current === "object" && !Array.isArray(current)) {
        merged = Object.assign({}, current);
        Object.keys(partialData).forEach(function(k) {
          if (partialData[k] === null || partialData[k] === undefined) {
            delete merged[k];
          } else if (typeof partialData[k] === "object" && !Array.isArray(partialData[k]) && merged[k] && typeof merged[k] === "object") {
            merged[k] = Object.assign({}, merged[k], partialData[k]);
          } else {
            merged[k] = partialData[k];
          }
        });
      } else {
        merged = partialData;
      }
      return store.set(key, merged).then(function(ok) { return ok ? merged : false; });
    });
  }
};

// In-flight 추적: visibility reload race 가드 (App.jsx와 공유)
// upsert/remove 진행 중인 key를 보존해서, reload 결과가 stale이어도 덮어쓰지 못하게 한다.
var _inflightUpserts = new Map();   // key -> { date, data }
var _inflightDeletes = new Set();   // key (방금 삭제 요청 중)

export function markInflightUpsert(key, date, data) {
  if (!key) return;
  _inflightUpserts.set(key, { date: date, data: data });
}
export function clearInflightUpsert(key) {
  if (!key) return;
  _inflightUpserts.delete(key);
}
export function markInflightDelete(key) {
  if (!key) return;
  _inflightDeletes.add(key);
}
export function clearInflightDelete(key) {
  if (!key) return;
  _inflightDeletes.delete(key);
}

// reportStore.toReportsObj 결과에 in-flight 변경분을 덮어씌운다.
// 호출 측 (visibility reload)에서 setReports 직전에 사용.
export function applyInflightOverlay(reportsObj) {
  var out = reportsObj && typeof reportsObj === "object" ? Object.assign({}, reportsObj) : {};
  // upsert 보존
  _inflightUpserts.forEach(function(entry, key) {
    if (!entry || !entry.date) return;
    if (!out[entry.date]) out[entry.date] = {};
    else out[entry.date] = Object.assign({}, out[entry.date]);
    // 서버보다 in-flight를 신뢰 (방금 사용자가 저장 시도)
    out[entry.date][key] = entry.data;
  });
  // delete 보존: 방금 삭제 요청한 key는 reload 결과에서도 제거
  _inflightDeletes.forEach(function(key) {
    Object.keys(out).forEach(function(date) {
      if (out[date] && out[date][key]) {
        out[date] = Object.assign({}, out[date]);
        delete out[date][key];
        if (Object.keys(out[date]).length === 0) delete out[date];
      }
    });
  });
  return out;
}

// reports 전용 CRUD (개별 row 저장)
export var reportStore = {
  getAll: function() {
    return supabase
      .from('reports')
      .select('*')
      .order('date', { ascending: false })
      .then(function(res) {
        if (res.error) {
          console.error('[reportStore.getAll] 실패:', res.error.message);
          return null;
        }
        return res.data || [];
      })
      .catch(function(e) { console.error('[reportStore.getAll] 네트워크 오류:', e); return null; });
  },
  // 1회 재시도 포함. 호출 측은 반환 Promise<boolean>을 반드시 await/then 으로 확인할 것.
  upsert: function(report) {
    function attempt() {
      return supabase
        .from('reports')
        .upsert(report)
        .then(function(res) {
          if (res.error) {
            return { ok: false, error: res.error };
          }
          return { ok: true };
        })
        .catch(function(e) { return { ok: false, error: e }; });
    }
    return attempt().then(function(r1) {
      if (r1.ok) return true;
      console.error('[reportStore.upsert] 1차 실패:', r1.error && r1.error.message ? r1.error.message : r1.error);
      return attempt().then(function(r2) {
        if (r2.ok) return true;
        console.error('[reportStore.upsert] 재시도 실패:', r2.error && r2.error.message ? r2.error.message : r2.error);
        return false;
      });
    });
  },
  // 가장 최근 upsert 실패 사유 메시지 헬퍼 (UI 토스트용)
  upsertWithError: function(report) {
    function attempt() {
      return supabase
        .from('reports')
        .upsert(report)
        .then(function(res) {
          if (res.error) return { ok: false, error: res.error };
          return { ok: true };
        })
        .catch(function(e) { return { ok: false, error: e }; });
    }
    return attempt().then(function(r1) {
      if (r1.ok) return { ok: true };
      console.error('[reportStore.upsert] 1차 실패:', r1.error && r1.error.message ? r1.error.message : r1.error);
      return attempt().then(function(r2) {
        if (r2.ok) return { ok: true };
        console.error('[reportStore.upsert] 재시도 실패:', r2.error && r2.error.message ? r2.error.message : r2.error);
        return { ok: false, message: (r2.error && r2.error.message) ? r2.error.message : (r1.error && r1.error.message) ? r1.error.message : "네트워크 오류" };
      });
    });
  },
  remove: function(id) {
    return supabase
      .from('reports')
      .delete()
      .eq('id', id)
      .then(function(res) {
        if (res.error) {
          console.error('[reportStore.delete] 실패:', res.error.message);
          return false;
        }
        return true;
      })
      .catch(function(e) { console.error('[reportStore.delete] 네트워크 오류:', e); return false; });
  },
  // rows → 기존 reports 객체 형태 변환
  toReportsObj: function(rows) {
    var obj = {};
    if (!Array.isArray(rows)) return obj;
    rows.forEach(function(r) {
      try {
        var d = r.date;
        if (!d || !r.id) return;
        if (!obj[d]) obj[d] = {};
        obj[d][r.id] = {
          userId: r.user_id || "",
          employeeName: r.employee_name || "",
          clockIn: r.clock_in || "",
          clockOut: r.clock_out || "",
          ship_sunsal: Number(r.ship_sunsal) || 0,
          ship_padak: Number(r.ship_padak) || 0,
          sunsal: Number(r.sunsal) || 0,
          padak: Number(r.padak) || 0,
          loss: Number(r.loss) || 0,
          chobeol: Number(r.chobeol) || 0,
          transfer: Number(r.transfer) || 0,
          cash: Number(r.cash) || 0,
          memo: r.memo || "",
          paid: !!r.paid,
          payOverride: r.pay_override !== null && r.pay_override !== undefined ? Number(r.pay_override) : undefined,
          savedAt: r.saved_at || r.created_at || new Date().toISOString()
        };
      } catch(e) {
        console.error('[toReportsObj] row 변환 오류:', r, e);
      }
    });
    return obj;
  },
  // 기존 형태 → row 변환
  toRow: function(id, date, data) {
    if (!data || typeof data !== "object") data = {};
    return {
      id: id,
      date: date,
      user_id: data.userId || "",
      employee_name: data.employeeName || "",
      clock_in: data.clockIn || "",
      clock_out: data.clockOut || "",
      ship_sunsal: parseInt(data.ship_sunsal, 10) || 0,
      ship_padak: parseInt(data.ship_padak, 10) || 0,
      sunsal: parseInt(data.sunsal, 10) || 0,
      padak: parseInt(data.padak, 10) || 0,
      loss: parseInt(data.loss, 10) || 0,
      chobeol: parseInt(data.chobeol, 10) || 0,
      transfer: parseInt(data.transfer, 10) || 0,
      cash: parseInt(data.cash, 10) || 0,
      memo: data.memo || "",
      paid: !!data.paid,
      pay_override: data.payOverride !== undefined && data.payOverride !== null ? Number(data.payOverride) : null,
      saved_at: data.savedAt || new Date().toISOString()
    };
  }
};

// Google Sheets 동기화
export function getSheetsUrl() {
  return localStorage.getItem("ft-sheets-url") || "";
}

export function setSheetsUrl(url) {
  localStorage.setItem("ft-sheets-url", url);
}

export function syncToSheets(payload) {
  var url = getSheetsUrl();
  if (!url) return Promise.reject(new Error("Sheets URL 미설정"));
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "sync_all", payload: payload })
  }).then(function(res) { return res.json(); });
}

export function readFromSheets() {
  var url = getSheetsUrl();
  if (!url) return Promise.reject(new Error("Sheets URL 미설정"));
  return fetch(url + "?action=readReports")
    .then(function(res) { return res.json(); });
}
