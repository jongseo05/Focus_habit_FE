import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError 
} from '@/lib/api/standardResponse'

// PUT: 친구 활동 상태 업데이트
export async function PUT(request: NextRequest) {
  console.log('=== 친구 활동 상태 업데이트 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()
    const { 
      status = 'online', 
      current_focus_score = 0, 
      current_session_id = null 
    } = body

    console.log('활동 상태 업데이트 데이터:', { 
      user_id: user.id, 
      status, 
      current_focus_score, 
      current_session_id 
    })

    // 상태 값 검증
    const validStatuses = ['online', 'offline', 'focusing', 'break', 'away']
    if (!validStatuses.includes(status)) {
      return createErrorResponse('유효하지 않은 상태 값입니다.', 400)
    }

    // 집중도 점수 검증
    if (typeof current_focus_score !== 'number' || current_focus_score < 0 || current_focus_score > 100) {
      return createErrorResponse('집중도 점수는 0-100 사이의 숫자여야 합니다.', 400)
    }

    const now = new Date().toISOString()

    // 기존 활동 상태 조회
    const { data: existingStatus, error: statusError } = await supabase
      .from('friend_activity_status')
      .select('status_id')
      .eq('user_id', user.id)
      .single()

    let updateResult

    if (statusError && statusError.code === 'PGRST116') {
      // 기존 상태가 없으면 새로 생성
      const { data: newStatus, error: createError } = await supabase
        .from('friend_activity_status')
        .insert({
          user_id: user.id,
          status,
          current_focus_score,
          last_activity: now,
          current_session_id,
          updated_at: now
        })
        .select()
        .single()

      if (createError || !newStatus) {
        console.error('활동 상태 생성 실패:', createError)
        throw createError || new Error('활동 상태 생성 실패')
      }

      updateResult = newStatus
    } else if (statusError) {
      console.error('활동 상태 조회 실패:', statusError)
      throw statusError
    } else {
      // 기존 상태 업데이트
      const { data: updatedStatus, error: updateError } = await supabase
        .from('friend_activity_status')
        .update({
          status,
          current_focus_score,
          last_activity: now,
          current_session_id,
          updated_at: now
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError || !updatedStatus) {
        console.error('활동 상태 업데이트 실패:', updateError)
        throw updateError || new Error('활동 상태 업데이트 실패')
      }

      updateResult = updatedStatus
    }

    console.log('=== 친구 활동 상태 업데이트 완료 ===')
    return createSuccessResponse(
      updateResult,
      '활동 상태가 성공적으로 업데이트되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, '친구 활동 상태 업데이트')
  }
}

// GET: 친구들의 활동 상태 조회
export async function GET(request: NextRequest) {
  console.log('=== 친구 활동 상태 조회 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('조회 파라미터:', { limit, offset })

    // 1단계: 친구 ID 목록 조회
    const { data: friendships, error: friendshipsError } = await supabase
      .from('user_friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .range(offset, offset + limit - 1)

    if (friendshipsError) {
      console.error('친구 관계 조회 실패:', friendshipsError)
      throw friendshipsError
    }

    if (!friendships || friendships.length === 0) {
      return createSuccessResponse([], '친구가 없습니다.')
    }

    // 2단계: 친구들의 활동 상태 조회
    const friendIds = friendships.map(f => f.friend_id)
    const { data: activityStatuses, error: activityError } = await supabase
      .from('friend_activity_status')
      .select('*')
      .in('user_id', friendIds)

    if (activityError) {
      console.error('활동 상태 조회 실패:', activityError)
      throw activityError
    }

    // 3단계: 친구들의 프로필 정보 조회
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, handle')
      .in('user_id', friendIds)

    if (profilesError) {
      console.error('프로필 조회 실패:', profilesError)
      // 프로필 조회 실패해도 기본 정보로 진행
    }

    // 4단계: 데이터 병합
    const friendsWithActivity = friendIds.map(friendId => {
      const activity = activityStatuses?.find(a => a.user_id === friendId)
      const profile = profiles?.find(p => p.user_id === friendId)

      return {
        user_id: friendId,
        status: activity?.status || 'offline',
        current_focus_score: activity?.current_focus_score || 0,
        last_activity: activity?.last_activity || null,
        current_session_id: activity?.current_session_id || null,
        updated_at: activity?.updated_at || null,
        friend_name: profile?.display_name || `사용자-${friendId.slice(-4)}`,
        friend_avatar: profile?.avatar_url || null,
        friend_handle: profile?.handle || null
      }
    })

    console.log('=== 친구 활동 상태 조회 완료 ===')
    return createSuccessResponse(
      friendsWithActivity,
      `${friendsWithActivity.length}명의 친구 활동 상태를 조회했습니다.`
    )

  } catch (error) {
    return handleAPIError(error, '친구 활동 상태 조회')
  }
}
