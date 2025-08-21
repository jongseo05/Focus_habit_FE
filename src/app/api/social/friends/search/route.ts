import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError 
} from '@/lib/api/standardResponse'
import type { 
  FriendSearchResponse,
  FriendSearchResult 
} from '@/types/social'

// GET: 친구 검색 (올바른 HTTP 메서드 사용)
export async function GET(request: NextRequest) {
  console.log('=== 친구 검색 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('검색 파라미터:', { search, limit })

    if (!search || search.trim().length < 2) {
      return createErrorResponse('검색어는 최소 2자 이상이어야 합니다.', 400)
    }

    // 사용자 검색 (자기 자신 제외) - display_name, handle, bio 모두 검색
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        display_name,
        avatar_url,
        handle,
        bio
      `)
      .or(`display_name.ilike.%${search}%,handle.ilike.%${search}%,bio.ilike.%${search}%`)
      .neq('user_id', user.id)
      .order('display_name', { ascending: true }) // display_name으로 정렬
      .limit(limit)

    console.log('사용자 검색 결과:', { users: users?.length, error: usersError })

    if (usersError) {
      console.error('사용자 검색 실패:', usersError)
      throw usersError
    }

    if (!users || users.length === 0) {
      return createSuccessResponse({
        results: [],
        total_count: 0
      }, '검색 결과가 없습니다.')
    }

    // 각 사용자에 대해 친구 관계 및 요청 상태 확인 (배치 처리로 N+1 쿼리 해결)
    const userIds = users.map(u => u.user_id)
    
    // 친구 관계, 친구 요청, 활동 상태를 한 번에 조회
    const [friendships, pendingFriendships, activityStatuses] = await Promise.all([
      // 친구 관계 확인 (active 상태만) - 양방향 확인
      supabase
        .from('user_friends')
        .select('user_id, friend_id, status')
        .eq('status', 'active')
        .or(`and(user_id.eq.${user.id},friend_id.in.(${userIds.join(',')})),and(user_id.in.(${userIds.join(',')}),friend_id.eq.${user.id})`),
      
      // pending 상태의 친구 관계 확인
      supabase
        .from('user_friends')
        .select('friend_id, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .in('friend_id', userIds),
      
      // 활동 상태 확인
      supabase
        .from('friend_activity_status')
        .select('user_id, current_focus_score, last_activity')
        .in('user_id', userIds)
    ])

    // 에러 체크 및 디버깅 로그 추가
    if (friendships.error) {
      console.error('친구 관계 확인 실패:', friendships.error)
    } else {
      console.log('친구 관계 조회 결과 (active):', { 
        user_id: user.id, 
        friendships_count: friendships.data?.length || 0,
        friendships: friendships.data 
      })
    }
    
    if (pendingFriendships.error) {
      console.error('pending 친구 관계 확인 실패:', pendingFriendships.error)
    } else {
      console.log('pending 친구 관계 조회 결과:', { 
        user_id: user.id, 
        pending_friendships_count: pendingFriendships.data?.length || 0,
        pending_friendships: pendingFriendships.data 
      })
    }
    
    if (activityStatuses.error) {
      console.error('활동 상태 확인 실패:', activityStatuses.error)
    }

    // 결과 조합 및 display_name으로 정렬
    const results: FriendSearchResult[] = await Promise.all(users.map(async (searchUser) => {
      // 양방향 친구 관계 확인
      const isFriend = friendships.data?.some(f => 
        (f.user_id === user.id && f.friend_id === searchUser.user_id) ||
        (f.user_id === searchUser.user_id && f.friend_id === user.id)
      ) || false
      
      // user_friends 테이블에서 pending 상태 확인
      const hasPendingFriendship = pendingFriendships.data?.some(f => f.friend_id === searchUser.user_id) || false
      
      // friend_requests 테이블에서 pending 상태 확인 (직접적인 쿼리)
      const { data: userRequests, error: requestError } = await supabase
        .from('friend_requests')
        .select('from_user_id, to_user_id')
        .eq('status', 'pending')
        .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${searchUser.user_id}),and(from_user_id.eq.${searchUser.user_id},to_user_id.eq.${user.id})`)
      
      if (requestError) {
        console.error(`사용자 ${searchUser.display_name} 친구 요청 확인 실패:`, requestError)
      }
      
      // 더 정확한 pending 상태 확인
      const hasPendingRequestInRequests = userRequests && userRequests.length > 0 || false
      
      // 두 테이블 모두에서 pending 상태 확인
      const hasPendingRequest = hasPendingFriendship || hasPendingRequestInRequests
      
      const activityStatus = activityStatuses.data?.find(a => a.user_id === searchUser.user_id)

      // 각 사용자별 상태 디버깅
      console.log(`사용자 ${searchUser.display_name} (${searchUser.user_id}) 상태:`, {
        is_friend: isFriend,
        has_pending_request: hasPendingRequest,
        has_pending_friendship: hasPendingFriendship,
        has_pending_request_in_requests: hasPendingRequestInRequests,
        found_in_friendships: friendships.data?.find(f => f.friend_id === searchUser.user_id),
        found_in_pending_friendships: pendingFriendships.data?.find(f => f.friend_id === searchUser.user_id),
        found_in_requests: userRequests,
        request_count: userRequests?.length || 0,
        user_id: user.id,
        search_user_id: searchUser.user_id,
        all_user_requests: userRequests
      })

      return {
        user_id: searchUser.user_id,
        display_name: searchUser.display_name,
        avatar_url: searchUser.avatar_url,
        handle: searchUser.handle,
        bio: searchUser.bio,
        is_friend: isFriend,
        has_pending_request: hasPendingRequest,
        current_focus_score: activityStatus?.current_focus_score,
        last_activity: activityStatus?.last_activity
      }
    }))

    // display_name으로 정렬 (한글 우선)
    results.sort((a, b) => a.display_name.localeCompare(b.display_name, 'ko-KR'))

    const response: FriendSearchResponse = {
      results,
      total_count: results.length
    }

    console.log('=== 친구 검색 완료 ===')
    return createSuccessResponse(
      response,
      `${results.length}명의 사용자를 찾았습니다.`
    )

  } catch (error) {
    return handleAPIError(error, '친구 검색')
  }
}
