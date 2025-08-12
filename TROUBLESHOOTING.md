# 🔧 세션 데이터 수집 문제 해결 가이드

## 🚨 문제 상황
세션을 했는데 레포트가 생성되지 않는 문제

## 🔍 원인 분석

### 1. **세션 데이터 저장 문제**
- `focus_session` 테이블에는 세션이 생성되지만
- `focus_sample`과 `focus_event` 테이블에 실제 데이터가 저장되지 않음
- ML 파이프라인이 제대로 작동하지 않아 실시간 데이터 수집이 안 됨

### 2. **세션 종료 처리 문제**
- 세션이 제대로 종료되지 않아 `ended_at`이 설정되지 않음
- `ReportService.upsertDailySummary()`가 호출되지 않음

### 3. **데이터베이스 연결 문제**
- Supabase 연결이 불안정하거나 권한 문제
- RLS (Row Level Security) 정책 문제

## 🛠️ 해결 방법

### 1단계: 데이터베이스 상태 확인

#### A. 디버깅 SQL 실행
```sql
-- Supabase SQL 에디터에서 실행
-- scripts/debug-session-data.sql 파일의 내용을 실행하세요
```

#### B. 사용자 ID 확인
```sql
-- 실제 사용자 ID로 변경 필요
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

### 2단계: 세션 데이터 수집 테스트

#### A. 테스트 API 호출
```bash
# 세션 데이터 수집 테스트
curl -X POST /api/test-session-data \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "your-session-id", "testData": {"score": 75}}'

# 세션 상태 확인
curl -X GET "/api/test-session-data?sessionId=your-session-id"
```

#### B. 브라우저 개발자 도구에서 테스트
```javascript
// 콘솔에서 실행
fetch('/api/test-session-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'your-session-id',
    testData: { score: 75 }
  })
}).then(r => r.json()).then(console.log)
```

### 3단계: ML 파이프라인 상태 확인

#### A. 오디오 파이프라인 확인
- 브라우저 콘솔에서 에러 메시지 확인
- 마이크 권한이 허용되었는지 확인
- `HybridAudioPipeline` 컴포넌트가 제대로 렌더링되는지 확인

#### B. 네트워크 탭에서 API 호출 확인
- `/api/focus-score` 호출이 발생하는지 확인
- `/api/send-study-status` 호출이 발생하는지 확인
- 응답 상태 코드 확인

### 4단계: 데이터베이스 권한 확인

#### A. RLS 정책 확인
```sql
-- RLS 정책 상태 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('focus_session', 'focus_sample', 'focus_event', 'daily_summary');
```

#### B. 테이블 권한 확인
```sql
-- 테이블 권한 확인
SELECT 
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_name IN ('focus_session', 'focus_sample', 'focus_event', 'daily_summary')
  AND grantee = 'authenticated';
```

### 5단계: 수동 데이터 생성

#### A. 테스트 데이터 삽입
```sql
-- 테스트 세션 생성
INSERT INTO focus_session (
  user_id, started_at, ended_at, goal_min, context_tag, 
  session_type, focus_score, distractions
) VALUES (
  'your-user-id',
  NOW() - INTERVAL '1 hour',
  NOW(),
  60,
  'test_session',
  'study',
  75,
  2
);

-- 테스트 샘플 데이터 생성
INSERT INTO focus_sample (
  session_id, ts, score, score_conf, topic_tag
) VALUES (
  'your-session-id',
  NOW(),
  75,
  0.9,
  'test_data'
);
```

## 🔧 추가 디버깅 도구

### 1. **로그 확인**
- 브라우저 콘솔 로그
- Supabase 로그 (Functions 탭)
- 네트워크 탭의 API 응답

### 2. **상태 확인**
- 세션 상태: `session.isRunning`
- ML 모델 상태: `isModelLoaded`
- 오디오 파이프라인 상태: `isListening`

### 3. **데이터 흐름 추적**
```
사용자 액션 → 세션 시작 → ML 파이프라인 → 데이터 수집 → API 호출 → DB 저장 → 리포트 생성
```

## 📋 체크리스트

- [ ] 사용자 인증 상태 확인
- [ ] 세션이 제대로 시작되었는지 확인
- [ ] ML 파이프라인이 작동하는지 확인
- [ ] API 호출이 발생하는지 확인
- [ ] 데이터베이스에 데이터가 저장되는지 확인
- [ ] 세션이 제대로 종료되는지 확인
- [ ] 일일 요약이 생성되는지 확인

## 🆘 문제가 지속되는 경우

1. **브라우저 콘솔 로그**를 캡처하여 공유
2. **네트워크 탭**의 API 호출 로그를 캡처하여 공유
3. **Supabase 로그**를 확인하여 데이터베이스 오류 확인
4. **환경 변수**가 올바르게 설정되었는지 확인

## 📞 지원

문제가 해결되지 않으면 다음 정보와 함께 문의해주세요:
- 브라우저 콘솔 로그
- 네트워크 탭 로그
- Supabase 로그
- 사용 중인 브라우저와 버전
- 발생한 구체적인 오류 메시지
