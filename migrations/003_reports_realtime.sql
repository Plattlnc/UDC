-- ============================================================================
-- UDC Migration 003: reports 테이블을 supabase_realtime publication에 추가
-- ============================================================================
-- 작성: database (trio-dev)
-- 일자: 2026-05-02
-- 목적: Task #5 (관리자 화면 Realtime 일보 구독) 사전 작업
-- 적용: Supabase Studio → SQL Editor → 본 파일 전체 붙여넣기 → Run
-- 프로젝트: ewgcdvsaptnifdwntqmc
--
-- ── Task #1 진단 요약 ──
--   - 스키마: id TEXT PRIMARY KEY (정상, 변경 불필요)
--   - RLS: anon FOR ALL USING(true) WITH CHECK(true) (정상, 변경 불필요)
--   - NOT NULL 위반 row: 0건 (정상)
--   - 백업 복구 데이터: 29 rows (saved_at/created_at NULL=0)
--   - **유일한 누락**: supabase_realtime publication에 reports 미포함
--
-- ── 본 마이그레이션이 변경하는 것 ──
--   1. supabase_realtime publication에 reports 테이블 추가 (idempotent)
--   2. reports 테이블 REPLICA IDENTITY FULL 설정
--      → UPDATE/DELETE 이벤트에서 row 전체 페이로드 전송 (PK만 보내는 기본값 회피)
--
-- ── 본 마이그레이션이 절대 변경하지 않는 것 ──
--   - 데이터 row (29건 백업 복구분 100% 보존)
--   - 컬럼 타입/이름/순서
--   - PRIMARY KEY / 인덱스
--   - 기존 RLS 정책 ("Allow all")
--   - app_data 테이블의 ft-reports legacy blob (App.jsx fallback 보장)
-- ============================================================================


-- ============================================================================
-- STEP 0. 사전 검증 (Dry-run, 실행 권장)
-- ============================================================================
-- 아래 4개 SELECT를 먼저 실행해서 결과를 team-lead에게 공유 후 진행.
-- 어느 하나라도 unexpected 결과면 STOP.

-- 0-1. reports row 카운트 (백업 복구 데이터 사전 보존 확인용 베이스라인)
--      기대값: 29 (Task #1 진단 시점). 진행 전후 동일해야 함.
-- SELECT count(*) AS baseline_row_count FROM public.reports;

-- 0-2. 현재 supabase_realtime publication에 reports가 있는지 확인
--      기대값: 0 row (즉, 아직 미포함 → 본 마이그레이션 필요)
--      이미 1 row 반환되면 STEP 1은 NOOP이지만 IF NOT EXISTS 가드로 안전.
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' AND tablename = 'reports';

-- 0-3. reports REPLICA IDENTITY 현재값 확인
--      'd' = DEFAULT(PK only), 'f' = FULL, 'n' = NOTHING, 'i' = USING INDEX
--      기대값: 'd' (기본값) → STEP 2에서 'f'로 변경
-- SELECT relname, relreplident
-- FROM pg_class
-- WHERE relname = 'reports' AND relnamespace = 'public'::regnamespace;

-- 0-4. RLS 정책 현황 (변경하지 않지만 negative test 베이스라인용)
-- SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck
-- FROM pg_policy
-- WHERE polrelid = 'public.reports'::regclass;


-- ============================================================================
-- STEP 1. supabase_realtime publication에 reports 추가 (idempotent)
-- ============================================================================
-- ALTER PUBLICATION ADD TABLE은 이미 추가된 경우 에러를 내므로 DO 블록으로 가드.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
    RAISE NOTICE '✓ public.reports → supabase_realtime publication 추가 완료';
  ELSE
    RAISE NOTICE '· public.reports는 이미 supabase_realtime publication에 포함됨 (skip)';
  END IF;
END $$;


-- ============================================================================
-- STEP 2. REPLICA IDENTITY FULL 설정
-- ============================================================================
-- Realtime에서 UPDATE/DELETE 이벤트가 PK뿐 아니라 변경 전 row 전체를 전달하도록
-- 함. 기본값 DEFAULT(=PK only)이면 클라이언트가 UPDATE 후 변경된 컬럼을 정확히
-- 알 수 없음. UDC 관리자 뷰에서 row diff 표시가 필요할 가능성을 대비.
-- 비용: 디스크 WAL 약간 증가, 트랜잭션 성능 무시할 수 있는 수준.

ALTER TABLE public.reports REPLICA IDENTITY FULL;


-- ============================================================================
-- STEP 3. 사후 검증 (필수, 실행 후 결과 캡처해서 team-lead에 첨부)
-- ============================================================================

-- 3-1. publication 포함 확인 (기대값: 1 row)
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'reports';

-- 3-2. REPLICA IDENTITY 변경 확인 (기대값: 'f')
SELECT
  relname,
  CASE relreplident
    WHEN 'd' THEN 'DEFAULT (PK only)'
    WHEN 'f' THEN 'FULL ✓'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'i' THEN 'INDEX'
  END AS replica_identity
FROM pg_class
WHERE relname = 'reports' AND relnamespace = 'public'::regnamespace;

-- 3-3. 데이터 보존 확인 (반드시 STEP 0-1과 동일해야 함)
SELECT count(*) AS post_migration_row_count FROM public.reports;


-- ============================================================================
-- ROLLBACK (필요 시)
-- ============================================================================
-- 만약 publication 추가가 의도치 않은 사이드이펙트(예: realtime 비용 폭증)를
-- 일으키면 아래 두 줄로 즉시 원복 가능. 데이터 손실 없음.
--
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.reports;
--   ALTER TABLE public.reports REPLICA IDENTITY DEFAULT;


-- ============================================================================
-- 참고: 현재 RLS 정책 ("Allow all") 보안 노트
-- ============================================================================
-- 본 마이그레이션은 RLS 정책을 건드리지 않습니다. 이유:
--   - Task #1 트리거 조건("anon role에 INSERT/UPDATE/DELETE/SELECT 정책 누락")이
--     충족되지 않음 (FOR ALL USING(true) WITH CHECK(true)가 이미 존재)
--   - UDC는 Supabase Auth를 사용하지 않고 app_data 테이블에 자체 user 객체를
--     저장하는 구조. anon key가 모든 클라이언트에 노출되므로 RLS로 user_id별
--     쓰기 제한을 걸어도 클라이언트가 임의 user_id를 보낼 수 있어 의미 없음.
--
-- ── 알려진 보안 취약점 (별도 작업으로 격상 권장) ──
--   1. 외부에서 anon key만 알면 누구나 reports row INSERT/UPDATE/DELETE 가능
--   2. user_id를 위조한 INSERT를 차단할 방법 없음
--   3. 일보 데이터 외부 SELECT 가능 (개인정보/매출 노출)
--
-- ── 근본 해결 방향 (장기) ──
--   - Supabase Auth 도입 후 auth.uid() 기반 RLS 재작성
--   - 또는 service_role 키를 가진 백엔드 BFF 추가 후 anon SELECT/INSERT 차단
--
--
-- ── 현 정책 negative test 시나리오 (참고용, 모두 "허용됨"으로 통과) ──
-- 현재 정책이 "Allow all"이므로 아래 시나리오는 모두 성공함을 의미합니다.
-- (= 의도된 동작이지만, 보안 취약점이라는 점을 인지하고 있어야 합니다)
--
--   T1. anon이 다른 user_id로 INSERT 시도 → 성공 (취약점, 의도된 허용)
--       INSERT INTO reports(id, date, user_id, ...) VALUES('fake_x', '2026-05-01', 'someone_else', ...);
--
--   T2. anon이 타인 row UPDATE 시도 → 성공 (취약점)
--       UPDATE reports SET memo = 'tampered' WHERE user_id = 'emp_xxx';
--
--   T3. anon이 전체 reports SELECT → 성공 (취약점)
--       SELECT * FROM reports;
--
--   T4. anon이 row DELETE → 성공 (취약점)
--       DELETE FROM reports WHERE id = 'emp_xxx_yyy';
--
-- 이 시나리오들이 "실패해야 정상"인 환경으로 가려면 별도의 인증 도입 마이그레이션이
-- 필요합니다 — 본 작업의 범위는 아닙니다.
-- ============================================================================
