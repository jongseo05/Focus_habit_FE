// =====================================================
// 개선된 집중 세션 데이터베이스 서비스
// =====================================================

import { BaseService } from './baseService'
import type { 
  FocusSession, 
  CreateFocusSessionData, 
  UpdateFocusSessionData,
  FocusSessionFilters,
  APIResponse,
  UUID,
  FocusSample,
  CreateFocusSampleData,
  FocusEvent,
  CreateFocusEventData,
  FocusStats,
  FocusTrend
} from '@/types/database'

/**
 * 집중 세션 관리 서비스
 * BaseService를 확장하여 집중 세션 관련 모든 작업을 처리합니다.
 */
export class FocusSessionService extends BaseService {
  
  // =====================================================
  // 집중 세션 CRUD 작업
  // =====================================================

  /**
   * 새로운 집중 세션 생성
   */
  static async createSession(data: CreateFocusSessionData): Promise<APIResponse<FocusSession>> {
    // 필수 필드 검증
    const validation = this.validateRequiredFields(data, ['user_id', 'started_at'])
    if (!validation.isValid) {
      return this.createErrorResponse(`필수 필드가 누락되었습니다: ${validation.missingFields?.join(', ')}`)
    }

    // UUID 형식 검증
    if (!this.isValidUUID(data.user_id)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    if (data.room_id && !this.isValidUUID(data.room_id)) {
      return this.createErrorResponse('유효하지 않은 룸 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: session, error } = await client
        .from('focus_session')
        .insert({
          user_id: data.user_id,
          room_id: data.room_id,
          started_at: data.started_at,
          goal_min: data.goal_min || 25,
          context_tag: data.context_tag,
          session_type: data.session_type || 'study',
          notes: data.notes
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '집중 세션 생성')
      }

      return this.createSuccessResponse(session as FocusSession, '집중 세션이 성공적으로 생성되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '집중 세션 생성')
    }
  }

  /**
   * 집중 세션 업데이트
   */
  static async updateSession(
    sessionId: UUID, 
    data: UpdateFocusSessionData
  ): Promise<APIResponse<FocusSession>> {
    if (!this.isValidUUID(sessionId)) {
      return this.createErrorResponse('유효하지 않은 세션 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      }

      const { data: session, error } = await client
        .from('focus_session')
        .update(updateData)
        .eq('session_id', sessionId)
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '집중 세션 업데이트')
      }

      return this.createSuccessResponse(session as FocusSession, '집중 세션이 성공적으로 업데이트되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '집중 세션 업데이트')
    }
  }

  /**
   * 집중 세션 조회 (단일)
   */
  static async getSession(sessionId: UUID): Promise<APIResponse<FocusSession>> {
    if (!this.isValidUUID(sessionId)) {
      return this.createErrorResponse('유효하지 않은 세션 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: session, error } = await client
        .from('focus_session')
        .select('*')
        .eq('session_id', sessionId)
        .single()

      if (error) {
        return this.handleSupabaseError(error, '집중 세션 조회')
      }

      return this.createSuccessResponse(session as FocusSession)
    } catch (error) {
      return this.handleSupabaseError(error, '집중 세션 조회')
    }
  }

  /**
   * 집중도 샘플 추가
   */
  static async addSample(
    sessionId: UUID, 
    sampleData: {
      timestamp: string
      score: number
      gesture_features?: any
      audio_features?: any
    }
  ): Promise<APIResponse<FocusSample>> {
    if (!this.isValidUUID(sessionId)) {
      return this.createErrorResponse('유효하지 않은 세션 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: sample, error } = await client
        .from('focus_sample')
        .insert({
          session_id: sessionId,
          timestamp: sampleData.timestamp,
          score: sampleData.score,
          gesture_features: sampleData.gesture_features,
          audio_features: sampleData.audio_features
        })
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '집중도 샘플 추가')
      }

      return this.createSuccessResponse(sample as FocusSample, '집중도 샘플이 추가되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '집중도 샘플 추가')
    }
  }

  /**
   * 집중 세션 목록 조회 (필터링 및 페이지네이션 지원)
   */
  static async getSessions(filters: FocusSessionFilters = {}): Promise<APIResponse<FocusSession[]>> {
    try {
      const client = this.getClient()
      const { limit, offset } = this.validatePagination(filters.limit, filters.offset)

      let query = client
        .from('focus_session')
        .select('*')
        .order('started_at', { ascending: false })

      // 필터 적용
      if (filters.user_id) {
        if (!this.isValidUUID(filters.user_id)) {
          return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
        }
        query = query.eq('user_id', filters.user_id)
      }

      if (filters.session_type) {
        query = query.eq('session_type', filters.session_type)
      }

      if (filters.context_tag) {
        query = query.eq('context_tag', filters.context_tag)
      }

      if (filters.start_date || filters.end_date) {
        const dateValidation = this.validateDateRange(filters.start_date, filters.end_date)
        if (!dateValidation.isValid) {
          return this.createErrorResponse(dateValidation.error!)
        }

        if (filters.start_date) {
          query = query.gte('started_at', filters.start_date)
        }
        if (filters.end_date) {
          query = query.lte('started_at', filters.end_date)
        }
      }

      // 페이지네이션 적용
      query = query.range(offset, offset + limit - 1)

      const { data: sessions, error } = await query

      if (error) {
        return this.handleSupabaseError(error, '집중 세션 목록 조회')
      }

      return this.createSuccessResponse(sessions as FocusSession[], `${sessions?.length || 0}개의 집중 세션을 조회했습니다.`)
    } catch (error) {
      return this.handleSupabaseError(error, '집중 세션 목록 조회')
    }
  }

  /**
   * 집중 세션 삭제
   */
  static async deleteSession(sessionId: UUID): Promise<APIResponse<boolean>> {
    if (!this.isValidUUID(sessionId)) {
      return this.createErrorResponse('유효하지 않은 세션 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { error } = await client
        .from('focus_session')
        .delete()
        .eq('session_id', sessionId)

      if (error) {
        return this.handleSupabaseError(error, '집중 세션 삭제')
      }

      return this.createSuccessResponse(true, '집중 세션이 성공적으로 삭제되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '집중 세션 삭제')
    }
  }

  // =====================================================
  // 집중 샘플 데이터 관리
  // =====================================================

  /**
   * 집중 샘플 데이터 배치 삽입
   */
  static async addFocusSamples(samples: CreateFocusSampleData[]): Promise<APIResponse<FocusSample[]>> {
    if (samples.length === 0) {
      return this.createErrorResponse('삽입할 샘플 데이터가 없습니다.')
    }

    // 각 샘플 데이터 검증
    for (const sample of samples) {
      if (!this.isValidUUID(sample.session_id)) {
        return this.createErrorResponse('유효하지 않은 세션 ID가 포함되어 있습니다.')
      }
      if (sample.score < 0 || sample.score > 100) {
        return this.createErrorResponse('집중도 점수는 0-100 사이여야 합니다.')
      }
    }

    try {
      const client = this.getClient()
      
      const { data: insertedSamples, error } = await client
        .from('focus_sample')
        .insert(samples)
        .select()

      if (error) {
        return this.handleSupabaseError(error, '집중 샘플 데이터 삽입')
      }

      return this.createSuccessResponse(
        insertedSamples as FocusSample[], 
        `${insertedSamples?.length || 0}개의 집중 샘플 데이터가 삽입되었습니다.`
      )
    } catch (error) {
      return this.handleSupabaseError(error, '집중 샘플 데이터 삽입')
    }
  }

  /**
   * 세션의 집중 샘플 데이터 조회
   */
  static async getFocusSamples(
    sessionId: UUID, 
    startTs?: string, 
    endTs?: string
  ): Promise<APIResponse<FocusSample[]>> {
    if (!this.isValidUUID(sessionId)) {
      return this.createErrorResponse('유효하지 않은 세션 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      let query = client
        .from('focus_sample')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (startTs) {
        query = query.gte('ts', startTs)
      }
      if (endTs) {
        query = query.lte('ts', endTs)
      }

      const { data: samples, error } = await query

      if (error) {
        return this.handleSupabaseError(error, '집중 샘플 데이터 조회')
      }

      return this.createSuccessResponse(samples as FocusSample[])
    } catch (error) {
      return this.handleSupabaseError(error, '집중 샘플 데이터 조회')
    }
  }

  // =====================================================
  // 집중 이벤트 관리
  // =====================================================

  /**
   * 집중 이벤트 추가
   */
  static async addFocusEvent(eventData: CreateFocusEventData): Promise<APIResponse<FocusEvent>> {
    const validation = this.validateRequiredFields(eventData, ['session_id', 'ts', 'event_type'])
    if (!validation.isValid) {
      return this.createErrorResponse(`필수 필드가 누락되었습니다: ${validation.missingFields?.join(', ')}`)
    }

    if (!this.isValidUUID(eventData.session_id)) {
      return this.createErrorResponse('유효하지 않은 세션 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: event, error } = await client
        .from('focus_event')
        .insert(eventData)
        .select()
        .single()

      if (error) {
        return this.handleSupabaseError(error, '집중 이벤트 추가')
      }

      return this.createSuccessResponse(event as FocusEvent, '집중 이벤트가 성공적으로 추가되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '집중 이벤트 추가')
    }
  }

  /**
   * 세션의 집중 이벤트 조회
   */
  static async getFocusEvents(sessionId: UUID): Promise<APIResponse<FocusEvent[]>> {
    if (!this.isValidUUID(sessionId)) {
      return this.createErrorResponse('유효하지 않은 세션 ID 형식입니다.')
    }

    try {
      const client = this.getClient()
      
      const { data: events, error } = await client
        .from('focus_event')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (error) {
        return this.handleSupabaseError(error, '집중 이벤트 조회')
      }

      return this.createSuccessResponse(events as FocusEvent[])
    } catch (error) {
      return this.handleSupabaseError(error, '집중 이벤트 조회')
    }
  }

  // =====================================================
  // 통계 및 분석
  // =====================================================

  /**
   * 사용자 집중 통계 계산
   */
  static async getUserFocusStats(
    userId: UUID, 
    startDate?: string, 
    endDate?: string
  ): Promise<APIResponse<FocusStats>> {
    if (!this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    if (startDate || endDate) {
      const dateValidation = this.validateDateRange(startDate, endDate)
      if (!dateValidation.isValid) {
        return this.createErrorResponse(dateValidation.error!)
      }
    }

    try {
      const client = this.getClient()
      
      let query = client
        .from('focus_session')
        .select('*')
        .eq('user_id', userId)
        .not('ended_at', 'is', null) // 완료된 세션만

      if (startDate) query = query.gte('started_at', startDate)
      if (endDate) query = query.lte('started_at', endDate)

      const { data: sessions, error } = await query

      if (error) {
        return this.handleSupabaseError(error, '집중 통계 계산')
      }

      // 통계 계산
      const stats: FocusStats = {
        total_sessions: sessions?.length || 0,
        total_focus_time: 0,
        avg_focus_score: 0,
        best_session_score: 0,
        total_distractions: 0,
        longest_streak: 0
      }

      if (sessions && sessions.length > 0) {
        // 총 집중 시간 계산 (분 단위)
        stats.total_focus_time = sessions.reduce((total, session) => {
          if (session.ended_at && session.started_at) {
            const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
            return total + Math.round(duration / (1000 * 60))
          }
          return total
        }, 0)

        // 평균 집중도 점수
        const validScores = sessions.filter(s => s.focus_score !== null && s.focus_score !== undefined)
        if (validScores.length > 0) {
          stats.avg_focus_score = validScores.reduce((sum, s) => sum + s.focus_score!, 0) / validScores.length
          stats.best_session_score = Math.max(...validScores.map(s => s.focus_score!))
        }

        // 총 방해 요소 수
        stats.total_distractions = sessions.reduce((total, session) => total + (session.distractions || 0), 0)

        // 연속 학습 일수 계산 (간단한 버전)
        stats.longest_streak = this.calculateLongestStreak(sessions)
      }

      return this.createSuccessResponse(stats, '집중 통계가 성공적으로 계산되었습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '집중 통계 계산')
    }
  }

  /**
   * 일별 집중 트렌드 데이터 조회
   */
  static async getFocusTrend(
    userId: UUID, 
    days: number = 30
  ): Promise<APIResponse<FocusTrend[]>> {
    if (!this.isValidUUID(userId)) {
      return this.createErrorResponse('유효하지 않은 사용자 ID 형식입니다.')
    }

    if (days < 1 || days > 365) {
      return this.createErrorResponse('조회 기간은 1일에서 365일 사이여야 합니다.')
    }

    try {
      const client = this.getClient()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data: sessions, error } = await client
        .from('focus_session')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', startDate.toISOString())
        .not('ended_at', 'is', null)

      if (error) {
        return this.handleSupabaseError(error, '집중 트렌드 조회')
      }

      // 일별 데이터 그룹화
      const dailyData = new Map<string, {
        focus_min: number
        scores: number[]
        sessions_count: number
      }>()

      sessions?.forEach(session => {
        const date = new Date(session.started_at).toISOString().split('T')[0]
        
        if (!dailyData.has(date)) {
          dailyData.set(date, { focus_min: 0, scores: [], sessions_count: 0 })
        }

        const dayData = dailyData.get(date)!
        
        if (session.ended_at) {
          const duration = new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()
          dayData.focus_min += Math.round(duration / (1000 * 60))
        }

        if (session.focus_score !== null && session.focus_score !== undefined) {
          dayData.scores.push(session.focus_score)
        }

        dayData.sessions_count++
      })

      // 트렌드 데이터 생성
      const trendData: FocusTrend[] = Array.from(dailyData.entries()).map(([date, data]) => ({
        date,
        focus_min: data.focus_min,
        avg_score: data.scores.length > 0 
          ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length 
          : 0,
        sessions_count: data.sessions_count
      })).sort((a, b) => a.date.localeCompare(b.date))

      return this.createSuccessResponse(trendData, '집중 트렌드 데이터를 성공적으로 조회했습니다.')
    } catch (error) {
      return this.handleSupabaseError(error, '집중 트렌드 조회')
    }
  }

  // =====================================================
  // 유틸리티 메서드
  // =====================================================

  /**
   * 연속 학습 일수 계산
   */
  private static calculateLongestStreak(sessions: FocusSession[]): number {
    if (!sessions || sessions.length === 0) return 0

    // 날짜별로 세션 그룹화
    const sessionsByDate = new Map<string, FocusSession[]>()
    
    sessions.forEach(session => {
      const date = new Date(session.started_at).toISOString().split('T')[0]
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, [])
      }
      sessionsByDate.get(date)!.push(session)
    })

    // 연속된 날짜 계산
    const dates = Array.from(sessionsByDate.keys()).sort()
    let currentStreak = 1
    let maxStreak = 1

    for (let i = 1; i < dates.length; i++) {
      const currentDate = new Date(dates[i])
      const previousDate = new Date(dates[i - 1])
      const dayDiff = (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)

      if (dayDiff === 1) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 1
      }
    }

    return maxStreak
  }
}
