# FocusAI - 페이지별 기능 및 기술 구현 가이드

## 목차
1. [홈페이지 (Landing Page)](#홈페이지-landing-page)
2. [로그인 페이지](#로그인-페이지)
3. [회원가입 페이지](#회원가입-페이지)
4. [대시보드](#대시보드)
5. [종합 리포트](#종합-리포트)
6. [일일 리포트](#일일-리포트)
7. [주간 리포트](#주간-리포트)
8. [기타 페이지](#기타-페이지)

---

## 홈페이지 (Landing Page)
**경로**: `/` (루트 페이지)

### 주요 기능
- **AI 기반 집중력 분석 소개**
  - 실시간 집중 게이지 (SVG 애니메이션)
  - 주간 리포트 PDF 생성 기능 소개
  - AI 행동 코칭 시스템 설명

- **인터랙티브 기능 데모**
  - 3단계 프로세스 시각화 (Framer Motion)
  - 실시간 집중도 측정 애니메이션 (CSS Keyframes)
  - 기능별 상세 설명 (탭 기반 인터페이스)

- **사용자 인증 상태 관리**
  - 로그인된 사용자 자동 대시보드 리다이렉트 (useEffect + useRouter)
  - 로그인 페이지 연결 (Next.js Link)

### 기술적 구현
- **상태 관리**: React useState (activeFeature 상태)
- **애니메이션**: CSS Keyframes (gentleFloat, drawCircle)
- **반응형**: Tailwind CSS Grid 시스템
- **라우팅**: Next.js App Router
- **인증**: useAuth 훅 (Supabase Auth)

### UI/UX 특징
- 그라데이션 배경과 플로팅 애니메이션
- 반응형 디자인 (lg:grid-cols-2)
- 모던한 카드 기반 레이아웃
- 호버 효과와 트랜지션 (transition-all duration-300)

---

## 로그인 페이지
**경로**: `/login`

### 주요 기능
- **다양한 로그인 방식**
  - 이메일/비밀번호 로그인 (Supabase Auth)
  - Google OAuth 로그인 (Supabase OAuth)
  - Apple OAuth 로그인 (Supabase OAuth)

- **사용자 경험**
  - 비밀번호 표시/숨김 토글 (useState)
  - 로그인 상태 유지 옵션 (localStorage)
  - 실시간 폼 유효성 검사 (HTML5 validation)
  - 로딩 상태 표시 (isLoading state)

- **에러 처리**
  - 로그인 실패 시 에러 메시지 (try-catch)
  - 네트워크 오류 처리 (error state)
  - 사용자 친화적 에러 안내 (Alert 컴포넌트)

### 기술적 구현
- **폼 관리**: React useState (formData)
- **유효성 검사**: HTML5 validation + 커스텀 검증
- **인증**: signIn, signInWithGoogle, signInWithApple 함수
- **라우팅**: useRouter (redirectTo 파라미터 지원)
- **애니메이션**: Framer Motion (initial, animate, transition)

### 보안 기능
- Supabase Auth 통합
- 리다이렉트 URL 지원 (searchParams)
- 세션 관리 (Supabase 세션)

---

## 회원가입 페이지
**경로**: `/signup`

### 주요 기능
- **회원가입 폼**
  - 이름, 이메일, 비밀번호 입력
  - 비밀번호 확인 (실시간 일치 검사)
  - 이용약관 동의 (checkbox)

- **실시간 유효성 검사**
  - 이메일 형식 검증 (정규표현식)
  - 비밀번호 강도 확인 (validateSignUpForm)
  - 비밀번호 일치 검사 (실시간 비교)
  - 필수 필드 검증 (HTML5 required)

- **사용자 경험**
  - 단계별 진행 표시 (로딩 상태)
  - 성공 메시지 및 자동 리다이렉트 (setTimeout)
  - 로딩 상태 표시 (isLoading state)

### 기술적 구현
- **폼 관리**: React useState (formData)
- **유효성 검사**: validateSignUpForm 함수 (lib/auth/validation.ts)
- **회원가입**: signUp 함수 (Supabase Auth)
- **타입 안전성**: SignUpFormData 인터페이스
- **에러 처리**: errors 객체 (필드별 에러 관리)

### 보안 기능
- Supabase 회원가입 통합
- 이메일 인증 프로세스 (Supabase Auth)
- 비밀번호 암호화 (Supabase 내장 암호화)

---

## 대시보드
**경로**: `/dashboard`

### 핵심 기능

#### 집중 세션 관리
- **세션 제어**
  - 집중 세션 시작/일시정지/종료 (useDashboardStore)
  - 실시간 타이머 표시 (setInterval)
  - 집중도 점수 실시간 업데이트 (Zustand store)

- **미디어 권한 관리**
  - 웹캠 권한 요청 및 관리 (MediaDevices API)
  - 마이크 권한 요청 및 관리 (getUserMedia)
  - 권한 거부 시 대안 제공 (fallback UI)

#### AI 집중력 분석
- **KoELECTRA 모델 통합**
  - 실시간 텍스트 분석 (ONNX.js)
  - 집중/방해 상태 분류 (이진 분류)
  - 신뢰도 점수 제공 (softmax 확률)

- **실시간 분석 히스토리**
  - 최근 5개 분석 결과 표시 (slice(-5))
  - 상태별 색상 구분 (조건부 스타일링)
  - 타임스탬프 기록 (Date 객체)

#### 데이터 시각화
- **오늘의 현황**
  - 총 집중 시간 (목표 대비 진행률)
  - 평균 집중도 (성과 등급)
  - 방해 요소 통계 (카운터)

- **주간 집중 패턴**
  - 인터랙티브 차트 (SVG + D3.js 개념)
  - 요일별 집중도 추이 (선형 보간)
  - 호버 시 상세 정보 툴팁 (AnimatePresence)

#### 제스처 인식
- **실시간 제스처 분석**
  - 웹캠 프레임 캡처 (Canvas API)
  - 제스처 인식 활성화/비활성화 (toggle)
  - 프레임 전송 상태 표시 (WebSocket)

#### 오디오 파이프라인
- **하이브리드 오디오 처리**
  - 실시간 오디오 스트림 처리 (AudioContext)
  - ML 추론 워커 통합 (Web Workers)
  - 오디오 분석 결과 표시 (FFT)

### 기술적 구현
- **상태 관리**: Zustand (useDashboardStore)
- **실시간 처리**: WebSocket + MediaStream API
- **AI 추론**: ONNX.js + KoELECTRA 모델
- **차트**: SVG + Framer Motion
- **권한 관리**: Permissions API
- **데이터베이스**: Supabase (focus_session 테이블)

### UI 컴포넌트
- **원형 게이지**: SVG circle + stroke-dasharray
- **미니 차트**: Canvas API + 애니메이션
- **프로그레스 바**: HTML progress + CSS
- **알림 시스템**: Toast + Dropdown

### 상태 관리
- **Zustand 스토어**
  - 세션 상태 관리 (isRunning, isPaused)
  - 집중도 점수 추적 (focusScore)
  - UI 상태 동기화 (elapsed, formatTime)

---

## 종합 리포트
**경로**: `/report`

### 주요 기능
- **리포트 네비게이션**
  - 종합/주간/일일 리포트 간 전환 (Next.js Link)
  - 활성 탭 표시 (조건부 스타일링)

- **종합 분석 대시보드**
  - 전체 학습 통계 (ComprehensiveReport 컴포넌트)
  - 성과 요약 (집계 데이터)
  - 개선점 분석 (트렌드 분석)

### 기술적 구현
- **컴포넌트**: ComprehensiveReport (ui/comprehensive-report.tsx)
- **데이터 페칭**: React Query (useQuery)
- **라우팅**: Next.js App Router
- **스타일링**: Tailwind CSS + shadcn/ui

### UI 특징
- 일관된 헤더 디자인 (공통 레이아웃)
- 네비게이션 바 (탭 기반)
- 반응형 레이아웃 (Grid 시스템)

---

## 일일 리포트
**경로**: `/report/daily`

### 주요 기능

#### 일일 통계 요약
- **핵심 지표**
  - 총 세션 수 (length)
  - 총 집중 시간 (reduce + sum)
  - 평균 집중도 (reduce + average)
  - 진행 중인 세션 수 (filter + isActive)

#### 세션 상세 정보
- **세션 카드**
  - 세션 제목 및 설명 (title, description)
  - 시작/종료 시간 (startTime, endTime)
  - 총 집중 시간 (duration 계산)
  - 평균 집중도 점수 (averageScore)

- **시각적 요소**
  - 원형 진행률 표시 (CircularProgress 컴포넌트)
  - 색상별 성과 등급 (조건부 스타일링)
  - 진행 중 세션 표시 (isActive 상태)

#### 세션 상세 페이지 연결
- 각 세션 카드 클릭 시 상세 페이지로 이동 (Link)
- 세션별 상세 분석 제공 (동적 라우팅)

### 기술적 구현
- **데이터 페칭**: useTodaySessions 훅
- **상태 관리**: React Query (isLoading, error, data)
- **애니메이션**: Framer Motion (initial, animate)
- **라우팅**: Next.js Link + 동적 라우팅
- **타입 안전성**: TypeScript 인터페이스

### 데이터 처리
- **실시간 데이터 로딩**
  - 로딩 상태 표시 (Loader2 컴포넌트)
  - 에러 처리 (AlertCircle + 에러 메시지)
  - 빈 상태 처리 (EmptyState 컴포넌트)

### UI/UX
- **애니메이션 효과**
  - 카드 등장 애니메이션 (motion.div)
  - 호버 효과 (whileHover, whileTap)
  - 반응형 그리드 레이아웃 (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)

---

## 주간 리포트
**경로**: `/report/weekly`

### 주요 기능

#### 주간 목표 달성
- **목표 추적**
  - 연속 학습일 목표 (streak counter)
  - 평균 집중도 목표 (average calculation)
  - 총 학습 시간 목표 (time aggregation)

- **진행률 표시**
  - 프로그레스 바 (Progress 컴포넌트)
  - 달성률 퍼센트 (percentage calculation)
  - 목표 달성 상태 (boolean flag)

#### 주간 집중도 분석
- **인터랙티브 차트**
  - 요일별 차트/시간대별 히트맵 전환 (탭 시스템)
  - 호버 시 상세 정보 (툴팁)
  - 색상별 집중도 구분 (색상 팔레트)

- **통계 요약**
  - 최고점/평균/최저점 (Math.max, reduce, Math.min)
  - 요일별 성과 비교 (sorting)
  - 개선 추이 분석 (trend calculation)

#### 학습 패턴 분석
- **패턴 인사이트**
  - 최고 집중 요일 (최대값 찾기)
  - 평균 세션 시간 (시간 계산)
  - 연속 학습일 (streak algorithm)

### 기술적 구현
- **데이터 페칭**: useWeeklyReport, useWeeklyStats, useWeeklyPatterns
- **차트 라이브러리**: SVG + Framer Motion
- **상태 관리**: useState (hoveredDay, activeTab)
- **애니메이션**: AnimatePresence + motion
- **반응형**: Tailwind CSS Grid

### 차트 기능
- **요일별 차트**
  - 바 차트 형태 (SVG rect)
  - 그라데이션 색상 (linearGradient)
  - 애니메이션 효과 (motion.rect)

- **시간대별 히트맵**
  - 24시간 x 7일 그리드 (CSS Grid)
  - 집중도별 색상 구분 (동적 클래스)
  - 인터랙티브 툴팁 (positioned tooltip)

### 데이터 시각화
- **색상 코딩**
  - 매우 높음 (80-100): 에메랄드 (#10B981)
  - 높음 (60-79): 에메랄드 (#10B981)
  - 보통 (40-59): 파랑 (#3B82F6)
  - 낮음 (20-39): 주황 (#F59E0B)
  - 매우 낮음 (0-19): 회색 (#6B7280)

---

## 기타 페이지

### 비밀번호 찾기
**경로**: `/forgot-password`
- 이메일을 통한 비밀번호 재설정 (Supabase Auth)
- 사용자 친화적 안내 메시지 (Alert 컴포넌트)

### 이메일 확인
**경로**: `/auth/confirm`
- 회원가입 후 이메일 인증 (Supabase Auth)
- 인증 상태 확인 (useEffect)

### 비밀번호 재설정
**경로**: `/auth/reset-password`
- 새 비밀번호 설정 (Supabase Auth)
- 보안 강도 검증 (password strength meter)

### OAuth 콜백
**경로**: `/auth/callback`
- Google/Apple 로그인 처리 (Supabase OAuth)
- 인증 토큰 관리 (session handling)

### 테스트 페이지
**경로**: `/test-koelectra`
- KoELECTRA 모델 테스트 (ONNX.js)
- AI 추론 기능 검증 (inference testing)

---

## 기술적 특징

### 상태 관리
- **Zustand**: 전역 상태 관리 (dashboardStore, appPerformanceStore)
- **React Query**: 서버 상태 관리 (useQuery, useMutation)
- **로컬 상태**: 컴포넌트별 상태 (useState, useReducer)

### 실시간 기능
- **WebSocket**: 실시간 데이터 통신 (ws://localhost:3001)
- **MediaStream API**: 웹캠/마이크 접근 (getUserMedia)
- **Web Workers**: 백그라운드 처리 (ml-inference-worker.js)

### AI/ML 통합
- **ONNX.js**: 클라이언트 사이드 추론 (koelectra.onnx)
- **KoELECTRA**: 한국어 텍스트 분석 (이진 분류)
- **실시간 추론**: 30초 간격 분석 (setInterval)

### 보안
- **Supabase Auth**: 인증 시스템 (JWT 토큰)
- **권한 관리**: 미디어 접근 권한 (Permissions API)
- **데이터 암호화**: 민감 정보 보호 (AES-256)

### 성능 최적화
- **코드 스플리팅**: 페이지별 번들 분리 (Next.js)
- **이미지 최적화**: Next.js Image 컴포넌트 (WebP 포맷)
- **메모이제이션**: React.memo, useMemo 활용

### 데이터베이스 스키마
- **focus_session**: 세션 데이터 (session_id, user_id, started_at, ended_at, focus_score)
- **daily_summary**: 일일 요약 (user_id, date, total_time, avg_score)
- **weekly_summary**: 주간 요약 (user_id, week_start, total_sessions)

### API 엔드포인트
- **POST /api/focus-session**: 세션 시작
- **PUT /api/focus-session/[sessionId]**: 세션 업데이트
- **GET /api/report/daily/[date]**: 일일 리포트
- **GET /api/report/weekly**: 주간 리포트

---

## 반응형 디자인

### 브레이크포인트
- **모바일**: 320px - 768px (sm:)
- **태블릿**: 768px - 1024px (md:)
- **데스크톱**: 1024px 이상 (lg:, xl:)

### 적응형 요소
- **그리드 시스템**: 화면 크기별 컬럼 수 조정 (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- **네비게이션**: 모바일에서 햄버거 메뉴 (Sheet 컴포넌트)
- **차트**: 화면 크기별 크기 조정 (viewBox 동적 조정)
- **폰트**: 반응형 텍스트 크기 (text-sm md:text-base lg:text-lg)

---

## 디자인 시스템

### 색상 팔레트
- **Primary**: Blue (#3B82F6)
- **Success**: Emerald (#10B981)
- **Warning**: Orange (#F59E0B)
- **Error**: Red (#EF4444)
- **Neutral**: Slate (#64748B)

### 컴포넌트 라이브러리
- **shadcn/ui**: 기본 UI 컴포넌트 (Button, Card, Input 등)
- **Tailwind CSS**: 스타일링 (utility-first CSS)
- **Framer Motion**: 애니메이션 (motion 컴포넌트)

### 아이콘
- **Lucide React**: 일관된 아이콘 시스템
- **커스텀 SVG**: 브랜드 아이콘 (Brain, FocusAI 로고)

### 타이포그래피
- **폰트**: 시스템 폰트 스택 (font-sans)
- **크기**: Tailwind CSS 텍스트 크기 클래스
- **두께**: font-normal, font-medium, font-semibold, font-bold

---

이 문서는 FocusAI 프로젝트의 각 페이지별 기능과 기술적 구현 세부사항을 상세히 설명합니다. 개발자가 시스템의 전체적인 구조와 구현 방법을 이해할 수 있도록 작성되었습니다. 