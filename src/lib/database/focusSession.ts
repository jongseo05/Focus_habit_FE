import { supabaseBrowser } from '@/lib/supabase/client'
import { supabaseServer } from '@/lib/supabase/server'
import type { 
  FocusSession, 
  CreateFocusSessionData, 
  UpdateFocusSessionData,
  FocusSessionFilters,
  ApiResponse 
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
  static async createSession(data: CreateFocusSessionData): Promise<ApiResponse<FocusSession>> {
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
  ): Promise<ApiResponse<FocusSession>> {
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
  static async endSession(sessionId: string): Promise<ApiResponse<FocusSession>> {
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
  static async getSession(sessionId: string): Promise<ApiResponse<FocusSession>> {
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
  static async getSessions(filters: FocusSessionFilters): Promise<ApiResponse<FocusSession[]>> {
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
  static async getTodaySessions(userId: string): Promise<ApiResponse<FocusSession[]>> {
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
  static async getActiveSession(userId: string): Promise<ApiResponse<FocusSession | null>> {
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
  static async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
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

  // =====================================================
  // 서버 사이드 함수들
  // =====================================================

  /**
   * 서버 사이드에서 집중 세션 생성
   */
  static async createSessionServer(data: CreateFocusSessionData): Promise<ApiResponse<FocusSession>> {
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
  static async getSessionServer(sessionId: string): Promise<ApiResponse<FocusSession>> {
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
  static async getSessionsServer(filters: FocusSessionFilters): Promise<ApiResponse<FocusSession[]>> {
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