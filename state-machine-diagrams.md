# FocusAI 상태 머신 다이어그램

## 1. 집중 세션 상태 머신

```mermaid
stateDiagram-v2
    [*] --> Idle: 앱 시작
    
    Idle --> SessionSetup: 세션 시작 버튼 클릭
    SessionSetup --> PermissionCheck: 설정 완료
    
    PermissionCheck --> CameraPermission: 카메라 권한 요청
    PermissionCheck --> MicrophonePermission: 마이크 권한 요청
    
    CameraPermission --> MicrophonePermission: 카메라 권한 승인
    MicrophonePermission --> ModelLoading: 마이크 권한 승인
    
    ModelLoading --> Active: ML 모델 로드 완료
    ModelLoading --> Error: 모델 로드 실패
    
    Active --> Paused: 일시정지
    Active --> Distracted: 방해 요소 감지
    Active --> Break: 휴식 모드
    
    Paused --> Active: 재개
    Paused --> Idle: 세션 종료
    
    Distracted --> Active: 집중 복귀
    Distracted --> Break: 휴식 필요
    
    Break --> Active: 휴식 완료
    Break --> Idle: 세션 종료
    
    Active --> SessionComplete: 목표 시간 달성
    Active --> Idle: 수동 종료
    
    SessionComplete --> Idle: 결과 확인 완료
    Error --> Idle: 에러 처리 완료
```

## 2. 사용자 인증 상태 머신

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated: 앱 시작
    
    Unauthenticated --> LoginForm: 로그인 버튼 클릭
    Unauthenticated --> SignupForm: 회원가입 버튼 클릭
    
    LoginForm --> Authenticating: 로그인 정보 입력
    SignupForm --> CreatingAccount: 회원가입 정보 입력
    
    Authenticating --> Authenticated: 로그인 성공
    Authenticating --> LoginError: 로그인 실패
    
    CreatingAccount --> Authenticated: 회원가입 성공
    CreatingAccount --> SignupError: 회원가입 실패
    
    LoginError --> LoginForm: 재시도
    SignupError --> SignupForm: 재시도
    
    Authenticated --> ProfileSetup: 프로필 설정 필요
    Authenticated --> Dashboard: 프로필 설정 완료
    
    ProfileSetup --> Dashboard: 프로필 설정 완료
    
    Dashboard --> Authenticated: 로그아웃
    Dashboard --> Unauthenticated: 세션 만료
    
    Authenticated --> Unauthenticated: 로그아웃
```

## 3. ML 모델 상태 머신

```mermaid
stateDiagram-v2
    [*] --> ModelUnloaded: 초기 상태
    
    ModelUnloaded --> ModelLoading: 모델 로드 요청
    
    ModelLoading --> ModelLoaded: 로드 성공
    ModelLoading --> ModelLoadError: 로드 실패
    
    ModelLoaded --> ModelInitializing: 초기화 시작
    ModelInitializing --> ModelReady: 초기화 완료
    
    ModelReady --> Processing: 데이터 처리 시작
    Processing --> ModelReady: 처리 완료
    
    Processing --> ModelError: 처리 중 오류
    ModelError --> ModelReady: 오류 복구
    
    ModelLoadError --> ModelUnloaded: 재시도
    ModelLoadError --> ModelLoading: 자동 재시도
    
    ModelReady --> ModelUnloaded: 모델 언로드
    ModelError --> ModelUnloaded: 강제 언로드
```

## 4. 실시간 데이터 처리 상태 머신

```mermaid
stateDiagram-v2
    [*] --> DataIdle: 초기 상태
    
    DataIdle --> DataCollecting: 데이터 수집 시작
    
    DataCollecting --> ProcessingVideo: 비디오 프레임 처리
    DataCollecting --> ProcessingAudio: 오디오 스트림 처리
    
    ProcessingVideo --> DataAnalyzing: 비디오 분석 완료
    ProcessingAudio --> DataAnalyzing: 오디오 분석 완료
    
    DataAnalyzing --> ScoreCalculating: 점수 계산
    ScoreCalculating --> EventDetecting: 이벤트 감지
    
    EventDetecting --> DataStoring: 데이터 저장
    EventDetecting --> AlertTriggering: 알림 발생
    
    DataStoring --> DataIdle: 저장 완료
    AlertTriggering --> DataIdle: 알림 처리 완료
    
    DataCollecting --> DataError: 데이터 수집 오류
    DataError --> DataIdle: 오류 복구
    DataError --> DataCollecting: 자동 재시도
```

## 5. 웹소켓 연결 상태 머신

```mermaid
stateDiagram-v2
    [*] --> Disconnected: 초기 상태
    
    Disconnected --> Connecting: 연결 시도
    
    Connecting --> Connected: 연결 성공
    Connecting --> ConnectionFailed: 연결 실패
    
    Connected --> Authenticating: 인증 요청
    Authenticating --> Authenticated: 인증 성공
    Authenticating --> AuthFailed: 인증 실패
    
    Authenticated --> DataTransmitting: 데이터 전송
    DataTransmitting --> Authenticated: 전송 완료
    
    Authenticated --> Reconnecting: 연결 끊김 감지
    Reconnecting --> Connected: 재연결 성공
    Reconnecting --> Disconnected: 재연결 실패
    
    ConnectionFailed --> Disconnected: 연결 실패 처리
    AuthFailed --> Disconnected: 인증 실패 처리
    
    Authenticated --> Disconnected: 수동 연결 해제
```

## 6. 사용자 집중도 상태 머신

```mermaid
stateDiagram-v2
    [*] --> Unknown: 초기 상태
    
    Unknown --> HighlyFocused: 높은 집중도
    Unknown --> ModeratelyFocused: 보통 집중도
    Unknown --> LowFocused: 낮은 집중도
    Unknown --> Distracted: 방해 상태
    
    HighlyFocused --> ModeratelyFocused: 집중도 감소
    HighlyFocused --> LowFocused: 집중도 급감
    HighlyFocused --> Distracted: 방해 요소 발생
    
    ModeratelyFocused --> HighlyFocused: 집중도 향상
    ModeratelyFocused --> LowFocused: 집중도 감소
    ModeratelyFocused --> Distracted: 방해 요소 발생
    
    LowFocused --> ModeratelyFocused: 집중도 회복
    LowFocused --> HighlyFocused: 집중도 급상승
    LowFocused --> Distracted: 방해 요소 발생
    
    Distracted --> LowFocused: 방해 요소 해결
    Distracted --> ModeratelyFocused: 빠른 복귀
    Distracted --> HighlyFocused: 즉시 집중
```

## 7. 알림 시스템 상태 머신

```mermaid
stateDiagram-v2
    [*] --> NotificationIdle: 초기 상태
    
    NotificationIdle --> NotificationTriggered: 알림 조건 발생
    
    NotificationTriggered --> NotificationQueued: 알림 큐에 추가
    NotificationQueued --> NotificationDisplaying: 알림 표시
    
    NotificationDisplaying --> NotificationAcknowledged: 사용자 확인
    NotificationDisplaying --> NotificationDismissed: 사용자 거부
    NotificationDisplaying --> NotificationExpired: 알림 만료
    
    NotificationAcknowledged --> NotificationIdle: 알림 처리 완료
    NotificationDismissed --> NotificationIdle: 알림 거부 완료
    NotificationExpired --> NotificationIdle: 알림 만료 처리
    
    NotificationTriggered --> NotificationSuppressed: 알림 억제
    NotificationSuppressed --> NotificationIdle: 억제 완료
```

## 8. 데이터 동기화 상태 머신

```mermaid
stateDiagram-v2
    [*] --> SyncIdle: 초기 상태
    
    SyncIdle --> SyncChecking: 동기화 상태 확인
    
    SyncChecking --> SyncRequired: 동기화 필요
    SyncChecking --> SyncUpToDate: 최신 상태
    
    SyncRequired --> Syncing: 동기화 시작
    Syncing --> SyncUploading: 업로드 중
    Syncing --> SyncDownloading: 다운로드 중
    
    SyncUploading --> SyncDownloading: 업로드 완료
    SyncDownloading --> SyncProcessing: 다운로드 완료
    
    SyncProcessing --> SyncComplete: 처리 완료
    SyncProcessing --> SyncError: 처리 오류
    
    SyncComplete --> SyncUpToDate: 동기화 완료
    SyncError --> SyncRetrying: 재시도
    
    SyncRetrying --> Syncing: 재시도 시작
    SyncRetrying --> SyncFailed: 재시도 실패
    
    SyncFailed --> SyncIdle: 실패 처리
    SyncUpToDate --> SyncIdle: 대기 상태
```

## 9. 에러 처리 상태 머신

```mermaid
stateDiagram-v2
    [*] --> Normal: 정상 상태
    
    Normal --> ErrorDetected: 오류 감지
    
    ErrorDetected --> ErrorAnalyzing: 오류 분석
    ErrorAnalyzing --> ErrorClassified: 오류 분류
    
    ErrorClassified --> ErrorRecoverable: 복구 가능
    ErrorClassified --> ErrorCritical: 치명적 오류
    
    ErrorRecoverable --> ErrorRecovering: 복구 시도
    ErrorRecovering --> Normal: 복구 성공
    ErrorRecovering --> ErrorCritical: 복구 실패
    
    ErrorCritical --> ErrorReporting: 오류 보고
    ErrorReporting --> ErrorHandling: 오류 처리
    
    ErrorHandling --> Normal: 처리 완료
    ErrorHandling --> ErrorFatal: 처리 불가
    
    ErrorFatal --> SystemShutdown: 시스템 종료
    SystemShutdown --> [*]: 완전 종료
```

## 10. 사용자 목표 설정 상태 머신

```mermaid
stateDiagram-v2
    [*] --> NoGoal: 목표 없음
    
    NoGoal --> GoalSetting: 목표 설정 시작
    GoalSetting --> GoalConfigured: 목표 설정 완료
    
    GoalConfigured --> GoalActive: 목표 활성화
    GoalActive --> GoalProgressing: 목표 진행 중
    
    GoalProgressing --> GoalAchieved: 목표 달성
    GoalProgressing --> GoalFailed: 목표 실패
    GoalProgressing --> GoalPaused: 목표 일시정지
    
    GoalPaused --> GoalProgressing: 목표 재개
    GoalPaused --> GoalAbandoned: 목표 포기
    
    GoalAchieved --> GoalRewarded: 보상 지급
    GoalFailed --> GoalRetry: 재시도
    GoalAbandoned --> NoGoal: 목표 초기화
    
    GoalRewarded --> NoGoal: 새로운 목표 설정
    GoalRetry --> GoalActive: 목표 재활성화
```

## 사용 방법

### 1. Mermaid Live Editor에서 확인
- https://mermaid.live/ 접속
- 위의 코드를 복사하여 붙여넣기
- 실시간으로 상태 머신 확인

### 2. GitHub/GitLab에서 렌더링
- 마크다운 파일에 직접 작성
- 자동으로 상태 머신 렌더링

### 3. VS Code에서 미리보기
- Mermaid Preview 확장 설치
- 실시간 미리보기 가능

## 상태 머신 활용 방법

### 1. 개발 단계
- **상태 정의**: 각 상태의 명확한 정의
- **전이 조건**: 상태 간 전환 조건 명시
- **에러 처리**: 예외 상황 처리 방법

### 2. 테스트 단계
- **상태 테스트**: 각 상태별 동작 검증
- **전이 테스트**: 상태 전환 로직 검증
- **에러 테스트**: 오류 상황 처리 검증

### 3. 문서화
- **개발자 문서**: 시스템 동작 방식 설명
- **사용자 가이드**: 사용자 경험 설명
- **유지보수 가이드**: 문제 해결 방법

## 추가 개선 사항

### 1. 상태 머신 확장
- 더 세분화된 상태 추가
- 복잡한 전이 조건 구현
- 병렬 상태 처리

### 2. 모니터링 연동
- 상태 변화 로깅
- 성능 메트릭 수집
- 알림 시스템 연동

### 3. 시각화 개선
- 상태별 색상 구분
- 전이 조건 표시
- 실시간 상태 표시 