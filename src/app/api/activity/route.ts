// =====================================================
// 사용자 활동 시간 업데이트 API
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { createSimpleSuccessResponse, createSimpleErrorResponse, handleAPIError, requireAuth } from '@/lib/api/standardResponse'

/**
 * 현재 사용자의 활동 시간을 업데이트합니다.
 * 온라인 상태 계산을 위해 데이터베이스의 last_activity를 업데이트합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()

    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const now = new Date().toISOString()

    // 모든 room_participants 테이블에서 해당 사용자의 last_activity 업데이트
    const { error: updateError } = await supabase
      .from('room_participants')
      .update({ last_activity: now })
      .eq('user_id', user.id)
      .is('left_at', null) // 아직 방을 나가지 않은 경우만

    if (updateError) {
      console.error('활동 시간 업데이트 실패:', updateError)
      return createSimpleErrorResponse('활동 시간 업데이트에 실패했습니다.', 500)
    }

    return createSimpleSuccessResponse({ 
      timestamp: now 
    }, '활동 시간이 업데이트되었습니다.')

  } catch (error) {
    return handleAPIError(error, '활동 시간 업데이트')
  }
}
