# 🚀 Focus Habit Frontend DB 스키마 설정 가이드

## 📋 개요
이 가이드는 새로운 DB 스키마를 Supabase에 적용하고 프로젝트를 업데이트하는 과정을 설명합니다.

## 🎯 목표
- 새로운 체계적인 DB 스키마 적용
- 기존 코드와의 호환성 유지
- 실시간 데이터 처리 최적화

## 📁 생성된 파일들

### 1. 데이터베이스 스키마
- `supabase-schema.sql` - Supabase에서 실행할 SQL 스크립트

### 2. 타입 정의
- `src/types/database.ts` - 새로운 DB 스키마에 맞는 TypeScript 타입들

### 3. 데이터베이스 서비스
- `src/lib/database/focusSession.ts` - 집중 세션 관련 DB 서비스

### 4. API 라우트
- `src/app/api/focus-session/route.ts` - 집중 세션 CRUD API
- `src/app/api/focus-session/[sessionId]/route.ts` - 특정 세션 관리 API

## 🔧 단계별 설정

### 1단계: Supabase 스키마 적용

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **스키마 스크립트 실행**
   - `supabase-schema.sql` 파일의 내용을 복사
   - SQL Editor에 붙여넣기
   - "Run" 버튼 클릭

4. **실행 결과 확인**
   - 성공 메시지: "Focus Habit Database Schema created successfully!"
   - 에러가 있다면 개별적으로 수정 후 재실행

### 2단계: 환경 변수 확인

`.env.local` 파일에 다음 변수들이 설정되어 있는지 확인:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3단계: 프로젝트 실행 및 테스트

```bash
# 개발 서버 실행
pnpm dev

# 브라우저에서 http://localhost:3000 접속
```

### 4단계: API 테스트

#### 새로운 집중 세션 생성
```bash
curl -X POST http://localhost:3000/api/focus-session \
  -H "Content-Type: application/json" \
  -d '{
    "goal_min": 30,
    "context_tag": "study",
    "session_type": "study",
    "notes": "테스트 세션"
  }'
```

#### 집중 세션 목록 조회
```bash
curl http://localhost:3000/api/focus-session
```

#### 오디오 분석 데이터 전송
```bash
curl -X POST http://localhost:3000/api/send-study-status \
  -H "Content-Type: application/json" \
  -d '{
    "isStudy": true,
    "context": "study",
    "confidence": 0.8,
    "text": "집중 중입니다"
  }'
```

## 🔄 기존 코드 수정사항

### 1. API 라우트 변경사항

#### `src/app/api/send-study-status/route.ts`
- `focus_session_audio_analysis` → `focus_sample` 테이블 사용
- 집중 세션 자동 생성/관리 로직 추가
- 이벤트 데이터도 함께 저장

### 2. 타입 정의 업데이트

#### 새로운 타입들
- `FocusSession` - 집중 세션 정보
- `FocusSample` - 집중 샘플 데이터
- `FocusEvent` - 집중 이벤트
- `DailySummary` - 일일 요약
- `WeeklySummary` - 주간 요약

### 3. 데이터베이스 서비스

#### `FocusSessionService` 클래스
- 세션 생성/수정/삭제/조회
- 클라이언트/서버 사이드 함수 제공
- 필터링 및 페이징 지원

## 📊 새로운 DB 구조

### 핵심 테이블들

1. **focus_session** - 집중 세션 메타데이터
2. **focus_sample** - 주기적 집중 데이터
3. **focus_event** - 특정 이벤트 기록
4. **snapshot** - 스냅샷 이미지 정보
5. **note** - 세션 중 노트
6. **daily_summary** - 일일 집계 데이터
7. **weekly_summary** - 주간 집계 데이터
8. **reward_claim** - 보상 획득 기록
9. **routine_toggle** - 루틴 활성화 상태
10. **habits** - 습관 관리
11. **habit_records** - 습관 완료 기록

### 관계 구조
```
user (1) → (N) focus_session (1) → (N) focus_sample
user (1) → (N) focus_session (1) → (N) focus_event
user (1) → (N) focus_session (1) → (N) snapshot
user (1) → (N) focus_session (1) → (N) note
user (1) → (N) daily_summary
user (1) → (N) weekly_summary
user (1) → (N) reward_claim
user (1) → (N) routine_toggle
user (1) → (N) habits (1) → (N) habit_records
```

## 🔒 보안 설정

### RLS (Row Level Security)
- 모든 테이블에 RLS 활성화
- 사용자별 데이터 접근 제어
- 자동 권한 관리

### 인덱스
- 성능 최적화를 위한 복합 인덱스
- 자주 조회되는 컬럼들에 인덱스 적용

## 🚨 주의사항

### 1. 데이터 마이그레이션
- 기존 데이터가 있다면 백업 후 마이그레이션 필요
- 새로운 스키마에 맞게 데이터 변환

### 2. API 호환성
- 기존 API 엔드포인트는 유지하되 내부 로직 변경
- 새로운 API 엔드포인트 추가

### 3. 프론트엔드 수정
- 새로운 타입 정의 적용
- API 호출 부분 업데이트 필요

## 🔍 문제 해결

### 일반적인 문제들

1. **RLS 정책 오류**
   - Supabase 대시보드에서 RLS 정책 확인
   - 사용자 인증 상태 확인

2. **타입 오류**
   - `src/types/database.ts` import 확인
   - 기존 타입 정의와 충돌 확인

3. **API 오류**
   - 네트워크 탭에서 요청/응답 확인
   - 서버 로그 확인

### 디버깅 팁

1. **Supabase 로그 확인**
   - Supabase 대시보드 → Logs
   - SQL 쿼리 실행 로그 확인

2. **브라우저 개발자 도구**
   - Network 탭에서 API 요청 확인
   - Console 탭에서 오류 메시지 확인

3. **Next.js 로그**
   - 터미널에서 서버 로그 확인
   - API 라우트 로그 확인

## 📈 다음 단계

### 1. 프론트엔드 컴포넌트 업데이트
- 새로운 타입 정의 적용
- API 호출 부분 수정
- UI 컴포넌트 업데이트

### 2. 실시간 기능 구현
- WebSocket 연결 관리
- 실시간 데이터 동기화
- 이벤트 기반 업데이트

### 3. 성능 최적화
- 캐싱 전략 구현
- 데이터베이스 쿼리 최적화
- 프론트엔드 성능 개선

### 4. 테스트 작성
- 단위 테스트
- 통합 테스트
- E2E 테스트

## 🎉 완료!

새로운 DB 스키마가 성공적으로 적용되었습니다. 이제 더 체계적이고 확장 가능한 데이터 구조를 사용할 수 있습니다! 