import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { 
      startTime, 
      endTime, 
      duration, 
      originalFocusScore, 
      overrideFocusScore, 
      reason, 
      confidence 
    } = await req.json()

    // 필수 필드 검증
    if (!startTime || !endTime || !overrideFocusScore || !reason) {
      return NextResponse.json({ 
        error: "필수 필드가 누락되었습니다." 
      }, { status: 400 })
    }

    const supabase = await supabaseServer()

    // 현재 활성 집중 세션 조회
    const { data: activeSession, error: sessionError } = await supabase
      .from('focus_sessions')
      .select('id, user_id, start_time')
      .eq('status', 'active')
      .single()

    if (sessionError || !activeSession) {
      return NextResponse.json({ 
        error: "활성 집중 세션을 찾을 수 없습니다." 
      }, { status: 404 })
    }

    // 발화 시간 동안의 집중도 데이터 조회
    const { data: focusScores, error: scoresError } = await supabase
      .from('focus_scores')
      .select('id, score, timestamp')
      .eq('session_id', activeSession.id)
      .gte('timestamp', new Date(startTime).toISOString())
      .lte('timestamp', new Date(endTime).toISOString())
      .order('timestamp', { ascending: true })

    if (scoresError) {
      console.error('집중도 점수 조회 오류:', scoresError)
      return NextResponse.json({ 
        error: "집중도 점수 조회에 실패했습니다." 
      }, { status: 500 })
    }

    // 집중도 덮어쓰기 로그 생성
    const { error: logError } = await supabase
      .from('focus_score_overrides')
      .insert({
        session_id: activeSession.id,
        user_id: activeSession.user_id,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        duration: duration,
        original_focus_score: originalFocusScore,
        override_focus_score: overrideFocusScore,
        reason: reason,
        confidence: confidence,
        affected_score_count: focusScores?.length || 0
      })

    if (logError) {
      console.error('집중도 덮어쓰기 로그 생성 오류:', logError)
    }

    // 집중도 점수들을 덮어쓰기 값으로 업데이트
    if (focusScores && focusScores.length > 0) {
      const updatePromises = focusScores.map(score => 
        supabase
          .from('focus_scores')
          .update({ 
            score: overrideFocusScore,
            override_reason: reason,
            override_timestamp: new Date().toISOString()
          })
          .eq('id', score.id)
      )

      const updateResults = await Promise.all(updatePromises)
      const updateErrors = updateResults.filter(result => result.error)

      if (updateErrors.length > 0) {
        console.error('집중도 점수 업데이트 오류:', updateErrors)
        return NextResponse.json({ 
          error: "일부 집중도 점수 업데이트에 실패했습니다." 
        }, { status: 500 })
      }

      console.log(`✅ ${focusScores.length}개의 집중도 점수를 ${overrideFocusScore}점으로 덮어쓰기 완료`)
    }

    return NextResponse.json({
      success: true,
      message: "집중도 덮어쓰기가 완료되었습니다.",
      overriddenCount: focusScores?.length || 0,
      overrideScore: overrideFocusScore,
      reason: reason
    })

  } catch (error) {
    console.error('집중도 덮어쓰기 API 오류:', error)
    return NextResponse.json({ 
      error: "집중도 덮어쓰기 처리 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
