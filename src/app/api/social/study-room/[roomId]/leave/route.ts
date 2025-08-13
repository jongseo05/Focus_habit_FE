import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 스터디룸 나가기
export async function POST(
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

    // 참가자 상태를 left_at으로 업데이트
    const { error: leaveError } = await supabase
      .from('room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', params.roomId)
      .eq('user_id', user.id)
      .is('left_at', null)

    if (leaveError) {
      return NextResponse.json(
        { error: '스터디룸 나가기에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('스터디룸 나가기 실패:', error)
    return NextResponse.json(
      { error: '스터디룸 나가기에 실패했습니다.' },
      { status: 500 }
    )
  }
}
