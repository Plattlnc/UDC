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
      .then(function() { return true; })
      .catch(function(e) { console.error(e); return false; });
  }
};
