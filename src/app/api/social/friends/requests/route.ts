import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { 
  FriendRequestsResponse, 
  FriendRequestResponse 
} from '@/types/social'

// GET: 받은 친구 요청 목록 조회
export async function GET(request: NextRequest) {
  console.log('=== 받은 친구 요청 목록 조회 시작 ===')
  
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('조회 파라미터:', { limit, offset })

    // 받은 친구 요청 목록 조회
    const { data: requests, error: requestsError } = await supabase
      .from('friend_requests_view')
      .select('*')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    console.log('받은 요청 목록 조회 결과:', { requests: requests?.length, error: requestsError })

    if (requestsError) {
      console.error('받은 요청 목록 조회 실패:', requestsError)
      return NextResponse.json(
        { error: '친구 요청 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 전체 개수 조회
    const { count, error: countError } = await supabase
      .from('friend_requests')
      .select('request_id', { count: 'exact' })
      .eq('to_user_id', user.id)
      .eq('status', 'pending')

    if (countError) {
      console.error('요청 수 조회 실패:', countError)
    }

    const response: FriendRequestsResponse = {
      requests: requests || [],
      total_count: count || 0
    }

    console.log('=== 받은 친구 요청 목록 조회 완료 ===')
    return NextResponse.json(response)

  } catch (error) {
    console.error('=== 받은 친구 요청 목록 조회 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '친구 요청 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// POST: 친구 요청 응답 (수락/거절)
export async function POST(request: NextRequest) {
  console.log('=== 친구 요청 응답 시작 ===')
  
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

    const body: FriendRequestResponse = await request.json()
    const { request_id, status } = body

    console.log('요청 응답 데이터:', { request_id, status })

    // 필수 필드 검증
    if (!request_id || !status) {
      return NextResponse.json(
        { error: '요청 ID와 응답 상태가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!['accepted', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 응답 상태입니다.' },
        { status: 400 }
      )
    }

    // 요청이 존재하고 현재 사용자에게 온 것인지 확인
    const { data: friendRequest, error: requestError } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('request_id', request_id)
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (requestError || !friendRequest) {
      console.error('친구 요청 조회 실패:', requestError)
      return NextResponse.json(
        { error: '존재하지 않거나 이미 처리된 요청입니다.' },
        { status: 404 }
      )
    }

    // 요청 상태 업데이트
    const { data: updatedRequest, error: updateError } = await supabase
      .from('friend_requests')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', request_id)
      .select()
      .single()

    console.log('요청 상태 업데이트 결과:', { updatedRequest, updateError })

    if (updateError || !updatedRequest) {
      console.error('요청 상태 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: '요청 응답 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 수락된 경우 친구 관계 생성 (트리거가 자동으로 처리)
    if (status === 'accepted') {
      console.log('친구 요청이 수락되어 친구 관계가 생성됩니다.')
    }

    console.log('=== 친구 요청 응답 완료 ===')
    return NextResponse.json({
      success: true,
      request: updatedRequest,
      message: status === 'accepted' 
        ? '친구 요청을 수락했습니다.' 
        : '친구 요청을 거절했습니다.'
    })

  } catch (error) {
    console.error('=== 친구 요청 응답 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '요청 응답 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
