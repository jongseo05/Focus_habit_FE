import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { isStudy, context, confidence, timestamp, text, audioFeatures } = await request.json()
    
    // 요청 데이터 검증
    if (typeof isStudy !== 'boolean') {
      return NextResponse.json(
        { error: 'isStudy must be a boolean' },
        { status: 400 }
      )
    }

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 현재 활성 세션 조회 또는 생성
    let sessionId: string
    
    // 사용자의 활성 세션 조회
    const { data: activeSession, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError && sessionError.code !== 'PGRST116') {
      console.error('Session error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to get active session' },
        { status: 500 }
      )
    }

    if (!activeSession) {
      // 활성 세션이 없으면 새로 생성
      const { data: newSession, error: createError } = await supabase
        .from('focus_session')
        .insert({
          user_id: user.id,
          started_at: new Date().toISOString(),
          session_type: 'study',
          context_tag: context || 'unknown'
        })
        .select('session_id')
        .single()

      if (createError) {
        console.error('Create session error:', createError)
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      sessionId = newSession.session_id
    } else {
      sessionId = activeSession.session_id
    }

    // 집중 샘플 데이터 저장
    const { data, error } = await supabase
      .from('focus_sample')
      .insert({
        session_id: sessionId,
        ts: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        score: isStudy ? 85 : 30, // 집중 점수로 변환
        topic_tag: context || 'unknown',
        score_conf: confidence || 0.5,
        rms_db: audioFeatures || 0
      })
      .select()
      .single()

    // 집중 이벤트도 함께 저장
    if (isStudy !== undefined) {
      await supabase
        .from('focus_event')
        .insert({
          session_id: sessionId,
          ts: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
          event_type: 'audio_analysis',
          payload: {
            is_study_related: isStudy,
            context: context || 'unknown',
            confidence: confidence || 0.5,
            text: text || null,
            audio_features_count: audioFeatures || 0
          }
        })
    }

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to save analysis result' },
        { status: 500 }
      )
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        isStudy,
        context,
        confidence,
        timestamp: data.analyzed_at
      }
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

    // GET 요청으로 최근 분석 결과 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // URL 파라미터에서 limit 가져오기
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // 최근 집중 샘플 데이터 조회
    const { data, error } = await supabase
      .from('focus_sample')
      .select(`
        *,
        focus_session!inner(user_id)
      `)
      .eq('focus_session.user_id', user.id)
      .order('ts', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch analysis results' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 