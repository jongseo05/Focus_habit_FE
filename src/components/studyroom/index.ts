// =====================================================
// 스터디룸 컴포넌트 배럴 익스포트
// =====================================================

// 메인 컴포넌트
export { StudyRoomV2 } from './StudyRoomV2'
export { StudyRoomHeader } from './StudyRoomHeader'

// 코어 컴포넌트
export { StudyRoomProvider, useStudyRoomContext } from './core/StudyRoomProvider'

// 세션 관리
export { FocusSessionPanel } from './session/FocusSessionPanel'

// 참가자 관리
export { ParticipantsPanel } from './participants/ParticipantsPanel'

// 알림 시스템
export { NotificationPanel } from './notifications/NotificationPanel'

// 모달 컴포넌트
export { EncouragementModal } from './modals/EncouragementModal'