import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { FocusSessionService } from '@/lib/database/focusSession'
import type { CreateFocusSessionData, UpdateFocusSessionData } from '@/types/database'

// =====================================================
// 집중 세션 API 라우트
// =====================================================

// POST: 새로운 집중 세션 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { goal_min, context_tag, session_type, notes } = body

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 활성 세션이 있는지 확인
    const { data: activeSession } = await supabase
      .from('focus_session')
      .select('session_id')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .single()

    if (activeSession) {
      return NextResponse.json(
        { error: '이미 활성 세션이 있습니다. 기존 세션을 종료해주세요.' },
        { status: 400 }
      )
    }

    // 새 세션 생성
    const sessionData: CreateFocusSessionData = {
      user_id: user.id,
      started_at: new Date().toISOString(),
      goal_min: goal_min || null,
      context_tag: context_tag || null,
      session_type: session_type || 'study',
      notes: notes || null
    }

    const result = await FocusSessionService.createSessionServer(sessionData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: '집중 세션이 시작되었습니다.'
    })

  } catch (error) {
    console.error('Focus session API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: 집중 세션 목록 조회 또는 활성 세션 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active') // 활성 세션 조회 플래그
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const session_type = searchParams.get('session_type')
    const context_tag = searchParams.get('context_tag')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 활성 세션 조회 요청인 경우
    if (active === 'true') {
      const { data: activeSession, error: activeError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .single()

      if (activeError && activeError.code !== 'PGRST116') { // PGRST116: 결과가 없음
        console.error('Active session query error:', activeError)
        return NextResponse.json(
          { error: 'Failed to fetch active session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: activeSession || null
      })
    }

    // 기존 세션 목록 조회 로직
    const result = await FocusSessionService.getSessionsServer({
      user_id: user.id,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      session_type: session_type || undefined,
      context_tag: context_tag || undefined,
      limit,
      offset
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data
    })

  } catch (error) {
    console.error('Focus session API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 