-- UDC reports 테이블 마이그레이션
-- Supabase SQL Editor에서 실행

-- 1. reports 테이블 생성
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  user_id TEXT NOT NULL,
  employee_name TEXT,
  clock_in TEXT,
  clock_out TEXT,
  ship_sunsal INTEGER DEFAULT 0,
  ship_padak INTEGER DEFAULT 0,
  sunsal INTEGER DEFAULT 0,
  padak INTEGER DEFAULT 0,
  loss INTEGER DEFAULT 0,
  chobeol INTEGER DEFAULT 0,
  transfer INTEGER DEFAULT 0,
  cash INTEGER DEFAULT 0,
  memo TEXT,
  paid BOOLEAN DEFAULT FALSE,
  pay_override INTEGER,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

-- 3. RLS (anon key 사용)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON reports FOR ALL USING (true) WITH CHECK (true);

-- 4. 기존 ft-reports 데이터 마이그레이션
-- app_data에 저장된 JSON blob을 개별 row로 변환
DO $$
DECLARE
  reports_json JSONB;
  date_key TEXT;
  report_key TEXT;
  report_data JSONB;
  date_obj JSONB;
BEGIN
  SELECT value::JSONB INTO reports_json
  FROM app_data
  WHERE key = 'ft-reports';

  IF reports_json IS NULL THEN
    RAISE NOTICE 'ft-reports 데이터 없음, 건너뜀';
    RETURN;
  END IF;

  FOR date_key IN SELECT jsonb_object_keys(reports_json) LOOP
    date_obj := reports_json->date_key;
    FOR report_key IN SELECT jsonb_object_keys(date_obj) LOOP
      report_data := date_obj->report_key;
      INSERT INTO reports (id, date, user_id, employee_name, clock_in, clock_out,
        ship_sunsal, ship_padak, sunsal, padak, loss, chobeol, transfer, cash,
        memo, paid, pay_override, saved_at)
      VALUES (
        report_key,
        date_key::DATE,
        COALESCE(report_data->>'userId', ''),
        COALESCE(report_data->>'employeeName', ''),
        COALESCE(report_data->>'clockIn', ''),
        COALESCE(report_data->>'clockOut', ''),
        COALESCE((report_data->>'ship_sunsal')::INTEGER, 0),
        COALESCE((report_data->>'ship_padak')::INTEGER, 0),
        COALESCE((report_data->>'sunsal')::INTEGER, 0),
        COALESCE((report_data->>'padak')::INTEGER, 0),
        COALESCE((report_data->>'loss')::INTEGER, 0),
        COALESCE((report_data->>'chobeol')::INTEGER, 0),
        COALESCE((report_data->>'transfer')::INTEGER, 0),
        COALESCE((report_data->>'cash')::INTEGER, 0),
        COALESCE(report_data->>'memo', ''),
        COALESCE((report_data->>'paid')::BOOLEAN, FALSE),
        (report_data->>'payOverride')::INTEGER,
        COALESCE((report_data->>'savedAt')::TIMESTAMPTZ, NOW())
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE '마이그레이션 완료';
END $$;
