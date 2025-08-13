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

    // 참가자 목록 조회
    const { data: participants, error } = await supabase
      .from('room_participants')
      .select(`
        *,
        user:user_id(name, avatar_url)
      `)
      .eq('room_id', params.roomId)
      .is('left_at', null)
      .order('joined_at', { ascending: true })

    if (error) throw error

    return NextResponse.json(participants || [])
  } catch (error) {
    console.error('참가자 목록 조회 실패:', error)
    return NextResponse.json(
      { error: '참가자 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
