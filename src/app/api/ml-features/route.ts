import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// ML 피쳐값 저장
export async function POST(request: NextRequest) {
  try {
    const { sessionId, features } = await request.json()
    
    console.log('📥 ML 피쳐값 저장 요청:', { sessionId, features })
    
    // 요청 데이터 검증
    if (!sessionId || !features) {
      console.error('❌ 필수 데이터 누락:', { sessionId: !!sessionId, features: !!features })
      return NextResponse.json(
        { error: 'sessionId and features are required' },
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

    // ML 피쳐값 저장 (새로운 ml_features 테이블 구조에 맞춤)
    const { data, error } = await supabase
      .from('ml_features')
      .insert({
        session_id: sessionId,
        ts: new Date(features.timestamp || Date.now()).toISOString(),
        head_pose_pitch: features.head_pose?.pitch || null,
        head_pose_yaw: features.head_pose?.yaw || null,
        head_pose_roll: features.head_pose?.roll || null,
        eye_status: features.eye_status?.status || features.eye_status || null,
        ear_value: features.eye_status?.ear_value || features.ear_value || null,
        frame_number: features.frame_number || 0,
        focus_status: features.focus_status || null,
        focus_confidence: features.focus_confidence || null,
        focus_score: features.focus_score || null
      })
      .select()
      .single()

    if (error) {
      console.error('❌ ML 피쳐값 저장 실패:', error)
      return NextResponse.json(
        { error: 'Failed to save ML features', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ ML 피쳐값 저장 성공:', data)

    return NextResponse.json({
      success: true,
      data: data
    })

  } catch (error) {
    console.error('❌ ML 피쳐값 저장 중 예외 발생:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// 세션별 ML 피쳐값 조회
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
    const format = searchParams.get('format') || 'json' // 'json' or 'csv'

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

    // ML 피쳐값 조회
    const { data: features, error } = await supabase
      .from('ml_features')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch ML features' },
        { status: 500 }
      )
    }

    if (format === 'csv') {
      // CSV 형식으로 변환
      const csvContent = convertToCSV(features || [])
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ml-features-${sessionId}.csv"`
        }
      })
    }

    // JSON 형식으로 반환
    return NextResponse.json({
      success: true,
      data: features || []
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// CSV 변환 함수
function convertToCSV(features: any[]): string {
  if (features.length === 0) return ''
  
  const headers = [
    'Timestamp',
    'Head Pose Pitch',
    'Head Pose Yaw', 
    'Head Pose Roll',
    'Eye Status',
    'EAR Value',
    'Frame Number'
  ]
  
  const csvRows = [headers.join(',')]
  
  for (const feature of features) {
    const row = [
      feature.ts,
      feature.head_pose_pitch,
      feature.head_pose_yaw,
      feature.head_pose_roll,
      feature.eye_status,
      feature.ear_value,
      feature.frame_number
    ].map(value => `"${value}"`).join(',')
    
    csvRows.push(row)
  }
  
  return csvRows.join('\n')
}
