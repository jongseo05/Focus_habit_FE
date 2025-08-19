# Focus Habit Frontend - 데이터 플로우 아키텍처

## 개요
실시간 집중도 분석과 소셜 기능을 갖춘 습관 관리 웹 애플리케이션의 전체 데이터 플로우를 정의합니다.

## 전체 데이터 플로우 구조

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              데이터 수집 레이어                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  웹캠 스트림    │    마이크 스트림    │    웨어러블 센서    │    사용자 행동      │
│  (10fps)       │    (실시간)        │    (선택적)        │    (마우스/키보드)   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              실시간 처리 파이프라인                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│  WebSocket      │    Audio Pipeline │    Gesture Recognition │    Behavior Track │
│  (프레임 전송)   │    (음성 분석)    │    (제스처 인식)      │    (활동 감지)     │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI 모델 분석 레이어                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│  GPT-4o-mini    │    Computer Vision│    Audio Analysis     │    ML Engine      │
│  (발화분석)     │    (시선/자세)    │    (음성 패턴)        │    (집중도 계산)   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              데이터 저장 및 동기화                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Supabase       │    Real-time      │    Local Cache        │    Session Store  │
│  (PostgreSQL)   │    (WebSocket)    │    (React Query)      │    (Zustand)      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UI 반영 및 리포트                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  실시간 차트     │    대시보드       │    리포트 생성        │    소셜 기능       │
│  (Recharts)     │    (Dashboard)    │    (ReportService)    │    (Study Room)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 1. 데이터 수집 레이어

### 1.1 웹캠 스트림 (10fps)
```typescript
// src/hooks/useFocusSessionWithGesture.ts
const mediaStream = useFocusSessionWithGesture(
  sessionStateState.isRunning, 
  sessionSync.currentSessionId,
  {
    frameRate: 10, // 1초에 10번 (10fps)
    enableGestureRecognition: true,
    gestureJpegQuality: 0.95
  }
)
```

**수집 데이터:**
- 프레임 이미지 (JPEG Base64)
- 눈 상태 (열림/닫힘)
- 머리 자세 (pitch, yaw, roll)
- 시선 방향
- EAR 값 (Eye Aspect Ratio)

### 1.2 마이크 스트림 (실시간)
```typescript
// src/components/HybridAudioPipeline.tsx
const microphoneStream = useMicrophoneStream()
```

**수집 데이터:**
- 오디오 레벨 (RMS dB)
- 음성 인식 텍스트
- 발화 지속시간
- 음성 패턴 분석

### 1.3 웨어러블 센서 (선택적)
```typescript
// 향후 확장 예정
interface WearableData {
  heartRate?: number
  movement?: number
  posture?: string
  stressLevel?: number
}
```

### 1.4 사용자 행동 감지
```typescript
// src/lib/focusScoreEngine.ts
interface BehaviorFeatures {
  mouseActivity: boolean
  keyboardActivity: boolean
  tabSwitches: number
  idleTime: number
}
```

## 2. 실시간 처리 파이프라인

### 2.1 WebSocket 프레임 전송
```typescript
// src/lib/websocket/client.ts
class FrameStreamer {
  start(): void {
    this.intervalId = setInterval(() => {
      const result = captureFrameAsJpegBase64(this.video, optimalQuality)
      this.onFrame(result.base64)
    }, 1000 / this.frameRate)
  }
}
```

### 2.2 Audio Pipeline
```typescript
// src/components/HybridAudioPipeline.tsx
const processSpeechSegment = useCallback(async () => {
  const gptResult = await analyzeSpeechWithGPT(text)
  const context = analyzeTextContext(text)
  const finalJudgment = gptResult.isStudyRelated && contextualWeight > 0.3
}, [])
```

### 2.3 Gesture Recognition
```typescript
// src/hooks/useGestureRecognition.ts
const { sendFrame, isConnected } = useWebSocket({
  url: 'wss://focushabit.site/ws/analysis'
}, {
  onMessage: (message: any) => {
    if (message.type === 'frame_analysis_result') {
      setLastFrameAnalysis(analysisData)
    }
  }
})
```

## 3. AI 모델 분석 레이어

### 3.1 GPT-4o-mini 발화분석
```typescript
// src/app/api/classify-speech/route.ts
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: prompt }],
  temperature: 0,
  max_tokens: 10,
})
```

**분석 결과:**
- 공부 관련성 판단 (study/no_study)
- 신뢰도 점수 (0.0-1.0)
- 문맥 분석

### 3.2 Computer Vision 분석
```typescript
// WebSocket 서버에서 처리
interface WebcamFrameAnalysisResult {
  timestamp: number
  prediction_result: {
    prediction: number // 0-1 범위
    confidence: number
  }
  eye_status: {
    status: 'OPEN' | 'CLOSED' | 'PARTIAL'
    ear_value: number
  }
  head_pose: {
    pitch: number
    yaw: number
    roll: number
  }
}
```

### 3.3 ML Engine 집중도 계산
```typescript
// src/lib/focusScoreEngine.ts
export class FocusScoreEngine {
  private static readonly WEIGHTS = {
    visual: 0.35,    // 시각적 지표 (35%)
    audio: 0.30,     // 청각적 지표 (30%)
    behavior: 0.25,  // 행동 지표 (25%)
    time: 0.10       // 시간 지표 (10%)
  }

  static calculateFocusScore(features: FocusFeatures): FocusScoreResult {
    const scores = {
      visual: this.calculateVisualScore(features.visual),
      audio: this.calculateAudioScore(features.audio),
      behavior: this.calculateBehaviorScore(features.behavior),
      time: this.calculateTimeScore(features.time)
    }

    const finalScore = Math.round(
      scores.visual * this.WEIGHTS.visual +
      scores.audio * this.WEIGHTS.audio +
      scores.behavior * this.WEIGHTS.behavior +
      scores.time * this.WEIGHTS.time
    )

    return {
      score: Math.max(0, Math.min(100, finalScore)),
      confidence: this.calculateConfidence(features),
      breakdown: scores,
      analysis: this.generateAnalysis(scores, features)
    }
  }
}
```

## 4. 데이터 저장 및 동기화

### 4.1 Supabase 데이터베이스
```sql
-- 집중 세션 테이블
CREATE TABLE focus_session (
  session_id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  focus_score INTEGER,
  session_type TEXT,
  context_tag TEXT
);

-- 집중 샘플 데이터 테이블
CREATE TABLE focus_sample (
  session_id UUID REFERENCES focus_session(session_id),
  ts TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  score_conf FLOAT,
  topic_tag TEXT,
  rms_db FLOAT
);

-- 집중 이벤트 테이블
CREATE TABLE focus_event (
  event_id UUID PRIMARY KEY,
  session_id UUID REFERENCES focus_session(session_id),
  ts TIMESTAMP WITH TIME ZONE,
  event_type TEXT,
  payload JSONB
);
```

### 4.2 실시간 동기화
```typescript
// src/hooks/useSocialRealtime.ts
const useSocialRealtime = () => {
  useEffect(() => {
    const channel = supabase
      .channel('social-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'study_rooms' 
      }, (payload) => {
        // 실시간 업데이트 처리
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
```

### 4.3 로컬 캐시 (React Query)
```typescript
// src/hooks/useReport.ts
export function useTodaySessions(date: string) {
  return useQuery({
    queryKey: [...reportKeys.all, 'today', date],
    queryFn: async () => {
      const { data: sessions, error } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)
      
      return sessions || []
    },
    staleTime: 5 * 60 * 1000, // 5분
  })
}
```

### 4.4 세션 스토어 (Zustand)
```typescript
// src/stores/focusSessionStore.ts
export const useFocusSessionStore = create<FocusSessionStore>()(
  persist(
    (set, get) => ({
      isRunning: false,
      isPaused: false,
      elapsed: 0,
      focusScore: 0,
      errors: [],
      
      startSession: async () => {
        // 세션 시작 로직
      },
      
      updateFocusScore: (score: number) => {
        set({ focusScore: score })
      }
    }),
    {
      name: 'focus-session-store',
      partialize: (state) => ({
        isRunning: state.isRunning,
        isPaused: state.isPaused,
        elapsed: state.elapsed
      })
    }
  )
)
```

## 5. UI 반영 및 리포트

### 5.1 실시간 차트 (Recharts)
```typescript
// src/components/dashboard/charts/RealtimeFocusChart.tsx
const RealtimeFocusChart = ({ data }: { data: FocusScorePoint[] }) => {
  return (
    <LineChart data={data}>
      <Line 
        type="monotone" 
        dataKey="score" 
        stroke="#8884d8" 
        strokeWidth={2}
        dot={false}
      />
    </LineChart>
  )
}
```

### 5.2 대시보드 컴포넌트
```typescript
// src/app/dashboard/page.tsx
function DashboardContent() {
  const mediaStream = useFocusSessionWithGesture(
    sessionStateState.isRunning, 
    sessionSync.currentSessionId,
    {
      frameRate: 10,
      enableGestureRecognition: true,
      gestureJpegQuality: 0.95
    }
  )
  
  const microphoneStream = useMicrophoneStream()
  
  return (
    <div>
      <RealtimeFocusChart data={focusScores} />
      <CircularGauge value={focusScore} />
      <FocusSessionControls />
    </div>
  )
}
```

### 5.3 리포트 생성 서비스
```typescript
// src/lib/database/reportService.ts
export class ReportService {
  static async generateDailyReport(
    userId: string, 
    date: string
  ): Promise<ApiResponse<DailyReportType>> {
    // 1. 해당 날짜의 집중 세션 조회
    const { data: sessions } = await supabase
      .from('focus_session')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', `${date}T00:00:00`)
      .lt('started_at', `${date}T23:59:59`)

    // 2. 집중 샘플 데이터 조회
    const { data: samples } = await supabase
      .from('focus_sample')
      .select('*')
      .in('session_id', sessions?.map(s => s.session_id) || [])

    // 3. 리포트 데이터 구성
    return {
      success: true,
      data: {
        date,
        sessions: sessions || [],
        samples: samples || [],
        summary: calculateDailySummary(sessions, samples)
      }
    }
  }
}
```

### 5.4 소셜 기능 (Study Room)
```typescript
// src/components/social/StudyRoom.tsx
const StudyRoom = ({ roomId }: { roomId: string }) => {
  const { room, participants, currentGroupChallenges } = useStudyRoomState(roomId)
  
  return (
    <div>
      <StudyRoomHeader room={room} />
      <VideoGrid participants={participants} />
      <ChallengeHUD challenges={currentGroupChallenges} />
      <CompetitionPanel />
    </div>
  )
}
```

## 6. 데이터 플로우 시퀀스

### 6.1 세션 시작 시
1. **사용자 액션**: 대시보드에서 "세션 시작" 버튼 클릭
2. **세션 생성**: `focus_session` 테이블에 새 레코드 생성
3. **미디어 스트림 시작**: 웹캠, 마이크 권한 요청 및 스트림 시작
4. **WebSocket 연결**: 실시간 분석 서버에 연결
5. **UI 업데이트**: 세션 상태를 "실행 중"으로 변경

### 6.2 실시간 데이터 처리
1. **프레임 캡처**: 10fps로 웹캠 프레임 캡처
2. **WebSocket 전송**: Base64 인코딩된 프레임을 서버로 전송
3. **AI 분석**: 서버에서 Computer Vision 모델로 분석
4. **결과 수신**: 분석 결과를 WebSocket으로 수신
5. **집중도 계산**: ML Engine으로 최종 집중도 점수 계산
6. **데이터베이스 저장**: `focus_sample` 테이블에 저장
7. **UI 업데이트**: 실시간 차트 및 게이지 업데이트

### 6.3 음성 분석 처리
1. **음성 인식**: Web Speech API로 실시간 음성 인식
2. **텍스트 버퍼링**: 일정 길이의 텍스트가 쌓이면 분석
3. **GPT 분석**: `/api/classify-speech`로 공부 관련성 판단
4. **결과 저장**: `focus_event` 테이블에 이벤트 저장
5. **집중도 반영**: 음성 분석 결과를 집중도 계산에 반영

### 6.4 세션 종료 시
1. **사용자 액션**: "세션 종료" 버튼 클릭
2. **세션 업데이트**: `focus_session` 테이블에 종료 시간 기록
3. **리포트 생성**: 일일 요약 데이터 업데이트
4. **소셜 업데이트**: 스터디룸 자동 챌린지 진행사항 업데이트
5. **UI 정리**: 세션 종료 알림 및 결과 표시

## 7. 성능 최적화

### 7.1 네트워크 최적화
- **적응형 압축**: 네트워크 상태에 따른 JPEG 품질 조정
- **배치 전송**: 여러 프레임을 묶어서 전송
- **연결 풀링**: WebSocket 연결 재사용

### 7.2 메모리 관리
- **프레임 버퍼 제한**: 최대 100개 프레임만 메모리에 유지
- **가비지 컬렉션**: 주기적인 메모리 정리
- **이벤트 디바운싱**: 과도한 이벤트 발생 방지

### 7.3 캐싱 전략
- **React Query**: 서버 데이터 캐싱 (5분 stale time)
- **Zustand**: 클라이언트 상태 영속화
- **IndexedDB**: 대용량 데이터 로컬 저장

## 8. 에러 처리 및 복구

### 8.1 연결 실패 처리
```typescript
// src/hooks/useFocusSessionErrorHandler.ts
const handleWebSocketError = (error: Error) => {
  if (error.message.includes('connection failed')) {
    // 자동 재연결 시도
    setTimeout(() => {
      reconnectWebSocket()
    }, 5000)
  }
}
```

### 8.2 폴백 모드
- **GPT API 실패**: 키워드 기반 분석으로 폴백
- **웹캠 실패**: 마이크만으로 집중도 분석
- **네트워크 실패**: 로컬 캐시 사용

### 8.3 데이터 무결성
- **중복 방지**: 동일한 타임스탬프 데이터 중복 저장 방지
- **데이터 검증**: 저장 전 데이터 형식 및 범위 검증
- **백업 전략**: 중요 데이터의 로컬 백업

## 9. 확장성 고려사항

### 9.1 마이크로서비스 아키텍처
- **분석 서버**: 독립적인 AI 분석 서버
- **실시간 서버**: WebSocket 전용 서버
- **API 서버**: REST API 전용 서버

### 9.2 데이터 파이프라인
- **Apache Kafka**: 대용량 실시간 데이터 스트리밍
- **Redis**: 실시간 캐싱 및 세션 관리
- **Elasticsearch**: 로그 분석 및 검색

### 9.3 모니터링 및 로깅
- **Prometheus**: 메트릭 수집
- **Grafana**: 대시보드 시각화
- **ELK Stack**: 로그 분석

이 데이터 플로우 아키텍처를 통해 실시간 집중도 분석, AI 기반 행동 분류, 그리고 종합적인 리포트 시스템을 효율적으로 구현할 수 있습니다.
