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
