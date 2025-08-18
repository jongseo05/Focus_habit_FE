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

// ML 피쳐값 저장
export async function POST(request: NextRequest) {
  try {
    const { sessionId, features } = await request.json()
    
    console.log('📥 ML 피쳐값 저장 요청:', { sessionId, features })
    
    // 요청 데이터 검증
    if (!sessionId || !features) {
      console.error('❌ 필수 데이터 누락:', { sessionId: !!sessionId, features: !!features })
      return createErrorResponse(
        'sessionId와 features는 필수 항목입니다.',
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
      return createErrorResponse(
        `ML 피쳐값 저장에 실패했습니다: ${error.message}`,
        500
      )
    }

    console.log('✅ ML 피쳐값 저장 성공:', data)

    return createSuccessResponse(
      data,
      'ML 피쳐값이 성공적으로 저장되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, 'ML 피쳐값 저장')
  }
}

// 세션별 ML 피쳐값 조회
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
    const format = searchParams.get('format') || 'json' // 'json' or 'csv'
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

    // ML 피쳐값 조회 (페이지네이션 적용)
    if (format === 'csv') {
      // CSV의 경우 모든 데이터 조회 (페이지네이션 적용 안함)
      const { data: features, error } = await supabase
        .from('ml_features')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (error) {
        console.error('Database error:', error)
        return createErrorResponse(
          'ML 피쳐 조회에 실패했습니다.',
          500
        )
      }

      // CSV 형식으로 변환
      const csvContent = convertToCSV(features || [])
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ml-features-${sessionId}.csv"`
        }
      })
    }

    // JSON 형식 - 페이지네이션 적용
    const [featuresResult, countResult] = await Promise.all([
      supabase
        .from('ml_features')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })
        .range(pagination.offset, pagination.offset + pagination.limit - 1),
      supabase
        .from('ml_features')
        .select('feature_id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
    ])

    if (featuresResult.error) {
      console.error('Database error:', featuresResult.error)
      return createErrorResponse(
        'ML 피쳐 조회에 실패했습니다.',
        500
      )
    }

    // JSON 형식으로 페이지네이션 응답 반환
    return createPaginatedResponse(
      featuresResult.data || [],
      countResult.count || 0,
      pagination,
      `${featuresResult.data?.length || 0}개의 ML 피쳐를 조회했습니다.`
    )

  } catch (error) {
    return handleAPIError(error, 'ML 피쳐 조회')
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
