import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const uid = searchParams.get('uid') // URL 파라미터로 uid 받기 (선택사항)
    const includeAllUsers = searchParams.get('includeAllUsers') === 'true' // 전체 사용자 데이터 포함 여부
    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. 세션 기본 정보 조회
    const { data: sessionData, error: sessionError } = await supabase
      .from('focus_session')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2. 세션 상세 데이터 조회 (includeAllUsers가 true이거나 uid가 없으면 전체, 아니면 특정 사용자만)
    let sessionDetailsQuery = supabase
      .from('focus_sample')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })
    
    if (uid && !includeAllUsers) {
      sessionDetailsQuery = sessionDetailsQuery.eq('user_id', uid)
    }
    
    const { data: sessionDetails, error: detailsError } = await sessionDetailsQuery

    if (detailsError) {
      console.error('세션 상세 데이터 조회 오류:', detailsError)
    }

    // 3. ML 피쳐값 조회 (includeAllUsers가 true이거나 uid가 없으면 전체, 아니면 특정 사용자만)
    let mlFeaturesQuery = supabase
      .from('ml_features')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })
    
    if (uid && !includeAllUsers) {
      mlFeaturesQuery = mlFeaturesQuery.eq('user_id', uid)
    }
    
    const { data: mlFeatures, error: mlError } = await mlFeaturesQuery

    if (mlError) {
      console.error('ML 피쳐값 조회 오류:', mlError)
    }

    // 4. 제스처 데이터 조회 (includeAllUsers가 true이거나 uid가 없으면 전체, 아니면 특정 사용자만)
    let gesturesQuery = supabase
      .from('gesture_features')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true })
    
    if (uid && !includeAllUsers) {
      gesturesQuery = gesturesQuery.eq('user_id', uid)
    }
    
    const { data: gestures, error: gestureError } = await gesturesQuery

    if (gestureError) {
      console.error('제스처 데이터 조회 오류:', gestureError)
    }

    // 5. 세션에 참여한 사용자 목록 조회 (전체 데이터 다운로드 시)
    let participants: any[] = []
    if (!uid || includeAllUsers) {
      const { data: usersData, error: usersError } = await supabase
        .from('focus_sample')
        .select('user_id, ts')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })
      
      if (!usersError && usersData) {
        // 중복 제거하고 사용자별 첫 번째 기록 시간
        const userMap = new Map()
        usersData.forEach(record => {
          if (!userMap.has(record.user_id)) {
            userMap.set(record.user_id, record.ts)
          }
        })
        participants = Array.from(userMap.entries()).map(([userId, firstTs]) => ({
          user_id: userId,
          first_record: firstTs
        }))
      }
    }

    // 6. 통합 데이터 구성
    const sessionExportData = {
      export_type: (uid && !includeAllUsers) ? 'user_specific' : 'full_session',
      target_user_id: (uid && !includeAllUsers) ? uid : null,
      session_info: sessionData,
      participants: participants,
      session_details: sessionDetails || [],
      ml_features: mlFeatures || [],
      gesture_features: gestures || [],
      export_timestamp: new Date().toISOString(),
      total_records: {
        participants: participants.length,
        session_details: sessionDetails?.length || 0,
        ml_features: mlFeatures?.length || 0,
        gesture_features: gestures?.length || 0
      }
    }

    // 7. 파일명 생성
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = (uid && !includeAllUsers)
      ? `focus-session-${sessionId}-user-${uid}-${timestamp}`
      : includeAllUsers 
        ? `focus-session-${sessionId}-all-users-${timestamp}`
        : `focus-session-${sessionId}-full-${timestamp}`

    if (format === 'csv') {
      // CSV 형식으로 변환
      const csvContent = convertToCSV(sessionExportData)
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      })
    } else {
      // JSON 형식 (기본값)
      return NextResponse.json(sessionExportData, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}.json"`
        }
      })
    }

  } catch (error) {
    console.error('세션 다운로드 오류:', error)
    return NextResponse.json(
      { error: '세션 다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

function convertToCSV(data: any): string {
  const csvRows: string[] = []
  
  // 1. 세션 정보
  csvRows.push('=== 세션 정보 ===')
  csvRows.push('필드,값')
  Object.entries(data.session_info).forEach(([key, value]) => {
    csvRows.push(`${key},"${value}"`)
  })
  
  // 2. 참가자 정보 (전체 세션 다운로드 시)
  if (data.participants && data.participants.length > 0) {
    csvRows.push('')
    csvRows.push('=== 세션 참가자 정보 ===')
    csvRows.push('사용자 ID,첫 번째 기록 시간')
    data.participants.forEach((participant: any) => {
      csvRows.push(`${participant.user_id},"${participant.first_record}"`)
    })
  }
  
  // 3. 세션 상세 데이터 (focus_sample)
  if (data.session_details.length > 0) {
    csvRows.push('')
    csvRows.push('=== 세션 상세 데이터 (focus_sample) ===')
    const detailHeaders = Object.keys(data.session_details[0])
    csvRows.push(detailHeaders.join(','))
    
    data.session_details.forEach((detail: any) => {
      const row = detailHeaders.map(header => {
        const value = detail[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      })
      csvRows.push(row.join(','))
    })
  }
  
  // 4. ML 피쳐값
  if (data.ml_features.length > 0) {
    csvRows.push('')
    csvRows.push('=== ML 피쳐값 (ml_features) ===')
    const mlHeaders = Object.keys(data.ml_features[0])
    csvRows.push(mlHeaders.join(','))
    
    data.ml_features.forEach((feature: any) => {
      const row = mlHeaders.map(header => {
        const value = feature[header]
        if (typeof value === 'object') {
          return `"${JSON.stringify(value)}"`
        }
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      })
      csvRows.push(row.join(','))
    })
  }
  
  // 5. 제스처 데이터
  if (data.gesture_features.length > 0) {
    csvRows.push('')
    csvRows.push('=== 제스처 데이터 (gesture_features) ===')
    const gestureHeaders = Object.keys(data.gesture_features[0])
    csvRows.push(gestureHeaders.join(','))
    
    data.gesture_features.forEach((gesture: any) => {
      const row = gestureHeaders.map(header => {
        const value = gesture[header]
        if (typeof value === 'object') {
          return `"${JSON.stringify(value)}"`
        }
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      })
      csvRows.push(row.join(','))
    })
  }
  
  // 6. 내보내기 정보
  csvRows.push('')
  csvRows.push('=== 내보내기 정보 ===')
  csvRows.push('내보내기 유형,' + (data.export_type === 'user_specific' ? '특정 사용자' : '전체 세션'))
  if (data.target_user_id) {
    csvRows.push('대상 사용자 ID,' + data.target_user_id)
  }
  csvRows.push('참가자 수,' + data.total_records.participants)
  csvRows.push('내보내기 시간,' + data.export_timestamp)
  csvRows.push('총 세션 상세 레코드 수,' + data.total_records.session_details)
  csvRows.push('총 ML 피쳐값 레코드 수,' + data.total_records.ml_features)
  csvRows.push('총 제스처 레코드 수,' + data.total_records.gesture_features)
  
  return csvRows.join('\n')
}
