# Focus Habit Frontend - 리포트 시스템 개요

## 📋 목차
1. [시스템 구조](#시스템-구조)
2. [라우팅 구조](#라우팅-구조)
3. [API 엔드포인트](#api-엔드포인트)
4. [데이터 훅](#데이터-훅)
5. [UI 컴포넌트](#ui-컴포넌트)
6. [데이터 구조](#데이터-구조)
7. [데이터베이스 연동](#데이터베이스-연동)
8. [기술 스택](#기술-스택)

---

## 🏗️ 시스템 구조

### 전체 아키텍처
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Routes    │    │   Database      │
│   (Next.js)     │◄──►│   (Supabase)    │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ React Query     │    │ ReportService   │    │ focus_session   │
│ (Client Cache)  │    │ (Business Logic)│    │ daily_summary   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🛣️ 라우팅 구조

### 메인 리포트 페이지
- **경로**: `/report`
- **파일**: `src/app/report/page.tsx`
- **기능**: 종합 리포트 대시보드 (ComprehensiveReport 컴포넌트 포함)

### 일일 리포트 시스템
```
/report/daily/
├── select/                    # 활동 기록 선택 페이지
│   └── page.tsx              # 날짜별 활동 기록 선택
├── date/
│   └── [date]/
│       └── page.tsx          # 특정 날짜의 상세 리포트
└── page.tsx                  # 일일 세션 목록 페이지
```

### 세션별 리포트
```
/report/session/
└── [sessionId]/
    └── page.tsx              # 개별 세션 상세 분석
```

---

## 🔌 API 엔드포인트

### 1. 일일 통계 API
- **경로**: `/api/report/daily-stats`
- **메서드**: `GET`
- **파라미터**: `days` (기본값: 30)
- **기능**: 최근 N일간의 일일 통계 데이터 제공
- **반환 데이터**:
  - `dailyStats`: 일별 통계 배열
  - `totalStats`: 전체 통계 요약
  - `success`: 성공 여부

### 2. 일일 상세 리포트 API
- **경로**: `/api/report/daily/[date]`
- **메서드**: `GET`
- **파라미터**: `date` (YYYY-MM-DD 형식)
- **기능**: 특정 날짜의 모든 세션 데이터 및 통계
- **반환 데이터**:
  - `date`: 날짜
  - `totalSessions`: 총 세션 수
  - `totalFocusTime`: 총 집중 시간 (분)
  - `averageScore`: 평균 집중도 점수
  - `peakScore`: 최고 집중도 점수
  - `totalDistractions`: 총 방해 요소 수
  - `sessions`: 세션 목록

### 3. 기존 리포트 API
- **경로**: `/api/report/daily`
- **메서드**: `GET`
- **파라미터**: `date`, `refresh` (선택)
- **기능**: ReportService를 통한 일일 리포트 생성

---

## 🎣 데이터 훅

### React Query 기반 훅들

#### 1. useDailyStats
- **파일**: `src/hooks/useDailyStats.ts`
- **기능**: 일일 통계 데이터 조회
- **캐싱 설정**:
  - `staleTime`: 5분
  - `gcTime`: 10분
  - `retry`: 3회 (지수 백오프)

#### 2. useReport (다양한 훅들)
- **파일**: `src/hooks/useReport.ts`
- **주요 훅들**:
  - `useDailyReport`: 일일 리포트 데이터
  - `useWeeklyReport`: 주간 리포트 데이터
  - `useDailySummary`: 일일 요약 데이터
  - `useSessionReport`: 세션별 상세 리포트
  - `useTodaySessions`: 오늘의 세션 목록
  - `useDailyActivities`: 일일 활동 타임라인
  - `useDailySnapshots`: 일일 스냅샷 데이터
  - `useDailyAchievements`: 일일 성취도 데이터

---

## 🎨 UI 컴포넌트

### 1. ComprehensiveReport
- **위치**: `src/components/ui/comprehensive-report.tsx`
- **기능**: 종합 리포트 대시보드
- **구성 요소**:
  - 집중도 점수 (원형 프로그레스)
  - 시계열 차트 (주간/월간)
  - 활동 타임라인
  - 증거 스냅샷 갤러리
  - 성취도 그리드
  - 피드백 섹션

### 2. 세션 리포트 페이지
- **위치**: `src/app/report/session/[sessionId]/page.tsx`
- **기능**: 개별 세션 상세 분석
- **탭 구성**:
  - 집중력 추이
  - 활동 내역
  - 증거 자료
  - 성취도

### 3. 일일 리포트 페이지
- **위치**: `src/app/report/daily/date/[date]/page.tsx`
- **기능**: 특정 날짜의 상세 리포트
- **구성 요소**:
  - 일일 요약 통계
  - 세션 목록
  - 각 세션별 상세 정보

---

## 📊 데이터 구조

### 1. 일일 통계 (DailyStat)
```typescript
interface DailyStat {
  date: string
  sessions: number
  totalTime: number
  averageScore: number
  hasData: boolean
  phoneMin: number
  quietRatio: number
  longestStreak: number
}
```

### 2. 전체 통계 (TotalStats)
```typescript
interface TotalStats {
  totalDays: number
  activeDays: number
  totalSessions: number
  totalFocusTime: number
  averageScore: number
}
```

### 3. 일일 리포트 (DailyReport)
```typescript
interface DailyReport {
  date: string
  totalSessions: number
  totalFocusTime: number
  averageScore: number
  peakScore: number
  totalDistractions: number
  sessions: Session[]
}
```

### 4. 세션 리포트
```typescript
interface SessionReport {
  session: FocusSession
  samples: FocusSample[]
  events: FocusEvent[]
  snapshots: Snapshot[]
}
```

### 5. 종합 리포트 데이터
```typescript
interface FocusScoreData {
  overall: number
  trend: "up" | "down" | "stable"
  change: number
  breakdown: {
    attention: number
    posture: number
    phoneUsage: number
    consistency: number
  }
}

interface ActivityData {
  timestamp: string
  action: string
  type: "positive" | "negative" | "neutral"
  impact: number
  description: string
}

interface EvidenceSnapshot {
  id: string
  timestamp: string
  thumbnail: string
  focusScore: number
  notes: string
  type: "high_focus" | "distraction" | "break"
}

interface Achievement {
  id: string
  title: string
  description: string
  progress: number
  target: number
  completed: boolean
  badge: string
  category: "focus" | "consistency" | "improvement" | "milestone"
}
```

---

## 🗄️ 데이터베이스 연동

### 주요 테이블

#### 1. focus_session
- 집중 세션의 기본 정보
- **주요 컬럼**:
  - `session_id`: 세션 고유 ID
  - `user_id`: 사용자 ID
  - `started_at`: 시작 시간
  - `ended_at`: 종료 시간
  - `focus_score`: 집중도 점수
  - `goal_min`: 목표 시간 (분)
  - `context_tag`: 컨텍스트 태그
  - `distractions`: 방해 요소 수

#### 2. daily_summary
- 일일 요약 통계
- **주요 컬럼**:
  - `date`: 날짜
  - `user_id`: 사용자 ID
  - `focus_min`: 총 집중 시간 (분)
  - `avg_score`: 평균 집중도 점수
  - `sessions_count`: 세션 수
  - `phone_min`: 휴대폰 사용 시간
  - `quiet_ratio`: 조용한 비율
  - `longest_streak`: 최장 연속 기록

#### 3. focus_sample
- 집중도 샘플 데이터
- **주요 컬럼**:
  - `sample_id`: 샘플 고유 ID
  - `session_id`: 세션 ID
  - `ts`: 타임스탬프
  - `focus_score`: 집중도 점수

#### 4. focus_event
- 세션 이벤트 데이터
- **주요 컬럼**:
  - `event_id`: 이벤트 고유 ID
  - `session_id`: 세션 ID
  - `ts`: 타임스탬프
  - `event_type`: 이벤트 타입
  - `payload`: 이벤트 데이터

#### 5. snapshot
- 증거 스냅샷 데이터
- **주요 컬럼**:
  - `snapshot_id`: 스냅샷 고유 ID
  - `session_id`: 세션 ID
  - `ts`: 타임스탬프
  - `thumb_url`: 썸네일 URL
  - `focus_score`: 집중도 점수

---

## 🛠️ 기술 스택

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Query (TanStack Query)
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **API**: Next.js API Routes
- **Real-time**: Supabase Realtime

### Development Tools
- **Package Manager**: pnpm
- **Linting**: ESLint + Prettier
- **Bundler**: Turbopack (Next.js 15)

---

## 🔄 데이터 플로우

### 1. 일일 통계 조회
```
사용자 요청 → useDailyStats → /api/report/daily-stats → Supabase → daily_summary + focus_session
```

### 2. 일일 상세 리포트 조회
```
사용자 요청 → /api/report/daily/[date] → Supabase → focus_session + daily_summary → 통계 계산
```

### 3. 세션별 리포트 조회
```
사용자 요청 → useSessionReport → Supabase → focus_session + focus_sample + focus_event + snapshot
```

---

## 🎯 주요 기능

### 1. 활동 기록
- 최근 30일간의 활동 기록 표시
- 데이터가 있는 날만 필터링하여 표시
- 각 날짜별 세션 수, 집중 시간, 평균 점수 표시

### 2. 일일 상세 리포트
- 특정 날짜의 모든 세션 정보
- 일일 요약 통계 (총 세션, 총 시간, 평균 점수, 최고 점수)
- 세션별 상세 정보 및 링크

### 3. 세션별 상세 분석
- 개별 세션의 상세 정보
- 집중력 추이, 활동 내역, 증거 자료, 성취도 탭
- 세션 기간의 모든 데이터 포인트

### 4. 종합 리포트
- 전체적인 집중도 분석
- 시계열 차트 및 트렌드 분석
- 성취도 및 피드백 제공

---


## 📝 향후 개선사항

### 1. 성능 최적화
- 이미지 최적화
- 코드 스플리팅
- 캐싱 전략 개선

### 2. 기능 확장
- 주간/월간 리포트
- 리포트 내보내기 (PDF, CSV)
- 리포트 공유 기능

### 3. 사용자 경험
- 로딩 상태 개선
- 에러 바운더리 추가
- 접근성 개선

---

*마지막 업데이트: 2025년 1월*
