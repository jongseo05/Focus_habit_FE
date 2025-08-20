# 스터디룸 카메라 상태 실시간 동기화 구현 Todo

## 📋 현재 상황 분석

### ✅ 기존 구현된 기능들
- `StudyRoomHeader`에 카메라 토글 버튼 존재
- `useVideoRoom` 훅으로 웹캠 스트림 관리
- WebSocket 기반 실시간 통신 인프라
- Supabase Realtime으로 참가자 상태 동기화
- 집중도 점수 실시간 업데이트

### ❌ 부족한 부분
- 카메라 ON/OFF 상태가 다른 참가자에게 실시간 전송되지 않음
- 참가자별 카메라 상태 표시 UI 없음
- 카메라 상태 변경 시 알림 기능 없음

## 🎯 구현 Todo 목록

### 1단계: 데이터베이스 스키마 확장

#### 1.1 새로운 마이그레이션 파일 생성
- [ ] `supabase/migrations/20241201000007_add_camera_state.sql` 생성
- [ ] `room_participants` 테이블에 카메라 상태 컬럼 추가
  ```sql
  ALTER TABLE room_participants 
  ADD COLUMN is_video_enabled BOOLEAN DEFAULT false,
  ADD COLUMN is_audio_enabled BOOLEAN DEFAULT false,
  ADD COLUMN camera_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  ```

#### 1.2 인덱스 및 트리거 추가
- [ ] 카메라 상태 업데이트 시간 인덱스 생성
- [ ] 카메라 상태 변경 시 자동 업데이트 트리거 추가

### 2단계: TypeScript 타입 정의 확장

#### 2.1 WebSocket 메시지 타입 확장
- [ ] `src/types/websocket.ts`에 카메라 상태 메시지 타입 추가
  ```typescript
  interface CameraStateMessage {
    type: 'camera_state_update'
    user_id: string
    room_id: string
    is_video_enabled: boolean
    is_audio_enabled: boolean
    timestamp: string
  }
  ```

#### 2.2 참가자 타입 확장
- [ ] `src/types/social.ts`의 `ParticipantWithUser` 인터페이스 확장
  ```typescript
  interface ParticipantWithUser {
    // 기존 필드들...
    is_video_enabled: boolean
    is_audio_enabled: boolean
    camera_updated_at: string
  }
  ```

#### 2.3 API 응답 타입 확장
- [ ] `src/types/base.ts`에 카메라 상태 API 응답 타입 추가

### 3단계: WebSocket 클라이언트 확장

#### 3.1 WebSocket 클라이언트 수정
- [ ] `src/lib/websocket/studyRoomClient.ts`에 카메라 상태 전송 함수 추가
  ```typescript
  sendCameraStateUpdate(isVideoEnabled: boolean, isAudioEnabled: boolean)
  ```
- [ ] 카메라 상태 변경 메시지 수신 핸들러 추가
- [ ] 다른 참가자의 카메라 상태 변경 시 콜백 함수 호출

#### 3.2 WebSocket 핸들러 확장
- [ ] `src/lib/websocket/socialHandler.ts`에 카메라 상태 처리 로직 추가

### 4단계: API 엔드포인트 추가

#### 4.1 카메라 상태 관리 API
- [ ] `src/app/api/social/study-room/[roomId]/camera-state/route.ts` 생성
  ```typescript
  // POST: 카메라 상태 업데이트
  // GET: 현재 참가자들의 카메라 상태 조회
  ```

#### 4.2 참가자 목록 API 수정
- [ ] `src/app/api/social/study-room/[roomId]/participants/route.ts`에 카메라 상태 포함

### 5단계: 훅 확장

#### 5.1 useVideoRoom 훅 확장
- [ ] `src/hooks/useVideoRoom.ts`에 실시간 동기화 기능 추가
  ```typescript
  // 카메라 상태 변경 시 WebSocket으로 전송
  // 다른 참가자의 카메라 상태 변경 수신
  ```

#### 5.2 useStudyRoomRealtime 훅 확장
- [ ] `src/hooks/useStudyRoomRealtime.ts`에 카메라 상태 동기화 추가
- [ ] `src/hooks/useStudyRoomRealtimeV2.ts`에 카메라 상태 동기화 추가

#### 5.3 새로운 훅 생성
- [ ] `src/hooks/useCameraStateSync.ts` 생성 (카메라 상태 동기화 전용)

### 6단계: UI 컴포넌트 확장

#### 6.1 참가자 패널 확장
- [ ] `src/components/studyroom/participants/ParticipantsPanel.tsx`에 카메라 상태 표시
  ```typescript
  // 각 참가자 옆에 카메라/마이크 아이콘 표시
  // 실시간 상태 업데이트
  ```

#### 6.2 비디오 그리드 확장
- [ ] `src/components/social/VideoGrid.tsx`에 카메라 상태 반영
  ```typescript
  // 카메라가 꺼진 참가자는 비디오 화면 대신 아바타 표시
  ```

#### 6.3 헤더 컴포넌트 수정
- [ ] `src/components/studyroom/StudyRoomHeader.tsx`에 카메라 상태 표시 개선

### 7단계: 알림 시스템 확장

#### 7.1 알림 메시지 추가
- [ ] 카메라 ON/OFF 시 알림 메시지 추가
- [ ] `src/components/studyroom/notifications/NotificationPanel.tsx`에 카메라 상태 알림 표시

#### 7.2 알림 타입 확장
- [ ] `src/types/social.ts`에 카메라 관련 알림 타입 추가

### 8단계: 상태 관리 확장

#### 8.1 스터디룸 스토어 확장
- [ ] `src/stores/studyRoomStore.ts`에 카메라 상태 관리 추가
  ```typescript
  interface StudyRoomState {
    // 기존 상태들...
    participantCameraStates: Map<string, {
      isVideoEnabled: boolean
      isAudioEnabled: boolean
      updatedAt: string
    }>
  }
  ```

#### 8.2 온라인 상태 스토어 확장
- [ ] `src/stores/onlineStatusStore.ts`에 카메라 상태 포함

### 9단계: 성능 최적화

#### 9.1 메모이제이션 적용
- [ ] 카메라 상태 변경 시 불필요한 리렌더링 방지
- [ ] React.memo, useMemo, useCallback 적절히 사용

#### 9.2 배치 업데이트
- [ ] 여러 참가자의 카메라 상태 변경을 배치로 처리

### 10단계: 에러 처리 및 예외 상황

#### 10.1 에러 처리
- [ ] 카메라 권한 거부 시 처리
- [ ] WebSocket 연결 실패 시 처리
- [ ] 네트워크 오류 시 재시도 로직

#### 10.2 예외 상황 처리
- [ ] 참가자가 방을 나갈 때 카메라 상태 정리
- [ ] 브라우저 탭 전환 시 카메라 상태 관리

## 🔧 구현 우선순위

### High Priority (1-2주)
1. 데이터베이스 스키마 확장
2. WebSocket 메시지 타입 확장
3. 기본적인 카메라 상태 전송/수신 기능
4. 참가자 패널에 카메라 상태 표시

### Medium Priority (2-3주)
1. VideoGrid에서 카메라 상태 반영
2. 알림 시스템 확장
3. 상태 관리 최적화

### Low Priority (3-4주)
1. 고급 기능 (카메라 권한 관리, 품질 설정 등)
2. 성능 최적화
3. 에러 처리 강화

## 🚀 구현 시작점

가장 먼저 시작할 부분은 **데이터베이스 스키마 확장**과 **WebSocket 메시지 타입 확장**입니다.

### 첫 번째 작업: 데이터베이스 스키마 확장
```sql
-- supabase/migrations/20241201000007_add_camera_state.sql
ALTER TABLE room_participants 
ADD COLUMN is_video_enabled BOOLEAN DEFAULT false,
ADD COLUMN is_audio_enabled BOOLEAN DEFAULT false,
ADD COLUMN camera_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX idx_room_participants_camera_state ON room_participants(room_id, is_video_enabled);
```

### 두 번째 작업: TypeScript 타입 확장
```typescript
// src/types/websocket.ts에 추가
interface CameraStateMessage {
  type: 'camera_state_update'
  user_id: string
  room_id: string
  is_video_enabled: boolean
  is_audio_enabled: boolean
  timestamp: string
}
```

## 📝 진행 상황 체크리스트

- [ ] 1단계: 데이터베이스 스키마 확장
- [ ] 2단계: TypeScript 타입 정의 확장
- [ ] 3단계: WebSocket 클라이언트 확장
- [ ] 4단계: API 엔드포인트 추가
- [ ] 5단계: 훅 확장
- [ ] 6단계: UI 컴포넌트 확장
- [ ] 7단계: 알림 시스템 확장
- [ ] 8단계: 상태 관리 확장
- [ ] 9단계: 성능 최적화
- [ ] 10단계: 에러 처리 및 예외 상황

## 🔍 테스트 시나리오

1. **기본 기능 테스트**
   - 카메라 ON/OFF 버튼 클릭
   - 다른 참가자에게 상태 전송 확인
   - 참가자 패널에 상태 표시 확인

2. **실시간 동기화 테스트**
   - 여러 브라우저에서 동시 접속
   - 카메라 상태 변경 시 실시간 반영 확인
   - 네트워크 끊김 시 재연결 후 상태 복원 확인

3. **에러 상황 테스트**
   - 카메라 권한 거부 시 처리
   - WebSocket 연결 실패 시 처리
   - 참가자 퇴장 시 상태 정리 확인
