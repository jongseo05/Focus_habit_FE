import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 스터디룸 참가자 목록 조회
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

    // 현재 참가 중인 참가자 목록 조회 (left_at이 null이고 is_connected가 true인 경우)
    const { data: participants, error } = await supabase
      .from('room_participants')
      .select(`
        *,
        user:user_id(name, avatar_url)
      `)
      .eq('room_id', params.roomId)
      .is('left_at', null)
      .eq('is_connected', true)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('참가자 목록 조회 실패:', error)
      throw error
    }

    // 참가자 수 계산
    const participantCount = participants?.length || 0

    return NextResponse.json({
      participants: participants || [],
      count: participantCount
    })
  } catch (error) {
    console.error('참가자 목록 조회 실패:', error)
    return NextResponse.json(
      { error: '참가자 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
