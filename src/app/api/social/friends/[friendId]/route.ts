import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError 
} from '@/lib/api/standardResponse'

// DELETE: 친구 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  console.log('=== 친구 삭제 시작 ===')
  console.log('요청 URL:', request.url)
  console.log('요청 메서드:', request.method)
  
  try {
    const supabase = await supabaseServer()
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { friendId } = await params
    console.log('파라미터에서 추출한 friendId:', friendId)

    console.log('친구 삭제 요청:', { user_id: user.id, friend_id: friendId })

    // 필수 필드 검증
    if (!friendId) {
      console.error('friendId가 없습니다.')
      return createErrorResponse('삭제할 친구 ID가 필요합니다.', 400)
    }

    // 자기 자신을 삭제하려는지 확인
    if (user.id === friendId) {
      console.error('자기 자신을 삭제하려고 시도:', user.id)
      return createErrorResponse('자기 자신을 친구에서 삭제할 수 없습니다.', 400)
    }

    // 대상 사용자가 존재하는지 확인
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', friendId)
      .single()

    console.log('대상 사용자 조회 결과:', { targetUser, targetUserError })

    if (targetUserError || !targetUser) {
      console.error('대상 사용자 조회 실패:', targetUserError)
      return createErrorResponse('존재하지 않는 사용자입니다.', 404)
    }

    // 친구 관계가 존재하는지 확인
    const { data: existingFriendship, error: friendshipError } = await supabase
      .from('user_friends')
      .select('friendship_id, status')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)
      .single()

    console.log('친구 관계 확인 결과:', { existingFriendship, friendshipError })

    if (friendshipError && friendshipError.code !== 'PGRST116') {
      console.error('친구 관계 확인 실패:', friendshipError)
      throw friendshipError
    }

    if (!existingFriendship) {
      console.error('친구 관계가 존재하지 않음')
      return createErrorResponse('친구 관계가 존재하지 않습니다.', 404)
    }

    if (existingFriendship.status !== 'active') {
      console.error('친구 관계가 비활성 상태:', existingFriendship.status)
      return createErrorResponse('이미 삭제되었거나 차단된 친구입니다.', 400)
    }

    // 친구 관계 삭제 (양방향 모두 삭제)
    const { error: deleteError } = await supabase
      .from('user_friends')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)

    console.log('친구 관계 삭제 결과:', { deleteError })

    if (deleteError) {
      console.error('친구 관계 삭제 실패:', deleteError)
      throw deleteError
    }

    console.log('=== 친구 삭제 완료 ===')
    return createSuccessResponse(
      { deleted_friend_id: friendId },
      '친구가 성공적으로 삭제되었습니다.'
    )

  } catch (error) {
    console.error('친구 삭제 중 예외 발생:', error)
    return handleAPIError(error, '친구 삭제')
  }
}
