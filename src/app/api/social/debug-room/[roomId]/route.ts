import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 특정 룸의 디버깅 정보
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  console.log('=== 룸 디버깅 시작 ===')
  const { roomId } = await params
  console.log('조회하려는 roomId:', roomId)
  
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증 결과:', { user: user?.id, authError })
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 1. 해당 roomId로 단순 조회
    const { data: simpleRoom, error: simpleError } = await supabase
      .from('study_rooms')
      .select('*')
      .eq('room_id', roomId)
    
    console.log('단순 조회 결과:', { simpleRoom, simpleError })

    // 2. 모든 활성 룸 조회
    const { data: allActiveRooms, error: allError } = await supabase
      .from('study_rooms')
      .select('room_id, name, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10)
    
    console.log('모든 활성 룸:', { allActiveRooms, allError })

    // 3. 최근 생성된 룸들 조회
    const { data: recentRooms, error: recentError } = await supabase
      .from('study_rooms')
      .select('room_id, name, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    console.log('최근 룸들:', { recentRooms, recentError })

    return NextResponse.json({
      requestedRoomId: roomId,
      simpleRoom,
      simpleError,
      allActiveRooms,
      allError,
      recentRooms,
      recentError,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('=== 룸 디버깅 에러 ===')
    console.error('에러:', error)
    
    return NextResponse.json(
      { 
        error: '디버깅 중 에러 발생',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
