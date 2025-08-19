# Focus Habit Frontend API 문서

## 개요

Focus Habit Frontend는 실시간 집중도 분석과 소셜 기능을 갖춘 습관 관리 웹 애플리케이션입니다. 이 문서는 프로젝트의 모든 API 엔드포인트에 대한 상세한 설명을 제공합니다.

## 기본 정보

- **Base URL**: `http://localhost:3000/api` (개발 환경)
- **인증 방식**: Supabase Auth (JWT 토큰)
- **응답 형식**: JSON
- **에러 처리**: 표준 HTTP 상태 코드 사용

## 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": {},
  "message": "처리 완료"
}
```

### 에러 응답
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

### 페이지네이션 응답
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "message": "데이터 조회 완료"
}
```

## 인증

대부분의 API는 인증이 필요합니다. 요청 헤더에 Supabase JWT 토큰을 포함해야 합니다.

```http
Authorization: Bearer <jwt_token>
```

---

## 1. 집중 세션 관리 API

### 1.1 집중 세션 생성

**POST** `/api/focus-session`

새로운 집중 세션을 생성합니다.

#### 요청 본문
```json
{
  "goal_min": 60,
  "context_tag": "수학 공부",
  "session_type": "study",
  "notes": "미적분학 복습"
}
```

#### 응답
```json
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "user_id": "uuid",
    "started_at": "2024-01-01T10:00:00Z",
    "goal_min": 60,
    "context_tag": "수학 공부",
    "session_type": "study",
    "notes": "미적분학 복습"
  },
  "message": "집중 세션이 시작되었습니다."
}
```

### 1.2 집중 세션 조회

**GET** `/api/focus-session`

집중 세션 목록을 조회합니다.

#### 쿼리 파라미터
- `active` (boolean): 활성 세션만 조회
- `start_date` (string): 시작 날짜 (YYYY-MM-DD)
- `end_date` (string): 종료 날짜 (YYYY-MM-DD)
- `session_type` (string): 세션 타입 필터
- `context_tag` (string): 컨텍스트 태그 필터
- `page` (number): 페이지 번호 (기본값: 1)
- `limit` (number): 페이지당 항목 수 (기본값: 10)

#### 응답
```json
{
  "success": true,
  "data": [
    {
      "session_id": "uuid",
      "started_at": "2024-01-01T10:00:00Z",
      "ended_at": "2024-01-01T11:00:00Z",
      "goal_min": 60,
      "context_tag": "수학 공부",
      "session_type": "study",
      "focus_score": 85
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### 1.3 집중 세션 종료

**POST** `/api/focus-session/end`

현재 활성 집중 세션을 종료합니다.

#### 요청 본문
```json
{
  "focus_score": 85,
  "notes": "세션 완료"
}
```

#### 응답
```json
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "ended_at": "2024-01-01T11:00:00Z",
    "focus_score": 85
  },
  "message": "집중 세션이 종료되었습니다."
}
```

### 1.4 집중 세션 상세 조회

**GET** `/api/focus-session/[sessionId]`

특정 집중 세션의 상세 정보를 조회합니다.

#### 응답
```json
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "user_id": "uuid",
    "started_at": "2024-01-01T10:00:00Z",
    "ended_at": "2024-01-01T11:00:00Z",
    "goal_min": 60,
    "context_tag": "수학 공부",
    "session_type": "study",
    "focus_score": 85,
    "notes": "미적분학 복습"
  }
}
```

---

## 2. AI/ML 분석 API

### 2.1 발화 분석

**POST** `/api/classify-speech`

음성 인식된 발화 텍스트를 분석하여 공부 관련성을 판단합니다.

#### 요청 본문
```json
{
  "transcript": "오늘 미적분학 공부를 했어"
}
```

#### 응답
```json
{
  "success": true,
  "data": {
    "isStudyRelated": true,
    "confidence": 0.9,
    "reasoning": "GPT 분석: 공부 관련 발화",
    "method": "gpt",
    "transcript": "오늘 미적분학 공부를 했어"
  },
  "message": "GPT로 발화를 성공적으로 분석했습니다."
}
```

### 2.2 제스처 특징 분석

**POST** `/api/gesture-features`

웹캠을 통한 제스처 분석 데이터를 처리합니다.

#### 요청 본문
```json
{
  "gesture_data": {
    "head_position": { "x": 0.5, "y": 0.3 },
    "eye_gaze": { "x": 0.6, "y": 0.4 },
    "posture_score": 0.8
  }
}
```

### 2.3 ML 특징 분석

**POST** `/api/ml-features`

머신러닝 모델을 통한 집중도 분석 데이터를 처리합니다.

---

## 3. 집중도 점수 API

### 3.1 집중도 점수 계산

**POST** `/api/focus-score`

실시간 집중도 점수를 계산하고 업데이트합니다.

#### 요청 본문
```json
{
  "session_id": "uuid",
  "audio_score": 0.8,
  "gesture_score": 0.7,
  "posture_score": 0.9
}
```

#### 응답
```json
{
  "success": true,
  "data": {
    "focus_score": 80,
    "components": {
      "audio": 0.8,
      "gesture": 0.7,
      "posture": 0.9
    }
  }
}
```

---

## 4. 소셜 기능 API

### 4.1 스터디룸 관리

#### 4.1.1 스터디룸 목록 조회

**GET** `/api/social/study-room`

활성 스터디룸 목록을 조회합니다.

#### 쿼리 파라미터
- `withChallenges` (boolean): 챌린지 정보 포함 여부
- `page` (number): 페이지 번호
- `limit` (number): 페이지당 항목 수

#### 응답
```json
{
  "success": true,
  "data": [
    {
      "room_id": "uuid",
      "name": "수학 스터디룸",
      "description": "미적분학 공부방",
      "host_id": "uuid",
      "max_participants": 10,
      "current_participants": 5,
      "session_type": "study",
      "is_active": true,
      "linked_challenge": {
        "challenge_id": "uuid",
        "title": "2시간 집중하기",
        "type": "team"
      }
    }
  ]
}
```

#### 4.1.2 스터디룸 생성

**POST** `/api/social/study-room`

새로운 스터디룸을 생성합니다.

#### 요청 본문
```json
{
  "name": "수학 스터디룸",
  "description": "미적분학 공부방",
  "max_participants": 10,
  "session_type": "study",
  "goal_minutes": 120
}
```

#### 4.1.3 스터디룸 참가

**POST** `/api/social/study-room/[roomId]/join`

스터디룸에 참가합니다.

#### 4.1.4 스터디룸 퇴장

**POST** `/api/social/study-room/[roomId]/leave`

스터디룸에서 퇴장합니다.

#### 4.1.5 스터디룸 참가자 목록

**GET** `/api/social/study-room/[roomId]/participants`

스터디룸 참가자 목록을 조회합니다.

### 4.2 챌린지 관리

#### 4.2.1 챌린지 목록 조회

**GET** `/api/social/challenge`

사용 가능한 챌린지 목록을 조회합니다.

#### 4.2.2 챌린지 생성

**POST** `/api/social/challenge`

새로운 챌린지를 생성합니다.

#### 요청 본문
```json
{
  "title": "2시간 집중하기",
  "description": "하루 2시간 집중 공부하기",
  "type": "personal",
  "target_value": 120,
  "unit": "minutes",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

#### 4.2.3 챌린지 참가

**POST** `/api/social/challenge/[challengeId]/join`

챌린지에 참가합니다.

#### 4.2.4 챌린지 진행도 업데이트

**POST** `/api/social/challenge/[challengeId]/tick`

챌린지 진행도를 업데이트합니다.

### 4.3 친구 관리

#### 4.3.1 친구 목록 조회

**GET** `/api/social/friends`

친구 목록을 조회합니다.

#### 4.3.2 친구 검색

**GET** `/api/social/friends/search`

사용자를 검색합니다.

#### 쿼리 파라미터
- `query` (string): 검색어

#### 4.3.3 친구 요청

**POST** `/api/social/friends/[friendId]`

친구 요청을 보냅니다.

#### 4.3.4 친구 요청 응답

**POST** `/api/social/friends/requests`

친구 요청에 응답합니다.

#### 요청 본문
```json
{
  "request_id": "uuid",
  "action": "accept" // or "reject"
}
```

#### 4.3.5 친구 랭킹

**GET** `/api/social/friends/ranking`

친구들의 집중도 랭킹을 조회합니다.

---

## 5. 프로필 관리 API

### 5.1 프로필 조회

**GET** `/api/profile`

현재 사용자의 프로필 정보를 조회합니다.

#### 응답
```json
{
  "user_id": "uuid",
  "display_name": "홍길동",
  "handle": "honggildong",
  "avatar_url": "https://example.com/avatar.jpg",
  "bio": "열심히 공부하는 학생입니다",
  "school": "서울대학교",
  "major": "컴퓨터공학과",
  "status": "online"
}
```

### 5.2 프로필 업데이트

**PUT** `/api/profile`

프로필 정보를 업데이트합니다.

#### 요청 본문
```json
{
  "display_name": "홍길동",
  "handle": "honggildong",
  "bio": "열심히 공부하는 학생입니다",
  "school": "서울대학교",
  "major": "컴퓨터공학과"
}
```

### 5.3 프로필 이미지 업로드

**POST** `/api/profile/upload-avatar`

프로필 이미지를 업로드합니다.

#### 요청 본문
```json
{
  "avatar_file": "base64_encoded_image"
}
```

---

## 6. 리포트 및 통계 API

### 6.1 일일 통계

**GET** `/api/report/daily-stats`

일일 집중도 통계를 조회합니다.

#### 쿼리 파라미터
- `days` (number): 조회할 일수 (기본값: 30)

#### 응답
```json
{
  "success": true,
  "data": {
    "dailyStats": [
      {
        "date": "2024-01-01",
        "sessions": 3,
        "totalTime": 180,
        "averageScore": 85,
        "hasData": true
      }
    ],
    "totalStats": {
      "totalDays": 30,
      "activeDays": 25,
      "totalSessions": 75,
      "totalFocusTime": 4500,
      "averageScore": 82
    }
  }
}
```

### 6.2 주간 리포트

**GET** `/api/report/weekly`

주간 집중도 리포트를 조회합니다.

### 6.3 일일 리포트

**GET** `/api/report/daily/[date]`

특정 날짜의 상세 리포트를 조회합니다.

### 6.4 트렌드 분석

**GET** `/api/reports/trend`

집중도 트렌드를 분석합니다.

---

## 7. 개인 챌린지 API

### 7.1 개인 챌린지 목록

**GET** `/api/challenges/personal`

개인 챌린지 목록을 조회합니다.

### 7.2 개인 챌린지 생성

**POST** `/api/challenges/personal`

새로운 개인 챌린지를 생성합니다.

### 7.3 개인 챌린지 진행도

**GET** `/api/challenges/personal/progress`

개인 챌린지 진행도를 조회합니다.

---

## 8. 루틴 관리 API

### 8.1 루틴 조회

**GET** `/api/routine`

사용자의 학습 루틴을 조회합니다.

### 8.2 루틴 생성/업데이트

**POST** `/api/routine`

학습 루틴을 생성하거나 업데이트합니다.

---

## 9. 보상 시스템 API

### 9.1 보상 조회

**GET** `/api/reward`

사용자의 보상 정보를 조회합니다.

### 9.2 보상 획득

**POST** `/api/reward`

보상을 획득합니다.

---

## 10. 학습 인사이트 API

### 10.1 학습 인사이트 생성

**POST** `/api/ai/learning-insights`

AI를 활용한 학습 인사이트를 생성합니다.

#### 요청 본문
```json
{
  "session_data": {
    "focus_scores": [85, 90, 75, 88],
    "session_durations": [60, 90, 45, 75],
    "context_tags": ["수학", "영어", "수학", "과학"]
  }
}
```

#### 응답
```json
{
  "success": true,
  "data": {
    "insights": [
      "수학 공부 시 집중도가 가장 높습니다",
      "90분 이상 공부할 때 집중도가 떨어집니다"
    ],
    "recommendations": [
      "수학 공부를 하루의 시작에 배치하세요",
      "세션을 60분 단위로 나누어 진행하세요"
    ]
  }
}
```

---

## 11. 노트 관리 API

### 11.1 노트 조회

**GET** `/api/note`

학습 노트를 조회합니다.

### 11.2 노트 생성/업데이트

**POST** `/api/note`

학습 노트를 생성하거나 업데이트합니다.

---

## 12. 실시간 상태 전송 API

### 12.1 학습 상태 전송

**POST** `/api/send-study-status`

실시간 학습 상태를 전송합니다.

#### 요청 본문
```json
{
  "room_id": "uuid",
  "status": "studying",
  "focus_score": 85,
  "current_task": "미적분학 문제 풀이"
}
```

---

## 에러 코드

| 상태 코드 | 설명 |
|-----------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스를 찾을 수 없음 |
| 500 | 서버 내부 오류 |

## 개발 환경 설정

### 환경 변수

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI 설정
OPENAI_API_KEY=your_openai_api_key

# 기타 설정
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### 로컬 개발 서버 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

## 테스트 API

개발 및 디버깅을 위한 테스트 API들이 제공됩니다:

- `GET /api/test` - 기본 테스트
- `GET /api/test-auth` - 인증 테스트
- `GET /api/test-db` - 데이터베이스 연결 테스트
- `GET /api/test-focus-status` - 집중 상태 테스트
- `GET /api/test-session-data` - 세션 데이터 테스트

---

## 참고 사항

1. **실시간 기능**: WebSocket을 통한 실시간 통신이 지원됩니다.
2. **파일 업로드**: 이미지 업로드는 Base64 인코딩을 사용합니다.
3. **페이지네이션**: 목록 조회 API는 모두 페이지네이션을 지원합니다.
4. **에러 처리**: 모든 API는 표준화된 에러 응답 형식을 사용합니다.
5. **인증**: JWT 토큰 기반 인증이 모든 보호된 API에 적용됩니다.

이 문서는 지속적으로 업데이트됩니다. 최신 정보는 프로젝트 저장소를 참조하세요.

