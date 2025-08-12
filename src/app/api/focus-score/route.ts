import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// AI 모델이 판단한 집중도 점수 저장
export async function POST(request: NextRequest) {
  try {
    const { sessionId, focusScore, timestamp, confidence, analysisMethod, features } = await request.json()
    
    console.log('📊 집중도 점수 저장 요청:', { 
      sessionId, 
      focusScore, 
      timestamp, 
      confidence, 
      analysisMethod 
    })
    
    // 요청 데이터 검증
    if (!sessionId || typeof focusScore !== 'number' || !timestamp) {
      console.error('❌ 필수 데이터 누락:', { 
        sessionId: !!sessionId, 
        focusScore: typeof focusScore, 
        timestamp: !!timestamp 
      })
      return NextResponse.json(
        { error: 'sessionId, focusScore, and timestamp are required' },
        { status: 400 }
      )
    }

    // 점수 범위 검증 (0-100)
    if (focusScore < 0 || focusScore > 100) {
      return NextResponse.json(
        { error: 'focusScore must be between 0 and 100' },
        { status: 400 }
      )
    }

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ 인증 오류:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ 사용자 인증 성공:', user.id)

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id, started_at, ended_at')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      console.error('❌ 세션 조회 오류:', sessionError)
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    console.log('✅ 세션 확인 성공:', { 
      sessionId: session.session_id, 
      startedAt: session.started_at,
      endedAt: session.ended_at 
    })

    // 집중도 점수를 focus_sample 테이블에 저장
    const { data: sampleData, error: sampleError } = await supabase
      .from('focus_sample')
      .insert({
        session_id: sessionId,
        ts: new Date(timestamp).toISOString(),
        score: Math.round(focusScore), // 정수로 반올림
        score_conf: confidence || 0.8,
        topic_tag: analysisMethod || 'ai_analysis',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (sampleError) {
      console.error('❌ 집중도 샘플 저장 실패:', sampleError)
      console.error('❌ 저장 시도한 데이터:', {
        session_id: sessionId,
        ts: new Date(timestamp).toISOString(),
        score: Math.round(focusScore),
        score_conf: confidence || 0.8,
        topic_tag: analysisMethod || 'ai_analysis'
      })
      return NextResponse.json(
        { error: 'Failed to save focus score sample', details: sampleError.message },
        { status: 500 }
      )
    }

    console.log('✅ 집중도 샘플 저장 성공:', sampleData)

    // 집중도 이벤트도 함께 저장
    const { data: eventData, error: eventError } = await supabase
      .from('focus_event')
      .insert({
        session_id: sessionId,
        ts: new Date(timestamp).toISOString(),
        event_type: 'focus',
        payload: {
          focus_score: focusScore,
          confidence: confidence || 0.8,
          analysis_method: analysisMethod || 'ai_analysis',
          features: features || {},
          timestamp: timestamp
        }
      })
      .select()
      .single()

    if (eventError) {
      console.error('❌ 집중도 이벤트 저장 실패:', eventError)
      console.error('❌ 저장 시도한 이벤트 데이터:', {
        session_id: sessionId,
        ts: new Date(timestamp).toISOString(),
        event_type: 'focus',
        payload: {
          focus_score: focusScore,
          confidence: confidence || 0.8,
          analysis_method: analysisMethod || 'ai_analysis',
          features: features || {},
          timestamp: timestamp
        }
      })
      // 샘플은 저장되었으므로 경고만 로그
    } else {
      console.log('✅ 집중도 이벤트 저장 성공:', eventData)
    }

    // 세션의 최신 집중도 점수 업데이트
    const { error: updateError } = await supabase
      .from('focus_session')
      .update({
        focus_score: focusScore,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    if (updateError) {
      console.error('❌ 세션 집중도 업데이트 실패:', updateError)
      // 경고만 로그, 샘플과 이벤트는 저장되었음
    }

    console.log('✅ 집중도 점수 저장 성공:', {
      sampleId: sampleData?.ts,
      eventId: eventData?.event_id,
      focusScore,
      timestamp
    })

    return NextResponse.json({
      success: true,
      data: {
        sample: sampleData,
        event: eventData,
        focusScore,
        timestamp
      },
      message: '집중도 점수가 성공적으로 저장되었습니다.'
    })

  } catch (error) {
    console.error('❌ 집중도 점수 저장 중 예외 발생:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// 세션별 집중도 점수 조회
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

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    // 세션이 해당 사용자의 것인지 확인
    const { data: session, error: sessionError } = await supabase
      .from('focus_session')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    // 집중도 점수 조회 쿼리 구성
    let query = supabase
      .from('focus_sample')
      .select('ts, score, score_conf, topic_tag')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })
      .limit(limit)

    // 시간 범위 필터 적용
    if (startTime) {
      query = query.gte('ts', startTime)
    }
    if (endTime) {
      query = query.lte('ts', endTime)
    }

    const { data: scores, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch focus scores' },
        { status: 500 }
      )
    }

    // 통계 계산
    const validScores = scores?.filter(s => s.score !== null) || []
    const averageScore = validScores.length > 0 
      ? Math.round(validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length)
      : 0
    const maxScore = validScores.length > 0 
      ? Math.max(...validScores.map(s => s.score))
      : 0
    const minScore = validScores.length > 0 
      ? Math.min(...validScores.map(s => s.score))
      : 0

    return NextResponse.json({
      success: true,
      data: {
        scores: scores || [],
        statistics: {
          count: validScores.length,
          average: averageScore,
          max: maxScore,
          min: minScore
        }
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
