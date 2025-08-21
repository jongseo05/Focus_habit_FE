/**
 * 온라인 상태 판단 관련 유틸리티 함수들
 * 모든 API에서 일관된 온라인 기준 적용
 */

// 표준 온라인 임계값 (1분)
export const STANDARD_ONLINE_THRESHOLD = 60 * 1000 // 60초

/**
 * 참가자 온라인 상태 판단
 */
export interface ParticipantOnlineCheck {
  user_id: string
  last_activity: string | null
  is_present: boolean
  left_at: string | null
  is_connected?: boolean
}

/**
 * 참가자가 온라인 상태인지 판단
 * @param participant 참가자 정보
 * @param customThreshold 커스텀 임계값 (기본값: 1분)
 * @returns 온라인 여부
 */
export function isParticipantOnline(
  participant: ParticipantOnlineCheck, 
  customThreshold: number = STANDARD_ONLINE_THRESHOLD
): boolean {
  // 기본 조건: 룸에 있고 나가지 않은 상태
  if (!participant.is_present || participant.left_at) {
    return false
  }

  // last_activity가 없으면 방금 입장한 것으로 간주
  if (!participant.last_activity) {
    return true
  }

  const now = Date.now()
  const lastActivity = new Date(participant.last_activity).getTime()
  const timeDiff = now - lastActivity

  return timeDiff <= customThreshold
}

/**
 * 온라인 참가자 필터링
 * @param participants 참가자 목록
 * @param customThreshold 커스텀 임계값 (기본값: 1분)
 * @returns 온라인 참가자 목록
 */
export function filterOnlineParticipants<T extends ParticipantOnlineCheck>(
  participants: T[], 
  customThreshold: number = STANDARD_ONLINE_THRESHOLD
): T[] {
  return participants.filter(participant => 
    isParticipantOnline(participant, customThreshold)
  )
}

/**
 * 집중도 세션 참여 자격이 있는 참가자 필터링
 * @param participants 참가자 목록
 * @param customThreshold 커스텀 임계값 (기본값: 1분)
 * @returns 세션 참여 자격 있는 참가자 목록
 */
export function filterSessionEligibleParticipants<T extends ParticipantOnlineCheck & { is_connected?: boolean }>(
  participants: T[], 
  customThreshold: number = STANDARD_ONLINE_THRESHOLD
): T[] {
  return participants.filter(participant => 
    isParticipantOnline(participant, customThreshold) && 
    participant.is_connected !== false // is_connected가 false가 아닌 경우 (undefined 포함)
  )
}

/**
 * 온라인 상태 로깅 유틸리티
 * @param participant 참가자 정보
 * @param customThreshold 커스텀 임계값
 */
export function logParticipantOnlineStatus(
  participant: ParticipantOnlineCheck, 
  customThreshold: number = STANDARD_ONLINE_THRESHOLD
): void {
  const isOnline = isParticipantOnline(participant, customThreshold)
  
  if (!participant.last_activity) {
    console.log(`👤 사용자 ${participant.user_id}: 방금 입장 (last_activity 없음) → 온라인`)
    return
  }

  const now = Date.now()
  const lastActivity = new Date(participant.last_activity).getTime()
  const timeDiff = now - lastActivity

  console.log(`👤 사용자 ${participant.user_id} 온라인 검증:`, {
    last_activity: participant.last_activity,
    timeDiff_seconds: Math.round(timeDiff / 1000),
    threshold_seconds: customThreshold / 1000,
    is_present: participant.is_present,
    left_at: participant.left_at,
    isOnline: isOnline
  })
}
