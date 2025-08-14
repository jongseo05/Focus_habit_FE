import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { 
  FriendsListResponse, 
  CreateFriendRequestData, 
  FriendSearchResponse,
  FriendSearchResult 
} from '@/types/social'

// GET: 친구 목록 조회
export async function GET(request: NextRequest) {
  console.log('=== 친구 목록 조회 시작 ===')
  
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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('조회 파라미터:', { search, limit, offset })

    let query = supabase
      .from('friends_list_view')
      .select('*')
      .eq('user_id', user.id)

    // 검색어가 있으면 필터링
    if (search) {
      query = query.or(`friend_name.ilike.%${search}%`)
    }

    // 페이징 적용
    query = query.range(offset, offset + limit - 1)
    query = query.order('friend_name', { ascending: true }) // display_name으로 정렬

    const { data: friends, error: friendsError } = await query

    console.log('친구 목록 조회 결과:', { friends: friends?.length, error: friendsError })

    if (friendsError) {
      console.error('친구 목록 조회 실패:', friendsError)
      return NextResponse.json(
        { error: '친구 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 전체 개수 조회
    let countQuery = supabase
      .from('friends_list_view')
      .select('friendship_id', { count: 'exact' })
      .eq('user_id', user.id)

    if (search) {
      countQuery = countQuery.or(`friend_name.ilike.%${search}%`)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('친구 수 조회 실패:', countError)
    }

    const response: FriendsListResponse = {
      friends: friends || [],
      total_count: count || 0
    }

    console.log('=== 친구 목록 조회 완료 ===')
    return NextResponse.json(response)

  } catch (error) {
    console.error('=== 친구 목록 조회 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '친구 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 친구 요청 보내기
export async function POST(request: NextRequest) {
  console.log('=== 친구 요청 보내기 시작 ===')
  
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

    const body: CreateFriendRequestData = await request.json()
    const { to_user_id, message } = body

    console.log('친구 요청 데이터:', { from_user_id: user.id, to_user_id, message })

    // 필수 필드 검증
    if (!to_user_id) {
      return NextResponse.json(
        { error: '친구 요청할 사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 자기 자신에게 요청하는지 확인
    if (user.id === to_user_id) {
      return NextResponse.json(
        { error: '자기 자신에게 친구 요청을 보낼 수 없습니다.' },
        { status: 400 }
      )
    }

    // 대상 사용자가 존재하는지 확인
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', to_user_id)
      .single()

    if (targetUserError || !targetUser) {
      console.error('대상 사용자 조회 실패:', targetUserError)
      return NextResponse.json(
        { error: '존재하지 않는 사용자입니다.' },
        { status: 404 }
      )
    }

    // 이미 친구인지 확인
    const { data: existingFriendship, error: friendshipError } = await supabase
      .from('user_friends')
      .select('friendship_id')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${to_user_id}),and(user_id.eq.${to_user_id},friend_id.eq.${user.id})`)
      .single()

    if (friendshipError && friendshipError.code !== 'PGRST116') {
      console.error('친구 관계 확인 실패:', friendshipError)
      return NextResponse.json(
        { error: '친구 관계를 확인하는데 실패했습니다.' },
        { status: 500 }
      )
    }

    if (existingFriendship) {
      return NextResponse.json(
        { error: '이미 친구인 사용자입니다.' },
        { status: 400 }
      )
    }

    // 이미 요청을 보냈는지 확인
    const { data: existingRequest, error: requestError } = await supabase
      .from('friend_requests')
      .select('request_id, status')
      .eq('from_user_id', user.id)
      .eq('to_user_id', to_user_id)
      .single()

    if (requestError && requestError.code !== 'PGRST116') {
      console.error('기존 요청 확인 실패:', requestError)
      return NextResponse.json(
        { error: '기존 요청을 확인하는데 실패했습니다.' },
        { status: 500 }
      )
    }

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return NextResponse.json(
          { error: '이미 친구 요청을 보낸 사용자입니다.' },
          { status: 400 }
        )
      } else if (existingRequest.status === 'blocked') {
        return NextResponse.json(
          { error: '차단된 사용자입니다.' },
          { status: 400 }
        )
      }
    }

    // 친구 요청 생성
    const { data: newRequest, error: createError } = await supabase
      .from('friend_requests')
      .insert({
        from_user_id: user.id,
        to_user_id,
        message: message || null,
        status: 'pending'
      })
      .select()
      .single()

    console.log('친구 요청 생성 결과:', { newRequest, createError })

    if (createError || !newRequest) {
      console.error('친구 요청 생성 실패:', createError)
      return NextResponse.json(
        { error: '친구 요청을 보내는데 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('=== 친구 요청 보내기 완료 ===')
    return NextResponse.json({
      success: true,
      request: newRequest,
      message: '친구 요청을 성공적으로 보냈습니다.'
    })

  } catch (error) {
    console.error('=== 친구 요청 보내기 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '친구 요청을 보내는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 친구 검색
export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const { search, limit = 20 } = body

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

    // 각 사용자에 대해 친구 관계 및 요청 상태 확인
    const userIds = users.map(u => u.user_id)
    
    // 친구 관계 확인
    const { data: friendships, error: friendshipError } = await supabase
      .from('user_friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .in('friend_id', userIds)

    if (friendshipError) {
      console.error('친구 관계 확인 실패:', friendshipError)
    }

    // 친구 요청 확인
    const { data: requests, error: requestError } = await supabase
      .from('friend_requests')
      .select('to_user_id')
      .eq('from_user_id', user.id)
      .eq('status', 'pending')
      .in('to_user_id', userIds)

    if (requestError) {
      console.error('친구 요청 확인 실패:', requestError)
    }

    // 활동 상태 확인
    const { data: activityStatuses, error: activityError } = await supabase
      .from('friend_activity_status')
      .select('user_id, current_focus_score, last_activity')
      .in('user_id', userIds)

    if (activityError) {
      console.error('활동 상태 확인 실패:', activityError)
    }

    // 결과 조합 및 display_name으로 정렬
    const results: FriendSearchResult[] = users.map(user => {
      const isFriend = friendships?.some(f => f.friend_id === user.user_id) || false
      const hasPendingRequest = requests?.some(r => r.to_user_id === user.user_id) || false
      const activityStatus = activityStatuses?.find(a => a.user_id === user.user_id)

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
