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

    // 집중 세션 데이터 저장
    const { data, error } = await supabase
      .from('focus_session_audio_analysis')
      .insert({
        user_id: user.id,
        is_study_related: isStudy,
        context: context || 'unknown',
        confidence: confidence || 0.5,
        analyzed_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        text: text || null,
        audio_features_count: audioFeatures || 0,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

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

    // 최근 분석 결과 조회
    const { data, error } = await supabase
      .from('focus_session_audio_analysis')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
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