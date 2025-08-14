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
    const { room_id, mode, config, autoStart = false } = body

    // 필수 필드 검증
    if (!room_id || !mode || !config) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 호스트 권한 확인
    console.log('7. 호스트 권한 확인 시도...')
    console.log('7-1. 요청 데이터:', { room_id, user_id: user.id, user_email: user.email })
    
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('host_id, name, created_at')
      .eq('room_id', room_id)
      .single()

    console.log('8. 룸 조회 결과:', { room, roomError })
    if (roomError || !room) {
      console.error('9. 룸 조회 실패:', roomError)
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    console.log('10. 호스트 ID 비교:', { 
      roomHostId: room.host_id, 
      userId: user.id,
      isHost: String(room.host_id) === String(user.id),
      roomName: room.name,
      roomHostIdType: typeof room.host_id,
      userIdType: typeof user.id
    })
    
    if (String(room.host_id) !== String(user.id)) {
      console.error('11. 호스트 권한 없음')
      console.error('11-1. 상세 정보:', {
        roomHostId: room.host_id,
        userId: user.id,
        userEmail: user.email,
        roomName: room.name
      })
      return NextResponse.json({ 
        error: 'Only room host can create challenges',
        details: {
          roomHostId: room.host_id,
          userId: user.id,
          roomName: room.name
        }
      }, { status: 403 })
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

    // 호스트를 자동으로 참가자로 추가
    console.log('16. 호스트 자동 참가 처리...')
    const { error: joinError } = await supabase
      .from('challenge_participant')
      .insert({
        challenge_id: challenge.challenge_id,
        user_id: user.id,
        joined_at: new Date().toISOString(),
        current_score: 0,
        final_score: 0
      })

    if (joinError) {
      console.error('17. 호스트 자동 참가 실패:', joinError)
      // 참가 실패는 경고만 하고 챌린지 생성은 성공으로 처리
    } else {
      console.log('17. 호스트 자동 참가 성공')
    }

    console.log('18. 챌린지 생성 성공')
    console.log('18-1. 반환할 challenge 객체:', challenge)
    console.log('18-2. challenge.challenge_id:', challenge.challenge_id)
    console.log('18-3. challenge.challenge_id 타입:', typeof challenge.challenge_id)
    console.log('18-4. challenge.challenge_id constructor:', challenge.challenge_id?.constructor?.name)
    
    // challenge_id를 명시적으로 문자열로 변환
    const sanitizedChallenge = {
      ...challenge,
      challenge_id: String(challenge.challenge_id)
    }
    console.log('18-5. sanitizedChallenge.challenge_id:', sanitizedChallenge.challenge_id)
    console.log('18-6. sanitizedChallenge.challenge_id 타입:', typeof sanitizedChallenge.challenge_id)
    
    return NextResponse.json({ 
      success: true, 
      challenge: sanitizedChallenge,
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

