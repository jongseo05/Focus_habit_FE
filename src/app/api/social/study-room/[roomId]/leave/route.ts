// =====================================================
// 개선된 스터디룸 나가기 API
// =====================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSimpleSuccessResponse, 
  createSimpleErrorResponse, 
  requireAuth, 
  handleAPIError
} from '@/lib/api/standardResponse'
import { SocialService } from '@/lib/database/socialServiceV2'

// POST: 스터디룸 나가기
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult
    
    // 새로운 서비스 사용
    const result = await SocialService.leaveStudyRoom(roomId, user.id)
    
    if (!result.success) {
      return createSimpleErrorResponse(result.error || '스터디룸 나가기에 실패했습니다.', 500)
    }
    
    return createSimpleSuccessResponse(result.data, result.message)
  } catch (error) {
    return handleAPIError(error, '스터디룸 나가기')
  }
}