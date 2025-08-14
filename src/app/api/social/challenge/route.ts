import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  console.log('=== 챌린지 생성 API 시작 ===')
  try {
    console.log('1. Supabase 서버 연결 시도...')
    const supabase = await supabaseServer()
    console.log('2. Supabase 서버 연결 완료')
    
    // 인증 확인
    console.log('3. 인증 확인 시도...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('4. 인증 결과:', { user: user?.id, authError })
    if (authError || !user) {
      console.error('5. 인증 실패:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('6. 받은 요청 데이터:', body)
    const { room_id, mode, config } = body

    // 필수 필드 검증
    if (!room_id || !mode || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 호스트 권한 확인
    console.log('7. 호스트 권한 확인 시도...')
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('host_id')
      .eq('room_id', room_id)
      .single()

    console.log('8. 룸 조회 결과:', { room, roomError })
    if (roomError || !room) {
      console.error('9. 룸 조회 실패:', roomError)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    console.log('10. 호스트 ID 비교:', { roomHostId: room.host_id, userId: user.id })
    if (room.host_id !== user.id) {
      console.error('11. 호스트 권한 없음')
      return NextResponse.json({ error: 'Only room host can create challenges' }, { status: 403 })
    }

    // 새로운 대결 윈도우 생성
    console.log('12. 챌린지 생성 시도...')
    const challengeData = {
      room_id,
      mode,
      config,
      state: 'pending',
      start_at: new Date().toISOString(),
      created_by: user.id
    }
    console.log('13. 챌린지 데이터:', challengeData)
    
    // RLS 정책 우회를 위해 서비스 롤 사용
    const { data: challenge, error: challengeError } = await supabase
      .from('challenge')
      .insert(challengeData)
      .select()
      .single()

    console.log('14. 챌린지 생성 결과:', { challenge, challengeError })
    if (challengeError) {
      console.error('15. 챌린지 생성 실패:', challengeError)
      console.error('15-1. 에러 상세:', JSON.stringify(challengeError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to create challenge',
        details: challengeError 
      }, { status: 500 })
    }

    console.log('16. 챌린지 생성 성공')
    return NextResponse.json({ 
      success: true, 
      challenge,
      message: 'Challenge created successfully' 
    })

  } catch (error) {
    console.error('=== 챌린지 생성 실패 ===')
    console.error('에러 타입:', typeof error)
    console.error('에러 메시지:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const room_id = searchParams.get('room_id')

    if (!room_id) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // 룸의 활성 대결 윈도우 조회
    const { data: challenges, error: challengesError } = await supabase
      .from('challenge')
      .select(`
        *,
        challenge_participant (
          user_id,
          final_score
        )
      `)
      .eq('room_id', room_id)
      .order('created_at', { ascending: false })

    if (challengesError) {
      console.error('Challenges fetch error:', challengesError)
      return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      challenges 
    })

  } catch (error) {
    console.error('Challenges fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

