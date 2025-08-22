import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 관리자 권한 확인 (API 키 또는 특정 사용자만)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      olderThanHours = 24, // 기본 24시간 이상 된 데이터
      minDataCount = 10,   // 최소 10개 미만의 데이터
      dryRun = false       // 실제 삭제 여부
    } = body

    console.log(`자동 정리 시작 - ${olderThanHours}시간 이상, ${minDataCount}개 미만, dryRun: ${dryRun}`)

    // 1. 불완전한 세션 찾기 (24시간 이상 된 데이터)
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString()
    
    const { data: incompleteSessions, error: queryError } = await supabase
      .from('personalization_data')
      .select('session_id, user_id, created_at')
      .lt('created_at', cutoffTime)
      .order('created_at', { ascending: false })

    if (queryError) {
      console.error('불완전한 세션 조회 오류:', queryError)
      throw new Error('불완전한 세션을 조회할 수 없습니다')
    }

    // 2. 세션별로 데이터 개수 집계
    const sessionStats = incompleteSessions?.reduce((acc, item) => {
      const sessionId = item.session_id
      if (!acc[sessionId]) {
        acc[sessionId] = {
          sessionId,
          userId: item.user_id,
          count: 0,
          createdAt: item.created_at
        }
      }
      acc[sessionId].count++
      return acc
    }, {} as Record<string, any>) || {}

    // 3. 정리 대상 세션 필터링 (시간 기반)
    const sessionsToCleanup = Object.values(sessionStats).filter((session: any) => {
      const sessionAge = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / (1000 * 60 * 60))
      const isOldEnough = sessionAge >= olderThanHours
      const hasInsufficientData = session.count < minDataCount
      
      // 5분을 초과한 세션도 정리 대상에 포함
      const sessionDuration = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / (1000 * 60))
      const isOverTimeLimit = sessionDuration > 5
      
      return isOldEnough && (hasInsufficientData || isOverTimeLimit)
    })

    console.log(`정리 대상 세션: ${sessionsToCleanup.length}개`)

    if (dryRun) {
      // 실제 삭제하지 않고 결과만 반환
      return NextResponse.json({
        success: true,
        message: '드라이 런 완료',
        data: {
          sessionsToCleanup,
          totalSessions: sessionsToCleanup.length,
          dryRun: true
        }
      })
    }

    // 4. 실제 데이터 삭제
    let deletedCount = 0
    const deletedSessions: string[] = []

    for (const session of sessionsToCleanup) {
      const { error: deleteError } = await supabase
        .from('personalization_data')
        .delete()
        .eq('session_id', session.sessionId)

      if (deleteError) {
        console.error(`세션 ${session.sessionId} 삭제 오류:`, deleteError)
        continue
      }

      deletedCount++
      deletedSessions.push(session.sessionId)
    }

    console.log(`자동 정리 완료 - ${deletedCount}개 세션 삭제됨`)

    return NextResponse.json({
      success: true,
      message: '자동 정리가 완료되었습니다',
      data: {
        deletedSessions,
        totalDeleted: deletedCount,
        dryRun: false
      }
    })

  } catch (error) {
    console.error('자동 정리 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '자동 정리 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// GET 요청으로 정리 통계 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const olderThanHours = parseInt(searchParams.get('older_than_hours') || '24')

    // 24시간 이상 된 데이터 조회
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString()
    
    const { data: oldSessions, error: queryError } = await supabase
      .from('personalization_data')
      .select('session_id, user_id, created_at')
      .lt('created_at', cutoffTime)
      .order('created_at', { ascending: false })

    if (queryError) {
      console.error('오래된 세션 조회 오류:', queryError)
      throw new Error('오래된 세션을 조회할 수 없습니다')
    }

    // 세션별 통계 계산
    const sessionStats = oldSessions?.reduce((acc, item) => {
      const sessionId = item.session_id
      if (!acc[sessionId]) {
        acc[sessionId] = {
          sessionId,
          userId: item.user_id,
          count: 0,
          createdAt: item.created_at,
          ageHours: Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60))
        }
      }
      acc[sessionId].count++
      return acc
    }, {} as Record<string, any>) || {}

    const stats = {
      totalOldSessions: Object.keys(sessionStats).length,
      sessionsWithLessThan10: Object.values(sessionStats).filter((s: any) => s.count < 10).length,
      sessionsWithLessThan50: Object.values(sessionStats).filter((s: any) => s.count < 50).length,
      averageAgeHours: Object.values(sessionStats).reduce((sum: number, s: any) => sum + s.ageHours, 0) / Object.keys(sessionStats).length || 0,
      oldestSessionHours: Math.max(...Object.values(sessionStats).map((s: any) => s.ageHours), 0)
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        cutoffTime,
        olderThanHours
      }
    })

  } catch (error) {
    console.error('정리 통계 조회 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '통계 조회 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
