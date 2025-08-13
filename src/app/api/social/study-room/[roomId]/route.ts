import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 특정 스터디룸 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
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

    // 스터디룸 정보 조회
    const { data: room, error } = await supabase
      .from('study_rooms')
      .select('*')
      .eq('room_id', params.roomId)
      .single()

    if (error || !room) {
      return NextResponse.json(
        { error: '스터디룸을 찾을 수 없습니다.' },
        { status: 404 }
      )
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
  { params }: { params: { roomId: string } }
) {
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
    const { data: room, error } = await supabase
      .from('study_rooms')
      .update({
        name: body.name,
        description: body.description,
        max_participants: body.max_participants,
        session_type: body.session_type,
        goal_minutes: body.goal_minutes,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', params.roomId)
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
  { params }: { params: { roomId: string } }
) {
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

    // 호스트 권한 확인
    const { data: room } = await supabase
      .from('study_rooms')
      .select('host_id, is_active')
      .eq('room_id', params.roomId)
      .single()

    if (!room || room.host_id !== user.id) {
      return NextResponse.json(
        { error: '호스트만 스터디룸을 종료할 수 있습니다.' },
        { status: 403 }
      )
    }

    if (!room.is_active) {
      return NextResponse.json(
        { error: '이미 종료된 스터디룸입니다.' },
        { status: 400 }
      )
    }

    // 스터디룸 종료 (is_active = false, ended_at 설정)
    const { error: endError } = await supabase
      .from('study_rooms')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('room_id', params.roomId)

    if (endError) {
      console.error('스터디룸 종료 실패:', endError)
      return NextResponse.json(
        { error: '스터디룸 종료에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 모든 참가자를 퇴장 처리
    const { error: leaveError } = await supabase
      .from('room_participants')
      .update({
        left_at: new Date().toISOString(),
        is_connected: false,
        last_activity: new Date().toISOString()
      })
      .eq('room_id', params.roomId)
      .is('left_at', null)

    if (leaveError) {
      console.error('참가자 퇴장 처리 실패:', leaveError)
    }

    return NextResponse.json({ 
      success: true, 
      message: '스터디룸이 성공적으로 종료되었습니다.' 
    })
  } catch (error) {
    console.error('스터디룸 종료 실패:', error)
    return NextResponse.json(
      { error: '스터디룸 종료에 실패했습니다.' },
      { status: 500 }
    )
  }
}
