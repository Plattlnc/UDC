# Z Fold 반응형 UI 스펙 — UDC Dashboard

## 디바이스 레퍼런스

| 상태 | 기기 | CSS viewport width | 비고 |
|---|---|---|---|
| **커버(접힘)** | Z Fold 5/6 커버 | ~374px | 현재 디자인이 그대로 적용됨 |
| **일반 폰** | Galaxy S, iPhone | 375–430px | 현재 디자인 적용 |
| **펼침** | Z Fold 5 내부 | ~728px | 신규 레이아웃 필요 |
| **펼침** | Z Fold 6 내부 | ~748px | 신규 레이아웃 필요 |
| **태블릿** | iPad Mini 등 | 768px+ | 펼침 레이아웃과 동일 룰 적용 |

---

## 1. 브레이크포인트 정의

```
FOLDED   : window.innerWidth < 600px   → 현재 단일 컬럼 레이아웃 유지
UNFOLDED : window.innerWidth >= 600px  → 사이드바 + 컨텐츠 2열 레이아웃
```

**선택 근거**: Z Fold 커버(~374px)는 FOLDED 범위에 완전히 포함됨. 600px는 Z Fold 내부(~728px)와 일반 폰(최대 ~430px) 사이의 명확한 중간점. 480–599px 구간을 별도로 처리하지 않아 조건문 단순화.

---

## 2. 반응형 훅 구현 패턴 (인라인 스타일 기반)

fullstack-engineer가 App 컴포넌트 상단에 추가:

```jsx
// App() 함수 내부, 기존 useState들 아래에 추가
var r_bp = useState(window.innerWidth >= 600 ? "unfolded" : "folded");
var bp = r_bp[0], setBp = r_bp[1];

useEffect(function() {
  function handleResize() {
    setBp(window.innerWidth >= 600 ? "unfolded" : "folded");
  }
  window.addEventListener("resize", handleResize);
  return function() { window.removeEventListener("resize", handleResize); };
}, []);

var isUnfolded = bp === "unfolded";
```

**`isUnfolded` 플래그를 prop으로 필요한 컴포넌트에 전달.**

---

## 3. 컴포넌트별 동작 스펙

### 3-1. App 컨테이너

```jsx
// FOLDED (현재)
<div style={{ minHeight: "100vh", background: "#fafafa", maxWidth: 540, margin: "0 auto" }}>

// UNFOLDED (신규)
<div style={{ minHeight: "100vh", background: "#fafafa", display: "flex", flexDirection: "column" }}>
```

| 속성 | FOLDED | UNFOLDED |
|---|---|---|
| maxWidth | 540 | none |
| margin | "0 auto" | 0 |
| display | block | flex / column |

---

### 3-2. Header

```jsx
// FOLDED (현재 — 변경 없음)
<div style={{ padding: "18px 22px", ... }}>

// UNFOLDED (신규 — full width, sidebar 제목 제거)
<div style={{ padding: "18px 22px", background: "#fff", borderBottom: "1px solid #f0f0f3",
  position: "sticky", top: 0, zIndex: 50,
  display: "flex", justifyContent: "space-between", alignItems: "center",
  // marginLeft 없음 — 헤더는 전체 너비 (사이드바 위까지 포함)
}}>
```

| 속성 | FOLDED | UNFOLDED |
|---|---|---|
| width | maxWidth 540px 내 | 100vw (full) |
| position | sticky top:0 | sticky top:0 |
| zIndex | 50 | 60 (사이드바 위) |

---

### 3-3. BottomNav (UNFOLDED 시 숨김)

```jsx
// 조건부 렌더링
{!isUnfolded && <BottomNav ... />}
```

UNFOLDED에서는 SideNav로 대체.

---

### 3-4. SideNav (신규 컴포넌트 — UNFOLDED 전용)

```jsx
function SideNav(p) {
  // p.tabs, p.active, p.onSelect
  var headerHeight = 61; // 18px padding top+bottom + 22px font 근사
  return (
    <nav style={{
      position: "fixed",
      top: headerHeight,
      left: 0,
      width: 280,
      height: "calc(100vh - " + headerHeight + "px)",
      background: "#fff",
      borderRight: "1px solid #f0f0f3",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      zIndex: 50,
      paddingTop: 8,
      paddingBottom: 24,
      boxSizing: "border-box"
    }}>
      {p.tabs.map(function(t) {
        var isActive = p.active === t.id;
        return (
          <button key={t.id} onClick={function() { p.onSelect(t.id); }}
            style={{
              display: "flex", alignItems: "center", gap: 13,
              padding: "14px 22px",
              width: "100%",
              background: isActive ? "#fff8f6" : "none",
              borderLeft: isActive ? "3px solid #e1360a" : "3px solid transparent",
              border: "none",
              borderTop: "none", borderRight: "none", borderBottom: "none",
              borderLeftWidth: 3,
              borderLeftStyle: "solid",
              borderLeftColor: isActive ? "#e1360a" : "transparent",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#e1360a" : "#18181b",
              textAlign: "left",
              boxSizing: "border-box"
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
```

| 속성 | 값 |
|---|---|
| width | 280px |
| position | fixed, top: headerHeight |
| borderRight | 1px solid #f0f0f3 |
| 활성 탭 indicator | borderLeft: 3px solid #e1360a |
| 활성 탭 bg | #fff8f6 |
| nav item height | ~52px (padding 14px × 2 + 24px content) |

---

### 3-5. Content Area 래퍼 (UNFOLDED 신규)

```jsx
// App render 내부 — 기존 컨텐츠를 이 래퍼로 감쌈
{isUnfolded && <SideNav tabs={...} active={tab} onSelect={setTab} />}
<div style={isUnfolded
  ? { marginLeft: 280, minHeight: "calc(100vh - 61px)", overflowY: "auto" }
  : {}
}>
  {/* 기존 탭 컨텐츠 */}
</div>
```

| 속성 | FOLDED | UNFOLDED |
|---|---|---|
| marginLeft | 0 | 280 |
| paddingBottom | (PAGE가 처리) | 0 (BottomNav 없음) |

---

### 3-6. PAGE 상수 (조건부)

```jsx
var PAGE_FOLDED  = { padding: "22px 22px 110px", maxWidth: 560, margin: "0 auto" };
var PAGE_UNFOLDED = { padding: "22px 28px 40px" }; // maxWidth 없음, margin 없음
var PAGE = isUnfolded ? PAGE_UNFOLDED : PAGE_FOLDED;
```

| 속성 | FOLDED | UNFOLDED |
|---|---|---|
| padding | "22px 22px 110px" | "22px 28px 40px" |
| maxWidth | 560 | 없음 (제거) |
| margin | "0 auto" | 0 |
| paddingBottom | 110 (BottomNav) | 40 (여백만) |

---

### 3-7. 카드 그리드 (2-col 통계 카드)

컨텐츠 패널 너비: 748 − 280 = **468px**. 패딩 제외 유효 너비: 468 − 56 = **412px**.

| 그리드 종류 | FOLDED | UNFOLDED |
|---|---|---|
| 2-col 통계 카드 | `"1fr 1fr"` | `"1fr 1fr"` (유지 — 412px에서도 충분) |
| 3-col 통계 카드 (AdminHome 직원별 등) | `"1fr 1fr 1fr"` | `"1fr 1fr 1fr"` (유지) |
| 4-col 직원 세부 통계 | `"1fr 1fr 1fr 1fr"` | `"1fr 1fr 1fr 1fr"` (유지) |
| 직원 프로필 카드 그리드 | `"1fr 1fr"` | `"1fr 1fr"` (유지) |

**결론**: 컨텐츠 패널이 현재 단일컬럼 설계(maxWidth 540px 내)와 유사한 너비이므로 카드 그리드 컬럼 수는 변경 불필요.

---

### 3-8. FAB (Floating Action Button)

```jsx
// FOLDED (현재)
{ position: "fixed", bottom: 96, right: 20, width: 62, height: 62, borderRadius: 31, zIndex: 90 }

// UNFOLDED
{ position: "fixed", bottom: 28, right: 28, width: 62, height: 62, borderRadius: 31, zIndex: 90 }
```

| 속성 | FOLDED | UNFOLDED |
|---|---|---|
| bottom | 96 (BottomNav 회피) | 28 |
| right | 20 | 28 |

---

### 3-9. Modal (고정 오버레이)

```jsx
// 오버레이 — 변경 없음
{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
  alignItems: "center", justifyContent: "center", zIndex: 300, padding: 22 }

// 모달 내부 시트 — maxWidth 조정
// FOLDED
{ background: "#fff", borderRadius: 22, padding: 28, width: "100%", maxWidth: 420 }

// UNFOLDED — 동일하게 유지 (컨텐츠 패널 중앙에 자동 위치됨)
// 단, 오버레이가 전체화면이므로 사이드바 위에도 표시됨. zIndex: 300으로 이미 처리됨.
{ background: "#fff", borderRadius: 22, padding: 28, width: "100%", maxWidth: 460 }
```

| 속성 | FOLDED | UNFOLDED |
|---|---|---|
| 오버레이 | inset: 0, 전체화면 | 동일 (사이드바 포함 전체 덮음) |
| 모달 maxWidth | 420 | 460 |
| 위치 | center (auto) | center (약간 우측 쏠림 허용 — 개선 불필요) |

---

### 3-10. Toast

```jsx
// FOLDED
{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", ... }

// UNFOLDED — 컨텐츠 패널 중앙 정렬
{ position: "fixed", top: 80,
  left: "calc(280px + 50%)",        // 사이드바(280px) + 나머지 영역의 50%
  transform: "translateX(-50%)", ... }
```

| 속성 | FOLDED | UNFOLDED |
|---|---|---|
| top | 80 | 80 |
| left | "50%" | "calc(280px + 50%)" |

**Note**: 정확한 컨텐츠 패널 중앙이 아니지만 실용적 허용범위. 완벽한 중앙은 `left: calc(280px + (100vw - 280px) / 2)`.

---

### 3-11. LoginScreen

```jsx
// FOLDED (현재 — 변경 없음)
<div style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", background: "#fff", padding: 22 }}>

// UNFOLDED — 좌/우 2패널
<div style={{ minHeight: "100vh", display: "flex", background: "#fff" }}>
  {/* 좌측 브랜딩 패널 */}
  <div style={{ width: 280, background: "#e1360a", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <div style={{ width: 96, height: 96, borderRadius: 24, background: "rgba(255,255,255,0.2)",
      display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <span style={{ fontSize: 48, color: "#fff", fontWeight: 900 }}>U</span>
    </div>
    <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", margin: 0, textAlign: "center" }}>UDC 대시보드</h1>
  </div>
  {/* 우측 PIN 패드 */}
  <div style={{ flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 40 }}>
    {/* 기존 PIN 도트 + 키패드 */}
  </div>
</div>
```

| 영역 | FOLDED | UNFOLDED |
|---|---|---|
| 전체 구조 | column, 단일 패널 | row, 2패널 |
| 좌측 브랜딩 | 없음 | 280px, #e1360a bg |
| 우측 PIN | 전체 | flex: 1 |
| 로고 | 컨텐츠 내 위 | 좌측 패널 중앙 |
| 타이틀 "UDC 대시보드" | 컨텐츠 내 | 좌측 패널 |

---

### 3-12. 주간 출근지 스케줄 그리드 (EmpVehicle)

```jsx
// FOLDED (현재) — overflowX: "auto" 필요
{ display: "grid", gridTemplateColumns: "48px repeat(6, 88px)", gap: 9, minWidth: 580 }

// UNFOLDED — 컨텐츠 패널(412px 유효 너비)에서도 오버플로우 필요
// 변경 없음 — overflowX: "auto" 컨테이너가 스크롤 처리
```

UNFOLDED에서도 기존 overflowX: auto 패턴 유지. 그리드 자체 변경 불필요.

---

## 4. 레이아웃 구조도

### FOLDED (< 600px)
```
┌─────────────────────┐  (maxWidth 540px, centered)
│       Header        │
├─────────────────────┤
│                     │
│    PAGE content     │
│    (scroll)         │
│                     │
├─────────────────────┤
│     BottomNav       │  (fixed bottom)
└─────────────────────┘
```

### UNFOLDED (≥ 600px, ~748px)
```
┌─────────────────────────────────────────────┐
│                  Header (full width)         │
├────────────┬────────────────────────────────┤
│            │                                │
│  SideNav   │      Content Area              │
│  (280px)   │      (748-280 = 468px)         │
│            │                                │
│  fixed     │      PAGE content (scroll)     │
│            │                                │
│            │                                │
└────────────┴────────────────────────────────┘
(BottomNav 없음)
```

---

## 5. 폰트/패딩 축소 스펙 (커버 화면 최적화)

커버 화면(~374px)은 현재 단일컬럼 레이아웃이 그대로 적용됨.
현재 maxWidth: 540 → 374px 화면에서는 전체 화면 사용.

추가 조정 불필요. 단, 다음 한 가지는 커버에서 좁아 보일 수 있음:

| 컴포넌트 | 현재 | 커버 최적화 |
|---|---|---|
| 직원 4-col 통계 (AdminHome) | `"1fr 1fr 1fr 1fr"` gap:10 | 변경 불필요 (자동 축소됨) |
| 생산 목록 7-col 테이블 | `"1fr 0.5fr 0.4fr 0.6fr 0.6fr 0.6fr 0.3fr"` | 변경 불필요 (fr 비율 유지) |

---

## 6. 전체 isUnfolded 사용 위치 요약 (fullstack-engineer용)

```
App 컴포넌트:
  ✅ App 컨테이너 style (maxWidth, display)
  ✅ BottomNav → {!isUnfolded && <BottomNav .../>}
  ✅ SideNav 추가 → {isUnfolded && <SideNav .../>}
  ✅ Content 래퍼 marginLeft
  ✅ PAGE 상수 분기

LoginScreen 컴포넌트 (isUnfolded prop 전달):
  ✅ 2패널 vs 단일 레이아웃 분기

EmpReport / AdminChicken FAB (isUnfolded prop 전달):
  ✅ bottom: 96 vs 28
  ✅ right: 20 vs 28

Toast 컴포넌트 (isUnfolded prop 전달):
  ✅ left: "50%" vs "calc(280px + 50%)"
```

---

## 7. 구현 우선순위

1. **P0** — 훅 추가 + App 컨테이너 분기 (핵심 레이아웃)
2. **P0** — BottomNav 숨김 + SideNav 추가
3. **P1** — Content 래퍼 marginLeft
4. **P1** — PAGE 상수 분기 (paddingBottom 제거)
5. **P1** — FAB bottom/right 조정
6. **P2** — LoginScreen 2패널
7. **P2** — Toast left 조정
8. **P3** — Modal maxWidth 460 조정 (선택)
