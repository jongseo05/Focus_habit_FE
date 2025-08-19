// 집중 세션 완료 시 전역 이벤트 발생 유틸리티

interface FocusSessionCompleteData {
  duration: number // 분 단위
  focusScore?: number
  sessionType?: string
  sessionId?: string
  roomId?: string
}

/**
 * 집중 세션 완료 이벤트를 발생시킵니다.
 * 스터디룸에서 이 이벤트를 감지하여 자동으로 챌린지 진행사항을 업데이트합니다.
 */
export function dispatchFocusSessionComplete(data: FocusSessionCompleteData) {
  try {
    const event = new CustomEvent('focusSessionComplete', {
      detail: data
    })
    
    window.dispatchEvent(event)
    
    console.log('집중 세션 완료 이벤트 발생:', data)
  } catch (error) {
    console.error('집중 세션 완료 이벤트 발생 실패:', error)
  }
}

/**
 * 스터디룸에서 집중 세션 완료 이벤트를 감지하는 리스너를 등록합니다.
 */
export function addFocusSessionCompleteListener(
  callback: (data: FocusSessionCompleteData) => void
) {
  const eventListener = (event: CustomEvent) => {
    callback(event.detail)
  }
  
  window.addEventListener('focusSessionComplete', eventListener as EventListener)
  
  // 리스너 제거 함수 반환
  return () => {
    window.removeEventListener('focusSessionComplete', eventListener as EventListener)
  }
}

/**
 * 집중 세션 완료 데이터를 생성합니다.
 */
export function createFocusSessionCompleteData(
  durationMinutes: number,
  focusScore?: number,
  sessionType: string = 'focus',
  sessionId?: string,
  roomId?: string
): FocusSessionCompleteData {
  return {
    duration: durationMinutes,
    focusScore,
    sessionType,
    sessionId,
    roomId
  }
}
