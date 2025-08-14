import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 특정 스터디룸 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 스터디룸 정보 조회 (연동된 챌린지 정보 포함)
    const { data: room, error } = await supabase
      .from('study_rooms')
      .select(`
        *,
        linked_challenge:linked_challenge_id (
          challenge_id,
          name,
          description,
          goal_type,
          goal_value,
          duration_days,
          ends_at,
          is_active
        )
      `)
      .eq('room_id', roomId)
      .single()

    if (error || !room) {
      return NextResponse.json(
        { error: '스터디룸을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 실제 참가자 수 계산
    const { data: participants, error: participantError } = await supabase
      .from('room_participants')
      .select('participant_id')
      .eq('room_id', roomId)
      .is('left_at', null)

    if (participantError) {
      console.error('참가자 수 계산 실패:', participantError)
    } else {
      const actualParticipantCount = participants?.length || 0
      
      // 실제 참가자 수와 저장된 수가 다르면 업데이트
      if (actualParticipantCount !== room.current_participants) {
        console.log(`참가자 수 불일치 - 저장된 수: ${room.current_participants}, 실제 수: ${actualParticipantCount}`)
        
        const { error: updateError } = await supabase
          .from('study_rooms')
          .update({
            current_participants: actualParticipantCount,
            updated_at: new Date().toISOString()
          })
          .eq('room_id', roomId)

        if (updateError) {
          console.error('참가자 수 업데이트 실패:', updateError)
        } else {
          room.current_participants = actualParticipantCount
        }
      }
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error('스터디룸 조회 실패:', error)
    return NextResponse.json(
      { error: '스터디룸 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 스터디룸 정보 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // 스터디룸 업데이트 (호스트만 가능)
    const updateData: any = {
      name: body.name,
      description: body.description,
      max_participants: body.max_participants,
      session_type: body.session_type,
      goal_minutes: body.goal_minutes,
      updated_at: new Date().toISOString()
    }

    // 챌린지 연동 처리
    if (body.linked_challenge_id !== undefined) {
      if (body.linked_challenge_id) {
        // 챌린지 존재 확인
        const { data: challenge, error: challengeError } = await supabase
          .from('group_challenges')
          .select('challenge_id')
          .eq('challenge_id', body.linked_challenge_id)
          .eq('is_active', true)
          .single()

        if (challengeError || !challenge) {
          return NextResponse.json(
            { error: '유효하지 않은 챌린지입니다.' },
            { status: 400 }
          )
        }
      }
      updateData.linked_challenge_id = body.linked_challenge_id
    }

    const { data: room, error } = await supabase
      .from('study_rooms')
      .update(updateData)
      .eq('room_id', roomId)
      .eq('host_id', user.id)
      .select()
      .single()

    if (error || !room) {
      return NextResponse.json(
        { error: '스터디룸 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error('스터디룸 업데이트 실패:', error)
    return NextResponse.json(
      { error: '스터디룸 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE: 스터디룸 종료 (호스트만 가능)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  console.log('=== 스터디룸 종료 시작 ===')
  console.log('룸 ID:', roomId)
  
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증된 사용자:', user?.id)
    
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 호스트 권한 확인
    console.log('호스트 권한 확인 중...')
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('host_id, is_active')
      .eq('room_id', roomId)
      .single()

    console.log('룸 조회 결과:', { room, roomError })

    if (roomError) {
      console.error('룸 조회 실패:', roomError)
      return NextResponse.json(
        { error: '스터디룸을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!room) {
      console.error('룸이 존재하지 않음')
      return NextResponse.json(
        { error: '스터디룸을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log('호스트 ID:', room.host_id, '현재 사용자 ID:', user.id)

    if (room.host_id !== user.id) {
      console.error('호스트 권한 없음')
      return NextResponse.json(
        { error: '호스트만 스터디룸을 종료할 수 있습니다.' },
        { status: 403 }
      )
    }

    if (!room.is_active) {
      console.error('이미 종료된 스터디룸')
      return NextResponse.json(
        { error: '이미 종료된 스터디룸입니다.' },
        { status: 400 }
      )
    }

    // 스터디룸 종료 (is_active = false, ended_at 설정)
    console.log('스터디룸 종료 처리 중...')
    const { error: endError } = await supabase
      .from('study_rooms')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)

    if (endError) {
      console.error('스터디룸 종료 실패:', endError)
      return NextResponse.json(
        { error: '스터디룸 종료에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('스터디룸 종료 성공')

    // 모든 참가자를 퇴장 처리
    console.log('참가자 퇴장 처리 중...')
    const { error: leaveError } = await supabase
      .from('room_participants')
      .update({
        left_at: new Date().toISOString(),
        is_connected: false,
        last_activity: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .is('left_at', null)

    if (leaveError) {
      console.error('참가자 퇴장 처리 실패:', leaveError)
    } else {
      console.log('참가자 퇴장 처리 성공')
    }

    console.log('=== 스터디룸 종료 완료 ===')
    return NextResponse.json({ 
      success: true, 
      message: '스터디룸이 성공적으로 종료되었습니다.' 
    })
  } catch (error) {
    console.error('=== 스터디룸 종료 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '스터디룸 종료에 실패했습니다.' },
      { status: 500 }
    )
  }
}
