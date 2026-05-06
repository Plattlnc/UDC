import { createClient } from '@supabase/supabase-js'

// ★ 여기에 본인의 Supabase URL과 anon key를 넣으세요
const SUPABASE_URL = 'https://ewgcdvsaptnifdwntqmc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Z2NkdnNhcHRuaWZkd250cW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTU5MzUsImV4cCI6MjA5MDYzMTkzNX0.HOn5yognTZ6oIQgOQ3BH8qdMYR8v6heEJHHFBMrtOy0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─────────────────────────────────────────────────────────────────────────
// PostgreSQL error code 가드 — 클라이언트 측 입력 오류는 큐 적재 X
// 23xxx: integrity constraint violation (CHECK, FK, UNIQUE, NOT NULL)
// 22xxx: data exception (numeric_value_out_of_range, invalid_datetime_format)
// 42xxx: syntax error / access rule violation
// 그 외 (PGRST/네트워크/일시 장애)는 큐 적재 → 자동 재시도 (현행 안전망 유지)
// ─────────────────────────────────────────────────────────────────────────
export function isClientError(error) {
  if (!error) return false;
  var code = String(error.code || "");
  return code.indexOf("22") === 0
      || code.indexOf("23") === 0
      || code.indexOf("42") === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// app_data 응급 큐: store.set/merge 실패시 누적 저장 → 부팅/online 시 재시도
// reports 큐와 동일 패턴. 30+ store.set 호출부를 fire-and-forget으로 두어도
// 자동 enqueue 안전망이 silent fail로 인한 데이터 손실을 차단.
// ─────────────────────────────────────────────────────────────────────────
var APPDATA_PENDING_KEY = "ft-pending-app-data";

function _readAppDataPending() {
  try {
    var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(APPDATA_PENDING_KEY) : null;
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch(e) {
    console.error('[pendingAppData] read 실패:', e);
    return [];
  }
}

function _writeAppDataPending(arr) {
  try {
    if (typeof localStorage === "undefined") return;
    if (!Array.isArray(arr) || arr.length === 0) {
      localStorage.removeItem(APPDATA_PENDING_KEY);
    } else {
      localStorage.setItem(APPDATA_PENDING_KEY, JSON.stringify(arr));
    }
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent('pending-app-data-changed', {
          detail: { count: Array.isArray(arr) ? arr.length : 0 }
        }));
      } catch(_) {}
    }
  } catch(e) {
    console.error('[pendingAppData] write 실패:', e);
  }
}

// entry: { key, value, op } — op: "set" | "merge"
// 같은 key는 최신 entry로 교체 (사용자 의도 우선, 앱 도메인 로직에 합당)
export function enqueuePendingAppData(entry) {
  if (!entry || !entry.key) return 0;
  var arr = _readAppDataPending();
  var idx = arr.findIndex(function(x) { return x && x.key === entry.key; });
  if (idx >= 0) arr[idx] = entry;
  else arr.push(entry);
  _writeAppDataPending(arr);
  return arr.length;
}

export function getPendingAppDataCount() {
  return _readAppDataPending().length;
}

// 큐 순회 → set/merge 재시도. 성공만 큐에서 제거.
// op === "merge" 인 entry는 flush 시점에 fresh GET → re-merge → SET
//   (다른 클라가 중간에 값을 바꿨을 가능성을 반영)
// 반환: { tried, succeeded, remaining }
export function flushPendingAppData() {
  var arr = _readAppDataPending();
  if (arr.length === 0) return Promise.resolve({ tried: 0, succeeded: 0, remaining: 0 });
  var succeeded = 0;
  var remaining = [];

  function done(entry, ok) {
    if (ok) succeeded++;
    else remaining.push(entry);
  }

  function step(i) {
    if (i >= arr.length) {
      _writeAppDataPending(remaining);
      return { tried: arr.length, succeeded: succeeded, remaining: remaining.length };
    }
    var entry = arr[i];
    if (entry.op === 'merge') {
      return store.get(entry.key, {}).then(function(current) {
        var merged = _doMerge(current, entry.value);
        return _attemptAppDataSet(entry.key, merged).then(function(r) {
          done(entry, r.ok);
          return step(i + 1);
        });
      });
    }
    return _attemptAppDataSet(entry.key, entry.value).then(function(r) {
      done(entry, r.ok);
      return step(i + 1);
    });
  }
  return Promise.resolve(step(0));
}

// ─── store 내부 헬퍼 ─────────────────────────────────────────────────────
function _attemptAppDataSet(key, value) {
  return supabase
    .from('app_data')
    .upsert({ key: key, value: value, updated_at: new Date().toISOString() })
    .then(function(res) {
      if (res.error) return { ok: false, error: res.error };
      return { ok: true };
    })
    .catch(function(e) { return { ok: false, error: e }; });
}

// 1회 재시도 포함. transient 네트워크 보완용.
// 반환: { ok: true } 또는 { ok: false, message, error } — error는 마지막 실패 객체 (code 포함)
function _setWithRetry(key, value) {
  return _attemptAppDataSet(key, value).then(function(r1) {
    if (r1.ok) return { ok: true };
    console.error('[store.set] 1차 실패:', key, r1.error && r1.error.message ? r1.error.message : r1.error);
    // client error는 재시도해도 어차피 fail → 즉시 반환 (T-K)
    if (isClientError(r1.error)) {
      return { ok: false, message: r1.error.message || "입력 오류", error: r1.error };
    }
    return _attemptAppDataSet(key, value).then(function(r2) {
      if (r2.ok) return { ok: true };
      console.error('[store.set] 재시도 실패:', key, r2.error && r2.error.message ? r2.error.message : r2.error);
      var msg = (r2.error && r2.error.message) ? r2.error.message
              : (r1.error && r1.error.message) ? r1.error.message
              : "네트워크 오류";
      return { ok: false, message: msg, error: r2.error || r1.error };
    });
  });
}

// merge 헬퍼 (current ⊕ partialData) — 기존 store.merge 로직 추출
function _doMerge(current, partialData) {
  if (!current || typeof current !== "object" || Array.isArray(current)) return partialData;
  var merged = Object.assign({}, current);
  if (!partialData || typeof partialData !== "object") return merged;
  Object.keys(partialData).forEach(function(k) {
    if (partialData[k] === null || partialData[k] === undefined) {
      delete merged[k];
    } else if (typeof partialData[k] === "object" && !Array.isArray(partialData[k]) && merged[k] && typeof merged[k] === "object") {
      merged[k] = Object.assign({}, merged[k], partialData[k]);
    } else {
      merged[k] = partialData[k];
    }
  });
  return merged;
}

// window.storage 호환 레이어
//   • store.set / store.merge: legacy 시그니처 (Promise<boolean>) — 30+ 호출부 호환.
//     실패시 자동으로 응급 큐에 enqueue (호출부가 결과 미검사여도 안전망)
//   • store.setWithError / store.mergeWithError: { ok, message? } 반환 — UI 토스트용.
//     호출부가 결과를 명시적으로 처리할 수 있고, 자동 enqueue X (caller 책임)
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
    return _setWithRetry(key, value).then(function(r) {
      if (r.ok) return true;
      // T-K 가드: client error(check/FK/UNIQUE/syntax)는 큐에 들어가도 영원히 fail → 우회
      if (isClientError(r.error)) {
        console.warn('[store.set] client error (큐 우회):', key, r.error && r.error.code, r.message);
        return false;
      }
      // 안전망: 호출부 결과 미검사 가능성 → 자동 enqueue (네트워크 등 transient만)
      enqueuePendingAppData({ key: key, value: value, op: 'set' });
      return false;
    });
  },
  setWithError: function(key, value) {
    return _setWithRetry(key, value);
  },
  merge: function(key, partialData, fallback) {
    return store.get(key, fallback || {}).then(function(current) {
      var merged = _doMerge(current, partialData);
      return _setWithRetry(key, merged).then(function(r) {
        if (r.ok) return merged;
        // T-K 가드 동일
        if (isClientError(r.error)) {
          console.warn('[store.merge] client error (큐 우회):', key, r.error && r.error.code, r.message);
          return false;
        }
        // 안전망: partialData를 큐에 → flush 시 fresh GET + re-merge로 재시도
        enqueuePendingAppData({ key: key, value: partialData, op: 'merge' });
        return false;
      });
    });
  },
  mergeWithError: function(key, partialData, fallback) {
    return store.get(key, fallback || {}).then(function(current) {
      var merged = _doMerge(current, partialData);
      return _setWithRetry(key, merged).then(function(r) {
        if (r.ok) return { ok: true, value: merged };
        return { ok: false, message: r.message, error: r.error };
      });
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// 응급 localStorage 큐: upsert 실패 row를 누적 저장 → 부팅/online 시 재시도
// 데이터 영구 손실 방지 안전망. 단말이 살아있는 한 4일치 손실 같은 사고 재발 X.
// ─────────────────────────────────────────────────────────────────────────
var PENDING_KEY = "ft-pending-reports";

function _readPending() {
  try {
    var raw = (typeof localStorage !== "undefined") ? localStorage.getItem(PENDING_KEY) : null;
    if (!raw) return [];
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch(e) {
    console.error('[pendingReports] read 실패:', e);
    return [];
  }
}

function _writePending(arr) {
  try {
    if (typeof localStorage === "undefined") return;
    if (!Array.isArray(arr) || arr.length === 0) {
      localStorage.removeItem(PENDING_KEY);
    } else {
      localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
    }
    // App.jsx에 큐 길이 변동을 알림 (영구 배지 갱신용)
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent('pending-reports-changed', {
          detail: { count: Array.isArray(arr) ? arr.length : 0 }
        }));
      } catch(_) {}
    }
  } catch(e) {
    console.error('[pendingReports] write 실패:', e);
  }
}

// 호출 측: upsert 실패 시 row를 큐에 넣어둠.
// 같은 id가 이미 있으면 최신본으로 교체 (덮어쓰기 = 사용자 의도).
export function enqueuePendingReport(row) {
  if (!row || !row.id) return 0;
  var arr = _readPending();
  var idx = arr.findIndex(function(x) { return x && x.id === row.id; });
  if (idx >= 0) arr[idx] = row;
  else arr.push(row);
  _writePending(arr);
  return arr.length;
}

export function getPendingReportsCount() {
  return _readPending().length;
}

// 큐를 순차로 재시도. 성공한 row는 큐에서 제거. 실패는 그대로 보존.
// 반환: { tried, succeeded, remaining }
export function flushPendingReports() {
  var arr = _readPending();
  if (arr.length === 0) return Promise.resolve({ tried: 0, succeeded: 0, remaining: 0 });
  var succeeded = 0;
  var remaining = [];

  function step(i) {
    if (i >= arr.length) {
      _writePending(remaining);
      return { tried: arr.length, succeeded: succeeded, remaining: remaining.length };
    }
    var row = arr[i];
    return supabase.from('reports').upsert(row).then(function(res) {
      if (res.error) {
        console.error('[flushPending] row 실패:', row.id, res.error.message);
        remaining.push(row);
      } else {
        succeeded++;
      }
      return step(i + 1);
    }).catch(function(e) {
      console.error('[flushPending] 네트워크 실패:', row.id, e);
      remaining.push(row);
      return step(i + 1);
    });
  }
  return Promise.resolve(step(0));
}

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
  // transient 네트워크 보완용 1회 재시도 + 응급 큐와 공존.
  // T-K: client error(check/FK/UNIQUE/syntax)는 1차에서 즉시 false (재시도/큐 우회).
  upsert: function(report) {
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
      if (r1.ok) return true;
      console.error('[reportStore.upsert] 1차 실패:', r1.error && r1.error.message ? r1.error.message : r1.error);
      // T-K: client error는 재시도/큐 모두 우회
      if (isClientError(r1.error)) {
        console.warn('[reportStore.upsert] client error (큐 우회):', r1.error.code, r1.error.message);
        return false;
      }
      return attempt().then(function(r2) {
        if (r2.ok) return true;
        console.error('[reportStore.upsert] 재시도 실패:', r2.error && r2.error.message ? r2.error.message : r2.error);
        // T-K: 재시도 후 발견된 client error도 큐 우회
        if (isClientError(r2.error)) {
          console.warn('[reportStore.upsert] client error 재시도 (큐 우회):', r2.error.code, r2.error.message);
          return false;
        }
        // 안전망: transient 실패만 큐에 적재 (fire-and-forget 경로 보호)
        try { enqueuePendingReport(report); } catch(_) {}
        return false;
      });
    });
  },
  // 실패 사유 메시지 + error 객체까지 반환 (UI 토스트용 + isClientError 체크용).
  // 1회 재시도 포함. T-K 가드 적용.
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
      // T-K: client error는 재시도 우회
      if (isClientError(r1.error)) {
        return { ok: false, message: r1.error.message || "입력 오류", error: r1.error };
      }
      return attempt().then(function(r2) {
        if (r2.ok) return { ok: true };
        console.error('[reportStore.upsert] 재시도 실패:', r2.error && r2.error.message ? r2.error.message : r2.error);
        var msg = (r2.error && r2.error.message) ? r2.error.message
                : (r1.error && r1.error.message) ? r1.error.message
                : "네트워크 오류";
        return { ok: false, message: msg, error: r2.error || r1.error };
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
          // 반품 (Task #16, 마이그레이션 006). 미적용 환경에선 undefined → 0
          return_sunsal: Number(r.return_sunsal) || 0,
          return_padak: Number(r.return_padak) || 0,
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
      // 반품 (Task #16). 마이그레이션 006 적용 전 환경에서도 0 default 안전.
      return_sunsal: parseInt(data.return_sunsal, 10) || 0,
      return_padak: parseInt(data.return_padak, 10) || 0,
      saved_at: data.savedAt || new Date().toISOString()
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────
// inventoryEvents helper (Task #16, T-D + T-E)
// 의존: 004_inventory_events_ledger.sql 적용
// 미적용 환경에서는 42P01 (relation 없음) → isClientError true → 큐 우회 + 콘솔 경고
// ─────────────────────────────────────────────────────────────────────────
export var inventoryEvents = {
  // INSERT 1건. 같은 (source_kind, source_id, event_type, sku) UNIQUE — 재시도 멱등.
  // 반환: { ok: true, data } 또는 { ok: false, error, message } (T-K 가드용)
  log: function(payload) {
    if (!payload || !payload.event_type || !payload.sku || !payload.qty) {
      return Promise.resolve({ ok: false, error: { code: 'CLIENT_VALIDATION', message: '필수 필드 누락' }, message: '필수 필드 누락' });
    }
    var row = {
      event_type: payload.event_type,
      sku: payload.sku,
      qty: parseInt(payload.qty, 10),
      source_kind: payload.source_kind || null,
      source_id: payload.source_id || null,
      source_user_id: payload.source_user_id || null,
      occurred_on: payload.occurred_on,
      note: payload.note || null
    };
    return supabase
      .from('inventory_events')
      .insert(row)
      .select()
      .single()
      .then(function(res) {
        if (res.error) {
          // UNIQUE 위반(23505): 이미 동일 source의 이벤트 존재 → 멱등 성공으로 취급
          if (String(res.error.code || '') === '23505') {
            console.log('[inventoryEvents.log] dup ignored (idempotent):', payload.event_type, payload.sku, payload.source_id);
            return { ok: true, data: null, idempotent: true };
          }
          console.error('[inventoryEvents.log] 실패:', res.error.code, res.error.message);
          return { ok: false, error: res.error, message: res.error.message };
        }
        return { ok: true, data: res.data };
      })
      .catch(function(e) {
        console.error('[inventoryEvents.log] 네트워크 오류:', e);
        return { ok: false, error: e, message: (e && e.message) || '네트워크 오류' };
      });
  },
  // sku별 현재 재고 합계 — view inventory_balance 조회.
  balance: function(sku) {
    var q = supabase.from('inventory_balance').select('*');
    if (sku) q = q.eq('sku', sku);
    return q.then(function(res) {
      if (res.error) {
        console.error('[inventoryEvents.balance] 실패:', res.error.message);
        return { ok: false, error: res.error };
      }
      return { ok: true, data: res.data || [] };
    }).catch(function(e) { return { ok: false, error: e }; });
  },
  // 일별 잔량 — view inventory_daily_balance.
  dailyBalance: function(sku, fromDate) {
    var q = supabase.from('inventory_daily_balance').select('*');
    if (sku) q = q.eq('sku', sku);
    if (fromDate) q = q.gte('occurred_on', fromDate);
    return q.then(function(res) {
      if (res.error) return { ok: false, error: res.error };
      return { ok: true, data: res.data || [] };
    }).catch(function(e) { return { ok: false, error: e }; });
  },
  // 검증 경고: returned > shipped 케이스 (직원/일별/sku별)
  warnings: function() {
    return supabase
      .from('inventory_warnings_returned_exceeds_shipped')
      .select('*')
      .then(function(res) {
        if (res.error) {
          console.error('[inventoryEvents.warnings] 실패:', res.error.message);
          return { ok: false, error: res.error, data: [] };
        }
        return { ok: true, data: res.data || [] };
      })
      .catch(function(e) { return { ok: false, error: e, data: [] }; });
  },
  // Realtime 채널 구독 (subscribeReports 패턴 그대로)
  // 의존: 004 publication + REPLICA IDENTITY FULL
  subscribe: function(opts) {
    opts = opts || {};
    var channel = supabase.channel("inventory-events-changes")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "inventory_events" },
          function(payload) {
            try {
              var et = payload.eventType;
              if (et === "INSERT" && opts.onInsert) opts.onInsert(payload.new);
              else if (et === "UPDATE" && opts.onUpdate) opts.onUpdate(payload.new);
              else if (et === "DELETE" && opts.onDelete) opts.onDelete(payload.old || {});
            } catch(e) { console.error('[realtime] inventory_events 페이로드 오류:', e); }
          })
      .subscribe(function(status) {
        console.log('[realtime] inventory_events channel:', status);
        if (opts.onStatus) { try { opts.onStatus(status); } catch(_) {} }
      });
    return function unsubscribe() {
      try { supabase.removeChannel(channel); } catch(e) { console.error('[realtime] removeChannel(inv) 오류:', e); }
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Realtime 구독: reports 테이블 변경을 관리자 화면에서 실시간 수신
// 의존: 003_reports_realtime.sql 적용 (publication + REPLICA IDENTITY FULL)
// 미적용 상태에서도 SUBSCRIBED 자체는 정상이고 단순히 이벤트가 안 옴
// (idempotent — 진단 쉬워지도록 status 콜백으로 외부 통보)
// ─────────────────────────────────────────────────────────────────────────
export function subscribeReports(opts) {
  opts = opts || {};
  var channel = supabase.channel("reports-changes")
    .on("postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        function(payload) {
          try {
            var et = payload.eventType;
            if (et === "INSERT" && opts.onInsert) opts.onInsert(payload.new);
            else if (et === "UPDATE" && opts.onUpdate) opts.onUpdate(payload.new);
            else if (et === "DELETE" && opts.onDelete) opts.onDelete(payload.old || {});
          } catch(e) {
            console.error('[realtime] payload 처리 오류:', e);
          }
        })
    .subscribe(function(status) {
      // 상태: SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED
      console.log('[realtime] reports channel:', status);
      if (opts.onStatus) {
        try { opts.onStatus(status); } catch(_) {}
      }
    });
  return function unsubscribe() {
    try { supabase.removeChannel(channel); } catch(e) { console.error('[realtime] removeChannel 오류:', e); }
  };
}

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
