import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 디버깅용 - 모든 스터디룸 조회
export async function GET() {
  try {
    const supabase = await supabaseServer()
    
    // 모든 스터디룸 조회 (필터 없이)
    const { data: rooms, error } = await supabase
      .from('study_rooms')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    
    return NextResponse.json({
      total: rooms?.length || 0,
      rooms: rooms || [],
      message: '모든 스터디룸 조회 완료'
    })
  } catch (error) {
    console.error('디버깅 조회 실패:', error)
    return NextResponse.json(
      { error: '디버깅 조회에 실패했습니다.' },
      { status: 500 }
    )
  }
}
