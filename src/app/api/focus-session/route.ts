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

// =====================================================
// 집중 세션 API 라우트
// =====================================================

// POST: 새로운 집중 세션 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { goal_min, context_tag, session_type, notes } = body

    // 현재 사용자 정보 가져오기
    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult // 인증 실패 시 표준 에러 응답 반환
    }
    
    const { user } = authResult

    // 🚀 최적화: 활성 세션 확인 (최신 1개만 조회)
    const { data: activeSessions, error: activeError } = await supabase
      .from('focus_session')
      .select('session_id')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)

    if (activeError) {
      console.error('❌ Active session check failed:', activeError.message)
      return NextResponse.json(
        { error: 'Failed to check active session' },
        { status: 500 }
      )
    }

    // 🔄 트랜잭션으로 기존 세션 종료 + 새 세션 생성 (원자적 처리)
    const now = new Date().toISOString()
    
    try {
      // Supabase RPC 함수 호출로 트랜잭션 처리
      const { data: newSession, error: transactionError } = await supabase
        .rpc('create_focus_session_atomic', {
          p_user_id: user.id,
          p_goal_min: goal_min || null,
          p_context_tag: context_tag || '집중 세션',
          p_session_type: session_type || 'study',
          p_notes: notes || null,
          p_started_at: now
        })

      if (transactionError) {
        console.error('❌ 원자적 세션 생성 실패:', transactionError.message)
        
        // RPC 함수가 없으면 폴백으로 기존 방식 사용
        if (transactionError.code === '42883') { // function does not exist
          console.log('🔄 RPC 함수 없음, 기존 방식으로 폴백')
          return await createSessionFallback(supabase, user, goal_min, context_tag, session_type, notes, now)
        }
        
        return createErrorResponse(
          '세션 생성 중 오류가 발생했습니다.',
          500
        )
      }

      const newSessionData = Array.isArray(newSession) ? newSession[0] : newSession

      return createSuccessResponse(
        newSessionData,
        '집중 세션이 시작되었습니다.'
      )
      
    } catch (error) {
      console.error('❌ 트랜잭션 처리 중 오류:', error)
      
      // 폴백: 기존 방식으로 세션 생성
      return await createSessionFallback(supabase, user, goal_min, context_tag, session_type, notes, now)
    }

  } catch (error) {
    return handleAPIError(error, 'Focus session POST API')
  }
}

// 폴백 함수: RPC 함수가 없을 때 사용하는 기존 방식
async function createSessionFallback(
  supabase: any,
  user: any,
  goal_min: number | null,
  context_tag: string,
  session_type: string,
  notes: string | null,
  now: string
) {
  console.log('🔄 폴백 모드로 세션 생성 중...')
  
  try {
    // 1. 기존 활성 세션 종료
    const { error: closeError } = await supabase
      .from('focus_session')
      .update({ ended_at: now, updated_at: now })
      .eq('user_id', user.id)
      .is('ended_at', null)
    
    if (closeError) {
      console.error('❌ 기존 세션 종료 실패:', closeError.message)
      return NextResponse.json(
        { error: '기존 활성 세션 종료에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 2. 새 세션 생성
    const sessionData = {
      user_id: user.id,
      started_at: now,
      goal_min: goal_min || null,
      context_tag: context_tag || '집중 세션',
      session_type: session_type || 'study',
      notes: notes || null,
      created_at: now,
      updated_at: now
    }

    const { data: newSession, error: sessionError } = await supabase
      .from('focus_session')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      console.error('❌ 세션 생성 실패:', sessionError.message)
      return NextResponse.json(
        { error: sessionError.message },
        { status: 500 }
      )
    }

    console.log('✅ 폴백으로 세션 생성 성공')
    return NextResponse.json({
      success: true,
      data: newSession,
      message: '집중 세션이 시작되었습니다.'
    })
    
  } catch (error) {
    console.error('❌ 폴백 세션 생성 실패:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: 집중 세션 목록 조회 또는 활성 세션 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const session_type = searchParams.get('session_type')
    const context_tag = searchParams.get('context_tag')
    
    // 표준 페이지네이션 파라미터 파싱
    const pagination = parsePaginationParams(searchParams)

    const supabase = await supabaseServer()
    const authResult = await requireAuth(supabase)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    const { user } = authResult

    // 🚀 최적화: 활성 세션 조회 - 필요한 필드만 선택
    if (active === 'true') {
      const { data: activeSession, error: activeError } = await supabase
        .from('focus_session')
        .select('session_id, started_at, goal_min, context_tag, session_type, notes, focus_score')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle() // 🚀 최적화: single() 대신 maybeSingle() 사용

      if (activeError) {
        console.error('❌ 활성 세션 조회 실패:', activeError.message)
        return NextResponse.json(
          { error: 'Failed to fetch active session' },
          { status: 500 }
        )
      }

      return createSuccessResponse(
        activeSession || null,
        activeSession ? '활성 세션을 찾았습니다.' : '활성 세션이 없습니다.'
      )
    }

    // 🚀 최적화: 세션 목록 조회 - 직접 쿼리로 Service 레이어 우회
    let query = supabase
      .from('focus_session')
      .select('session_id, started_at, ended_at, goal_min, context_tag, session_type, notes, focus_score')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })

    // 필터 적용
    if (start_date) {
      query = query.gte('started_at', `${start_date}T00:00:00`)
    }
    if (end_date) {
      query = query.lte('started_at', `${end_date}T23:59:59`)
    }
    if (session_type) {
      query = query.eq('session_type', session_type)
    }
    if (context_tag) {
      query = query.eq('context_tag', context_tag)
    }
    
    query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)

    // 전체 개수 조회 (필터 적용)
    let countQuery = supabase
      .from('focus_session')
      .select('session_id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (start_date) {
      countQuery = countQuery.gte('started_at', `${start_date}T00:00:00`)
    }
    if (end_date) {
      countQuery = countQuery.lte('started_at', `${end_date}T23:59:59`)
    }
    if (session_type) {
      countQuery = countQuery.eq('session_type', session_type)
    }
    if (context_tag) {
      countQuery = countQuery.eq('context_tag', context_tag)
    }

    const [sessionsResult, countResult] = await Promise.all([
      query,
      countQuery
    ])

    if (sessionsResult.error) {
      console.error('❌ 세션 목록 조회 실패:', sessionsResult.error.message)
      return handleAPIError(sessionsResult.error, '세션 목록 조회')
    }

    if (countResult.error) {
      console.error('❌ 세션 개수 조회 실패:', countResult.error.message)
    }

    return createPaginatedResponse(
      sessionsResult.data || [],
      countResult.count || 0,
      pagination,
      `${sessionsResult.data?.length || 0}개의 세션을 조회했습니다.`
    )

  } catch (error) {
    return handleAPIError(error, 'Focus session GET API')
  }
} 