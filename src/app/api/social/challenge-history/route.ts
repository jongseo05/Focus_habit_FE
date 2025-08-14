import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 대결 기록 저장
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { room_id, challenge_id, duration, scores, winner_id, mode, config } = body

    // 필수 필드 검증
    if (!room_id || !challenge_id || !duration || !scores || !winner_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 대결 기록 저장
    const { data: history, error } = await supabase
      .from('challenge_history')
      .insert({
        room_id,
        challenge_id,
        duration,
        scores,
        winner_id,
        mode,
        config,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Challenge history save error:', error)
      return NextResponse.json({ error: 'Failed to save challenge history' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      history,
      message: 'Challenge history saved successfully' 
    })
  } catch (error) {
    console.error('Challenge history save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 대결 기록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // 대결 기록 조회
    const { data: history, error } = await supabase
      .from('challenge_history')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Challenge history fetch error:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch challenge history', 
        details: error.message,
        code: error.code 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      history: history || [],
      message: 'Challenge history fetched successfully' 
    })
  } catch (error) {
    console.error('Challenge history fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
