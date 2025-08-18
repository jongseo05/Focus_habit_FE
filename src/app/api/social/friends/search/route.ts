import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { 
  FriendSearchResponse,
  FriendSearchResult 
} from '@/types/social'

// GET: 친구 검색 (올바른 HTTP 메서드 사용)
export async function GET(request: NextRequest) {
  console.log('=== 친구 검색 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('검색 파라미터:', { search, limit })

    if (!search || search.trim().length < 2) {
      return NextResponse.json(
        { error: '검색어는 최소 2자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 사용자 검색 (자기 자신 제외) - display_name 우선 검색
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        user_id,
        display_name,
        avatar_url,
        handle,
        bio
      `)
      .or(`display_name.ilike.%${search}%,handle.ilike.%${search}%`)
      .neq('user_id', user.id)
      .order('display_name', { ascending: true }) // display_name으로 정렬
      .limit(limit)

    console.log('사용자 검색 결과:', { users: users?.length, error: usersError })

    if (usersError) {
      console.error('사용자 검색 실패:', usersError)
      return NextResponse.json(
        { error: '사용자 검색에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        results: [],
        total_count: 0
      })
    }

    // 각 사용자에 대해 친구 관계 및 요청 상태 확인 (배치 처리로 N+1 쿼리 해결)
    const userIds = users.map(u => u.user_id)
    
    // 친구 관계, 친구 요청, 활동 상태를 한 번에 조회
    const [friendships, requests, activityStatuses] = await Promise.all([
      // 친구 관계 확인
      supabase
        .from('user_friends')
        .select('friend_id')
        .eq('user_id', user.id)
        .in('friend_id', userIds),
      
      // 친구 요청 확인
      supabase
        .from('friend_requests')
        .select('to_user_id')
        .eq('from_user_id', user.id)
        .eq('status', 'pending')
        .in('to_user_id', userIds),
      
      // 활동 상태 확인
      supabase
        .from('friend_activity_status')
        .select('user_id, current_focus_score, last_activity')
        .in('user_id', userIds)
    ])

    // 에러 체크
    if (friendships.error) {
      console.error('친구 관계 확인 실패:', friendships.error)
    }
    if (requests.error) {
      console.error('친구 요청 확인 실패:', requests.error)
    }
    if (activityStatuses.error) {
      console.error('활동 상태 확인 실패:', activityStatuses.error)
    }

    // 결과 조합 및 display_name으로 정렬
    const results: FriendSearchResult[] = users.map(user => {
      const isFriend = friendships.data?.some(f => f.friend_id === user.user_id) || false
      const hasPendingRequest = requests.data?.some(r => r.to_user_id === user.user_id) || false
      const activityStatus = activityStatuses.data?.find(a => a.user_id === user.user_id)

      return {
        user_id: user.user_id,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        handle: user.handle,
        bio: user.bio,
        is_friend: isFriend,
        has_pending_request: hasPendingRequest,
        current_focus_score: activityStatus?.current_focus_score,
        last_activity: activityStatus?.last_activity
      }
    }).sort((a, b) => {
      // display_name으로 정렬 (한글 우선)
      return a.display_name.localeCompare(b.display_name, 'ko-KR')
    })

    const response: FriendSearchResponse = {
      results,
      total_count: results.length
    }

    console.log('=== 친구 검색 완료 ===')
    return NextResponse.json(response)

  } catch (error) {
    console.error('=== 친구 검색 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '사용자 검색에 실패했습니다.' },
      { status: 500 }
    )
  }
}
