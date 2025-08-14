import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 집중도 업데이트
export async function POST(
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
    const { focus_score } = body

    if (typeof focus_score !== 'number' || focus_score < 0 || focus_score > 100) {
      return NextResponse.json(
        { error: '유효하지 않은 집중도 값입니다.' },
        { status: 400 }
      )
    }

    // 참가자 정보 업데이트
    const { error: updateError } = await supabase
      .from('room_participants')
      .update({
        current_focus_score: focus_score,
        last_activity: new Date().toISOString()
      })
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .is('left_at', null)

    if (updateError) {
      console.error('집중도 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: '집중도 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    // focus_updates 테이블에 집중도 업데이트 기록 삽입 (Realtime 이벤트 발생용)
    const focusUpdatePayload = {
      user_id: user.id,
      room_id: roomId,
      focus_score: focus_score,
      created_at: new Date().toISOString()
    }
    
    console.log('focus_updates 삽입 시도:', focusUpdatePayload)
    
    const { data: focusUpdateData, error: focusUpdateError } = await supabase
      .from('focus_updates')
      .insert(focusUpdatePayload)
      .select()

    if (focusUpdateError) {
      console.error('focus_updates 삽입 실패:', focusUpdateError)
      console.error('삽입 시도한 데이터:', focusUpdatePayload)
      // focus_updates 삽입 실패는 로그만 남기고 계속 진행 (주요 기능은 room_participants 업데이트)
    } else {
      console.log('focus_updates 삽입 성공:', focusUpdateData)
      console.log('Realtime 이벤트 발생 예상 - focus_updates 테이블 변경됨')
    }

    return NextResponse.json({ 
      success: true, 
      message: '집중도가 업데이트되었습니다.',
      focus_score 
    })
  } catch (error) {
    console.error('집중도 업데이트 실패:', error)
    return NextResponse.json(
      { error: '집중도 업데이트에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// GET: 특정 참가자의 집중도 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  
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

    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 참가자 집중도 조회
    const { data: participant, error } = await supabase
      .from('room_participants')
      .select('current_focus_score, last_activity')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .is('left_at', null)
      .single()

    if (error || !participant) {
      return NextResponse.json(
        { error: '참가자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user_id: userId,
      focus_score: participant.current_focus_score,
      last_activity: participant.last_activity
    })
  } catch (error) {
    console.error('집중도 조회 실패:', error)
    return NextResponse.json(
      { error: '집중도 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
