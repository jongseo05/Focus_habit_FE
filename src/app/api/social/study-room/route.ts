import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '../../../../lib/supabase/server'
import type { CreateStudyRoomData } from '../../../../types/social'
import { 
  createSimpleSuccessResponse, 
  createSimpleErrorResponse, 
  requireAuth, 
  handleAPIError
} from '../../../../lib/api/standardResponse'
import { SocialService } from '../../../../lib/database/socialServiceV2'

// GET: 활성 스터디룸 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    // 쿼리 파라미터 확인
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    
    // 새로운 서비스 사용
    const result = await SocialService.getActiveStudyRooms(limit)
    
    if (!result.success) {
      return createSimpleErrorResponse(result.error || '스터디룸 목록 조회에 실패했습니다.', 500)
    }
    
    return createSimpleSuccessResponse(result.data, result.message)
  } catch (error) {
    return handleAPIError(error, '스터디룸 목록 조회')
  }
}

// POST: 새로운 스터디룸 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult
    
    const body = await request.json()
    const roomData: CreateStudyRoomData = {
      host_id: user.id,
      name: body.name,
      description: body.description,
      max_participants: body.max_participants || 4,
      session_type: body.session_type || 'study',
      goal_minutes: body.goal_minutes || 25
    }
    
    // 새로운 서비스 사용
    const result = await SocialService.createStudyRoom(roomData)
    
    if (!result.success) {
      return createSimpleErrorResponse(result.error || '스터디룸 생성에 실패했습니다.', 500)
    }
    
    return createSimpleSuccessResponse(result.data, result.message)
  } catch (error) {
    return handleAPIError(error, '스터디룸 생성')
  }
}
