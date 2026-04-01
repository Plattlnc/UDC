# UDC 대시보드 배포 가이드

## 1단계: Supabase 설정 (5분)

1. https://supabase.com 접속 → GitHub으로 로그인
2. "New Project" 클릭
   - Organization: 기본값
   - Project name: `udc-dashboard`
   - Database Password: 안전한 비밀번호 입력 (메모!)
   - Region: `Northeast Asia (Tokyo)` 선택
   - "Create new project" 클릭
3. 프로젝트 생성 후 → 왼쪽 메뉴 "SQL Editor" 클릭
4. 아래 SQL을 붙여넣고 "Run" 클릭:

```sql
CREATE TABLE app_data (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON app_data
  FOR ALL USING (true) WITH CHECK (true);
```

5. 왼쪽 메뉴 "Settings" → "API" 클릭
6. 두 가지를 복사해서 메모:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJh...` (긴 문자열)

## 2단계: 코드에 Supabase 키 입력

`src/supabase.js` 파일을 열고:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'  // ← 복사한 URL
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'  // ← 복사한 anon key
```

## 3단계: GitHub에 올리기

```bash
cd udc-app
git init
git add .
git commit -m "UDC 대시보드 초기 버전"
git remote add origin https://github.com/YOUR_USERNAME/udc-dashboard.git
git push -u origin main
```

## 4단계: Vercel 배포 (3분)

1. https://vercel.com 접속 → GitHub으로 로그인
2. "Import Project" → GitHub 저장소 `udc-dashboard` 선택
3. Framework: `Vite` 자동 감지됨
4. "Deploy" 클릭
5. 완료! URL 발급: `udc-dashboard.vercel.app`

## 완료 후

- 직원들에게 URL 공유하면 끝!
- 모든 기기에서 동일한 데이터 접근 가능
- 코드 수정 후 GitHub에 push하면 자동 재배포
