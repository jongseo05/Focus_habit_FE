import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '../../../lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError,
  parsePaginationParams,
  createPaginatedResponse
} from '../../../lib/api/standardResponse'

// AI 모델이 판단한 집중도 점수 저장
export async function POST(request: NextRequest) {
  try {
    const { sessionId, focusScore, timestamp, confidence, analysisMethod } = await request.json()
    
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
      return createErrorResponse(
        'sessionId, focusScore, timestamp는 필수 항목입니다.',
        400
      )
    }

    // 점수 범위 검증 (0-100)
    if (focusScore < 0 || focusScore > 100) {
      return createErrorResponse(
        '집중도 점수는 0-100 사이의 값이어야 합니다.',
        400
      )
    }

    // 표준 인증 확인
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    const { user } = authResult

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
      return createErrorResponse(
        '세션을 찾을 수 없거나 접근 권한이 없습니다.',
        404
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
      return createErrorResponse(
        `집중도 샘플 저장에 실패했습니다: ${sampleError.message}`,
        500
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

    return createSuccessResponse(
      {
        sample: sampleData,
        event: eventData,
        focusScore,
        timestamp
      },
      '집중도 점수가 성공적으로 저장되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, '집중도 점수 저장')
  }
}

// 세션별 집중도 점수 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const pagination = parsePaginationParams(searchParams)

    if (!sessionId) {
      return createErrorResponse(
        'sessionId는 필수 항목입니다.',
        400
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
      return createErrorResponse(
        '세션을 찾을 수 없거나 접근 권한이 없습니다.',
        404
      )
    }

    // 집중도 점수 조회 쿼리 구성 (페이지네이션 적용)
    let query = supabase
      .from('focus_sample')
      .select('ts, score, score_conf, topic_tag')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

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
      return createErrorResponse(
        '집중도 점수 조회에 실패했습니다.',
        500
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

    return createSuccessResponse(
      {
        scores: scores || [],
        statistics: {
          count: validScores.length,
          average: averageScore,
          max: maxScore,
          min: minScore
        }
      },
      `${validScores.length}개의 집중도 점수를 조회했습니다.`
    )

  } catch (error) {
    return handleAPIError(error, '집중도 점수 조회')
  }
}
