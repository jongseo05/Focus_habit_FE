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

    console.log('조회하려는 roomId:', params.roomId)
    
    // 먼저 해당 roomId가 존재하는지 확인
    const { data: roomExists, error: existsError } = await supabase
      .from('study_rooms')
      .select('room_id')
      .eq('room_id', params.roomId)
    
    console.log('룸 존재 확인:', { roomExists, existsError })
    
    // 스터디룸 정보 조회 (조인 없이 먼저 시도)
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('*')
      .eq('room_id', params.roomId)
      .single()

    console.log('조회 결과:', { room, roomError })

    if (roomError || !room) {
      console.error('스터디룸 조회 실패:', roomError)
      return NextResponse.json(
        { error: '스터디룸을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error('스터디룸 정보 조회 실패:', error)
    return NextResponse.json(
      { error: '스터디룸 정보 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
