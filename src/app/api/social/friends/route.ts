import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError 
} from '@/lib/api/standardResponse'
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
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('조회 파라미터:', { search, limit, offset })

    // 두 단계로 나누어서 조회: 1) 친구 ID 목록, 2) 프로필 정보
    // 1단계: 친구 관계 조회
    const { data: friendships, error: friendshipsError } = await supabase
      .from('user_friends')
      .select('friendship_id, friend_id, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (friendshipsError) {
      console.error('친구 관계 조회 실패:', friendshipsError)
      throw friendshipsError
    }

    if (!friendships || friendships.length === 0) {
      const response: FriendsListResponse = {
        friends: [],
        total_count: 0
      }
      return createSuccessResponse(response, '친구가 없습니다.')
    }

    // 2단계: 친구들의 프로필 정보 조회
    const friendIds = friendships.map(f => f.friend_id)
    let profileQuery = supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, handle, bio')
      .in('user_id', friendIds)

    // 검색어가 있으면 프로필 정보에서 필터링
    if (search) {
      profileQuery = profileQuery.or(`display_name.ilike.%${search}%,handle.ilike.%${search}%`)
    }

    const { data: profiles, error: profilesError } = await profileQuery

    if (profilesError) {
      console.error('프로필 조회 실패:', profilesError)
      throw profilesError
    }

    // 3단계: 친구 관계와 프로필 정보 결합
    const friends = friendships
      .map(friendship => {
        const profile = profiles?.find(p => p.user_id === friendship.friend_id)
        if (!profile) return null
        
        return {
          friendship_id: friendship.friendship_id,
          user_id: user.id,
          friend_id: friendship.friend_id,
          friendship_status: friendship.status,
          friendship_created_at: friendship.created_at,
          friend_name: profile.display_name,
          friend_avatar: profile.avatar_url,
          friend_handle: profile.handle,
          // 추가 활동 정보는 나중에 구현
          activity_status: undefined,
          current_focus_score: undefined,
          last_activity: undefined,
          request_id: undefined,
          request_message: undefined
        }
      })
      .filter((friend): friend is NonNullable<typeof friend> => friend !== null) // 타입 가드로 null 제거

    console.log('친구 목록 조회 결과:', { friends: friends?.length })

    // 전체 개수 조회 (간단하게)
    const { count, error: countError } = await supabase
      .from('user_friends')
      .select('friendship_id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (countError) {
      console.warn('친구 수 조회 실패:', countError)
    }

    const response: FriendsListResponse = {
      friends: friends || [],
      total_count: count || 0
    }

    console.log('=== 친구 목록 조회 완료 ===')
    return createSuccessResponse(
      response,
      `${friends?.length || 0}명의 친구를 조회했습니다.`
    )

  } catch (error) {
    return handleAPIError(error, '친구 목록 조회')
  }
}

// POST: 친구 요청 보내기
export async function POST(request: NextRequest) {
  console.log('=== 친구 요청 보내기 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body: CreateFriendRequestData = await request.json()
    const { to_user_id, message } = body

    console.log('친구 요청 데이터:', { from_user_id: user.id, to_user_id, message })

    // 필수 필드 검증
    if (!to_user_id) {
      return createErrorResponse('친구 요청할 사용자 ID가 필요합니다.', 400)
    }

    // 자기 자신에게 요청하는지 확인
    if (user.id === to_user_id) {
      return createErrorResponse('자기 자신에게 친구 요청을 보낼 수 없습니다.', 400)
    }

    // 대상 사용자가 존재하는지 확인
    const { data: targetUser, error: targetUserError } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('user_id', to_user_id)
      .single()

    if (targetUserError || !targetUser) {
      console.error('대상 사용자 조회 실패:', targetUserError)
      return createErrorResponse('존재하지 않는 사용자입니다.', 404)
    }

    // 이미 친구인지 확인
    const { data: existingFriendship, error: friendshipError } = await supabase
      .from('user_friends')
      .select('friendship_id')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${to_user_id}),and(user_id.eq.${to_user_id},friend_id.eq.${user.id})`)
      .single()

    if (friendshipError && friendshipError.code !== 'PGRST116') {
      console.error('친구 관계 확인 실패:', friendshipError)
      throw friendshipError
    }

    if (existingFriendship) {
      return createErrorResponse('이미 친구인 사용자입니다.', 400)
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
      throw requestError
    }

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return createErrorResponse('이미 친구 요청을 보낸 사용자입니다.', 400)
      } else if (existingRequest.status === 'blocked') {
        return createErrorResponse('차단된 사용자입니다.', 400)
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
      throw createError || new Error('친구 요청 생성 실패')
    }

    console.log('=== 친구 요청 보내기 완료 ===')
    return createSuccessResponse(
      newRequest,
      '친구 요청을 성공적으로 보냈습니다.'
    )

  } catch (error) {
    return handleAPIError(error, '친구 요청 보내기')
  }
}

// 참고: 친구 검색 기능은 /api/social/friends/search (GET)로 이동됨
