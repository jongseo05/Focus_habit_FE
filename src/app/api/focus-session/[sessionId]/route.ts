import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { FocusSessionService } from '@/lib/database/focusSession'
import type { UpdateFocusSessionData } from '@/types/database'

// =====================================================
// 특정 집중 세션 API 라우트
// =====================================================

// GET: 특정 집중 세션 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 세션 조회
    const result = await FocusSessionService.getSessionServer(sessionId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    // 사용자 본인의 세션인지 확인
    if (result.data && result.data.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
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

// PATCH: 집중 세션 업데이트
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    const { ended_at, focus_score, distractions, notes } = body

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 세션 조회하여 사용자 확인
    const sessionResult = await FocusSessionService.getSessionServer(sessionId)
    if (!sessionResult.success || !sessionResult.data) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (sessionResult.data.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // 세션 업데이트
    const updateData: UpdateFocusSessionData = {}
    if (ended_at !== undefined) updateData.ended_at = ended_at
    if (focus_score !== undefined) updateData.focus_score = focus_score
    if (distractions !== undefined) updateData.distractions = distractions
    if (notes !== undefined) updateData.notes = notes

    // 서버 사이드에서 직접 업데이트
    const supabaseClient = await supabaseServer()
    const { data: session, error: updateError } = await supabaseClient
      .from('focus_session')
      .update(updateData)
      .eq('session_id', sessionId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: session,
      message: '세션이 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('Focus session API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 집중 세션 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 세션 조회하여 사용자 확인
    const sessionResult = await FocusSessionService.getSessionServer(sessionId)
    if (!sessionResult.success || !sessionResult.data) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    if (sessionResult.data.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // 세션 삭제
    const result = await FocusSessionService.deleteSession(sessionId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '세션이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Focus session API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 