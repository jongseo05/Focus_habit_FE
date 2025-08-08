# FocusAI 데이터 플로우 다이어그램

## 1. 전체 시스템 아키텍처

```mermaid
graph TB
    subgraph "사용자 레이어"
        A[사용자] --> B[웹 브라우저]
    end
    
    subgraph "프론트엔드 레이어"
        B --> C[Next.js 앱]
        C --> D[실시간 UI]
        C --> E[대시보드]
    end
    
    subgraph "ML 처리 레이어"
        F[웹캠 스트림] --> G[ONNX.js 모델]
        H[마이크 스트림] --> I[오디오 분석]
        G --> J[집중도 점수]
        I --> J
    end
    
    subgraph "데이터 레이어"
        J --> K[실시간 데이터]
        K --> L[Supabase DB]
        L --> M[통계 집계]
        M --> N[보고서 생성]
    end
    
    subgraph "통신 레이어"
        O[WebSocket] --> P[실시간 업데이트]
        Q[REST API] --> R[데이터 동기화]
    end
    
    C --> O
    C --> Q
    K --> O
    L --> Q
```

## 2. 집중 세션 데이터 플로우

```mermaid
sequenceDiagram
    participant U as 사용자
    participant F as 프론트엔드
    participant M as ML 모델
    participant W as WebSocket
    participant D as 데이터베이스
    participant R as 리포트

    U->>F: 집중 세션 시작
    F->>D: 세션 생성
    F->>M: ML 모델 초기화
    
    loop 실시간 모니터링
        F->>M: 웹캠/마이크 데이터 전송
        M->>M: 집중도 분석
        M->>F: 집중도 점수 반환
        F->>W: 실시간 업데이트 전송
        F->>D: 샘플 데이터 저장
        
        alt 이벤트 발생
            M->>F: 이벤트 감지 (전화, 방해 등)
            F->>D: 이벤트 저장
            F->>U: 알림 표시
        end
    end
    
    U->>F: 세션 종료
    F->>D: 세션 완료 처리
    D->>R: 일일/주간 통계 생성
    R->>F: 결과 표시
```

## 3. 데이터 저장 및 분석 플로우

```mermaid
flowchart LR
    subgraph "실시간 데이터"
        A[focus_sample] --> B[실시간 집중도]
        C[focus_event] --> D[이벤트 로그]
    end
    
    subgraph "집계 데이터"
        B --> E[daily_summary]
        B --> F[weekly_summary]
        D --> E
        D --> F
    end
    
    subgraph "분석 결과"
        E --> G[집중도 트렌드]
        F --> H[주간 리포트]
        G --> I[개선 제안]
        H --> I
    end
    
    subgraph "사용자 피드백"
        I --> J[습관 관리]
        I --> K[목표 설정]
        J --> L[성과 향상]
        K --> L
    end
```

## 4. ML 파이프라인 데이터 플로우

```mermaid
graph TD
    subgraph "입력 데이터"
        A[웹캠 프레임] --> B[이미지 전처리]
        C[오디오 스트림] --> D[오디오 전처리]
    end
    
    subgraph "ML 모델"
        B --> E[KoELECTRA 모델]
        D --> F[오디오 분석 모델]
        E --> G[집중도 점수 계산]
        F --> G
    end
    
    subgraph "후처리"
        G --> H[점수 정규화]
        H --> I[이벤트 감지]
        I --> J[결과 저장]
    end
    
    subgraph "실시간 피드백"
        J --> K[UI 업데이트]
        J --> L[알림 생성]
        K --> M[사용자 피드백]
        L --> M
    end
```

## 5. 사용자 경험 플로우

```mermaid
journey
    title FocusAI 사용자 여정
    section 등록 및 설정
      홈페이지 방문: 5: 사용자
      회원가입: 4: 사용자
      프로필 설정: 3: 사용자
      첫 세션 시작: 5: 사용자
    section 집중 세션
      세션 설정: 4: 사용자
      실시간 모니터링: 5: 사용자
      방해 요소 감지: 3: 사용자
      세션 완료: 5: 사용자
    section 분석 및 개선
      결과 확인: 4: 사용자
      트렌드 분석: 3: 사용자
      개선 제안 수용: 4: 사용자
      습관 형성: 5: 사용자
```

## 6. 시스템 성능 모니터링 플로우

```mermaid
graph LR
    subgraph "모니터링 지표"
        A[CPU 사용률] --> D[성능 대시보드]
        B[메모리 사용률] --> D
        C[네트워크 지연] --> D
        E[ML 모델 응답시간] --> D
        F[데이터베이스 쿼리 시간] --> D
    end
    
    subgraph "알림 시스템"
        D --> G{임계값 초과?}
        G -->|Yes| H[알림 발송]
        G -->|No| I[정상 상태]
        H --> J[개발팀 알림]
        H --> K[자동 스케일링]
    end
    
    subgraph "최적화"
        J --> L[성능 튜닝]
        K --> M[리소스 조정]
        L --> N[시스템 개선]
        M --> N
    end
```

## 사용 방법

### 1. Mermaid Live Editor
- https://mermaid.live/ 접속
- 위의 코드를 복사하여 붙여넣기
- 실시간으로 다이어그램 확인
- PNG, SVG 등으로 export

### 2. GitHub/GitLab
- 마크다운 파일에 직접 작성
- 자동으로 렌더링됨
- 버전 관리와 함께 문서화

### 3. VS Code
- Mermaid Preview 확장 설치
- 실시간 미리보기 가능

## 추가 추천 툴

### 실시간 모니터링
- **Prometheus + Grafana**: 시스템 메트릭 모니터링
- **Jaeger**: 분산 추적 시스템
- **ELK Stack**: 로그 분석 및 시각화

### 데이터 분석
- **Jupyter Notebook**: ML 모델 분석
- **Tableau**: 고급 데이터 시각화
- **Power BI**: 비즈니스 인텔리전스

### 협업 및 문서화
- **Confluence**: 팀 문서화
- **Notion**: 프로젝트 관리 및 문서화
- **Figma**: UI/UX 플로우 설계 