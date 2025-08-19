import { supabaseBrowser } from '@/lib/supabase/client'
import { supabaseServer } from '@/lib/supabase/server'
import type { 
  FocusSession, 
  CreateFocusSessionData, 
  UpdateFocusSessionData,
  FocusSessionFilters,
  APIResponse 
} from '@/types/database'

// =====================================================
// 집중 세션 데이터베이스 서비스
// =====================================================

export class FocusSessionService {
  // =====================================================
  // 클라이언트 사이드 함수들
  // =====================================================

  /**
   * 새로운 집중 세션 생성
   */
  static async createSession(data: CreateFocusSessionData): Promise<APIResponse<FocusSession>> {
    try {
      const supabase = supabaseBrowser()
      
      const { data: session, error } = await supabase
        .from('focus_session')
        .insert({
          user_id: data.user_id,
          started_at: data.started_at,
          goal_min: data.goal_min,
          context_tag: data.context_tag,
          session_type: data.session_type || 'study',
          notes: data.notes
        })
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: session as FocusSession
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 생성 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 집중 세션 업데이트
   */
  static async updateSession(
    sessionId: string, 
    data: UpdateFocusSessionData
  ): Promise<APIResponse<FocusSession>> {
    try {
      const supabase = supabaseBrowser()
      
      const { data: session, error } = await supabase
        .from('focus_session')
        .update(data)
        .eq('session_id', sessionId)
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: session as FocusSession
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 업데이트 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 집중 세션 종료
   */
  static async endSession(sessionId: string): Promise<APIResponse<FocusSession>> {
    try {
      const supabase = supabaseBrowser()
      
      const { data: session, error } = await supabase
        .from('focus_session')
        .update({
          ended_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: session as FocusSession
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 종료 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 집중 세션 조회
   */
  static async getSession(sessionId: string): Promise<APIResponse<FocusSession>> {
    try {
      const supabase = supabaseBrowser()
      
      const { data: session, error } = await supabase
        .from('focus_session')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: session as FocusSession
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 조회 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 사용자의 집중 세션 목록 조회
   */
  static async getSessions(filters: FocusSessionFilters): Promise<APIResponse<FocusSession[]>> {
    try {
      const supabase = supabaseBrowser()
      
      let query = supabase
        .from('focus_session')
        .select('*')
        .order('started_at', { ascending: false })

      // 필터 적용
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id)
      }
      
      if (filters.start_date) {
        query = query.gte('started_at', `${filters.start_date}T00:00:00`)
      }
      
      if (filters.end_date) {
        query = query.lte('started_at', `${filters.end_date}T23:59:59`)
      }
      
      if (filters.session_type) {
        query = query.eq('session_type', filters.session_type)
      }
      
      if (filters.context_tag) {
        query = query.eq('context_tag', filters.context_tag)
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit)
      }
      
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data: sessions, error } = await query

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: sessions as FocusSession[]
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 목록 조회 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 사용자의 오늘 집중 세션 조회
   */
  static async getTodaySessions(userId: string): Promise<APIResponse<FocusSession[]>> {
    const today = new Date().toISOString().split('T')[0]
    
    return this.getSessions({
      user_id: userId,
      start_date: today,
      end_date: today
    })
  }

  /**
   * 사용자의 활성 세션 조회 (종료되지 않은 세션)
   */
  static async getActiveSession(userId: string): Promise<APIResponse<FocusSession | null>> {
    try {
      // API를 통해 활성 세션 조회
      const response = await fetch('/api/focus-session?active=true')
      
      if (!response.ok) {
        return {
          success: false,
          error: `API 호출 실패: ${response.status}`
        }
      }
      
      const result = await response.json()
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || '활성 세션 조회에 실패했습니다.'
        }
      }
      
      return {
        success: true,
        data: result.data as FocusSession | null
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '활성 세션 조회 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 집중 세션 삭제
   */
  static async deleteSession(sessionId: string): Promise<APIResponse<void>> {
    try {
      const supabase = supabaseBrowser()
      
      const { error } = await supabase
        .from('focus_session')
        .delete()
        .eq('session_id', sessionId)

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        message: '세션이 성공적으로 삭제되었습니다.'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 삭제 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 세션 종료 및 리포트 생성 (클라이언트 사이드)
   */
  static async endSessionAndGenerateReport(
    sessionId: string,
    userId: string,
    finalFocusScore?: number
  ): Promise<APIResponse<any>> {
    try {
      const supabase = supabaseBrowser()
      
      console.log('🔧 세션 종료 및 리포트 생성 시작:', { sessionId, userId, finalFocusScore })
      
      // 1. 세션 종료 처리
      const { error: endError } = await supabase
        .from('focus_session')
        .update({
          ended_at: new Date().toISOString(),
          focus_score: finalFocusScore || null,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .eq('user_id', userId)

      if (endError) {
        console.error('❌ 세션 종료 실패:', endError)
        return {
          success: false,
          error: `세션 종료 실패: ${endError.message}`
        }
      }

      console.log('✅ 세션 종료 성공')

      // 2. 세션 데이터 검증
      const { data: session, error: sessionError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (sessionError || !session) {
        console.error('❌ 세션 데이터 조회 실패:', sessionError)
        return {
          success: false,
          error: '세션 데이터를 찾을 수 없습니다.'
        }
      }

      // 3. 샘플 데이터 수 확인
      const { data: samples, error: samplesError } = await supabase
        .from('focus_sample')
        .select('ts, score')
        .eq('session_id', sessionId)

      if (samplesError) {
        console.error('❌ 샘플 데이터 조회 실패:', samplesError)
      } else {
        console.log('📊 샘플 데이터 수:', samples?.length || 0)
      }

      // 4. 이벤트 데이터 수 확인
      const { data: events, error: eventsError } = await supabase
        .from('focus_event')
        .select('ts, event_type')
        .eq('session_id', sessionId)

      if (eventsError) {
        console.error('❌ 이벤트 데이터 조회 실패:', eventsError)
      } else {
        console.log('📊 이벤트 데이터 수:', events?.length || 0)
      }

      // 5. 일일 요약 데이터 생성/업데이트 (클라이언트에서 직접 처리)
      try {
        const today = new Date().toISOString().split('T')[0]
        const { ReportService } = await import('./reportService')
        const summaryResult = await ReportService.upsertDailySummary(userId, today)
        
        if (summaryResult.success) {
          console.log('✅ 일일 요약 업데이트 성공')
        } else {
          console.error('❌ 일일 요약 업데이트 실패:', summaryResult.error)
        }
      } catch (summaryError) {
        console.error('❌ 일일 요약 처리 중 오류:', summaryError)
      }

      // 6. 세션 리포트 데이터 반환
      const reportData = {
        session: session,
        samples: samples || [],
        events: events || [],
        summary: {
          sampleCount: samples?.length || 0,
          eventCount: events?.length || 0,
          duration: session.ended_at && session.started_at 
            ? Math.floor((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60))
            : 0
        }
      }

      console.log('✅ 세션 종료 및 리포트 생성 완료:', reportData)

      return {
        success: true,
        data: reportData,
        message: '세션이 성공적으로 종료되고 리포트가 생성되었습니다.'
      }

    } catch (error) {
      console.error('❌ 세션 종료 및 리포트 생성 중 예외 발생:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      }
    }
  }

  // =====================================================
  // 서버 사이드 함수들
  // =====================================================

  /**
   * 서버 사이드에서 집중 세션 생성
   */
  static async createSessionServer(data: CreateFocusSessionData): Promise<APIResponse<FocusSession>> {
    try {
      const supabase = await supabaseServer()
      
      const { data: session, error } = await supabase
        .from('focus_session')
        .insert({
          user_id: data.user_id,
          started_at: data.started_at,
          goal_min: data.goal_min,
          context_tag: data.context_tag,
          session_type: data.session_type || 'study',
          notes: data.notes
        })
        .select()
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: session as FocusSession
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 생성 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 서버 사이드에서 집중 세션 조회
   */
  static async getSessionServer(sessionId: string): Promise<APIResponse<FocusSession>> {
    try {
      const supabase = await supabaseServer()
      
      const { data: session, error } = await supabase
        .from('focus_session')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: session as FocusSession
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 조회 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 서버 사이드에서 사용자의 집중 세션 목록 조회
   */
  static async getSessionsServer(filters: FocusSessionFilters): Promise<APIResponse<FocusSession[]>> {
    try {
      const supabase = await supabaseServer()
      
      let query = supabase
        .from('focus_session')
        .select('*')
        .order('started_at', { ascending: false })

      // 필터 적용
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id)
      }
      
      if (filters.start_date) {
        query = query.gte('started_at', `${filters.start_date}T00:00:00`)
      }
      
      if (filters.end_date) {
        query = query.lte('started_at', `${filters.end_date}T23:59:59`)
      }
      
      if (filters.session_type) {
        query = query.eq('session_type', filters.session_type)
      }
      
      if (filters.context_tag) {
        query = query.eq('context_tag', filters.context_tag)
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit)
      }
      
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data: sessions, error } = await query

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: sessions as FocusSession[]
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '세션 목록 조회 중 오류가 발생했습니다.'
      }
    }
  }
} 