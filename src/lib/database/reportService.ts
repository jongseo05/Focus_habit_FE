import { supabaseBrowser } from '@/lib/supabase/client'
import { 
  FocusSession, 
  FocusSample, 
  FocusEvent, 
  DailySummary,
  WeeklySummary,
  ApiResponse 
} from '@/types/database'
import { DailyReportData as DailyReportType, FocusScorePoint } from '@/types/dailyReport'

// =====================================================
// 1. 일일 리포트 생성 서비스
// =====================================================

export class ReportService {
  /**
   * 특정 날짜의 일일 리포트 생성 (클라이언트 사이드)
   */
  static async generateDailyReport(
    userId: string, 
    date: string
  ): Promise<ApiResponse<DailyReportType>> {
    try {
      const supabase = supabaseBrowser()
      
      // 1. 해당 날짜의 집중 세션 조회
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)
        .order('started_at', { ascending: true })

      if (sessionsError) {
        throw new Error(`세션 조회 실패: ${sessionsError.message}`)
      }

      // 2. 해당 날짜의 집중 샘플 데이터 조회
      const { data: samples, error: samplesError } = await supabase
        .from('focus_sample')
        .select('*')
        .in('session_id', sessions?.map(s => s.session_id) || [])
        .order('ts', { ascending: true })

      if (samplesError) {
        throw new Error(`샘플 데이터 조회 실패: ${samplesError.message}`)
      }

      // 3. 해당 날짜의 ML 피쳐 데이터 조회 (집중 상태 포함)
      const { data: mlFeatures, error: mlFeaturesError } = await supabase
        .from('ml_features')
        .select('*')
        .in('session_id', sessions?.map(s => s.session_id) || [])
        .order('ts', { ascending: true })

      if (mlFeaturesError) {
        throw new Error(`ML 피쳐 데이터 조회 실패: ${mlFeaturesError.message}`)
      }

      // 4. 해당 날짜의 이벤트 데이터 조회
      const { data: events, error: eventsError } = await supabase
        .from('focus_event')
        .select('*')
        .in('session_id', sessions?.map(s => s.session_id) || [])
        .order('ts', { ascending: true })

      if (eventsError) {
        throw new Error(`이벤트 데이터 조회 실패: ${eventsError.message}`)
      }

      // 5. 집중 상태 통계 계산
      const focusStatusStats = this.calculateFocusStatusStats(mlFeatures || [])

      // 6. 리포트 데이터 생성
      const reportData = this.buildDailyReportData(
        date,
        sessions || [],
        samples || [],
        events || [],
        mlFeatures || [],
        focusStatusStats
      )

      return {
        success: true,
        data: reportData,
        message: '일일 리포트가 성공적으로 생성되었습니다.'
      }

    } catch (error) {
      console.error('일일 리포트 생성 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        data: undefined
      }
    }
  }

  /**
   * 특정 날짜의 일일 리포트 생성 (서버 사이드 - API 라우트용)
   */
  static async generateDailyReportServer(
    userId: string, 
    date: string,
    supabaseClient: any
  ): Promise<ApiResponse<DailyReportType>> {
    try {
      // 1. 해당 날짜의 집중 세션 조회
      const { data: sessions, error: sessionsError } = await supabaseClient
        .from('focus_session')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)
        .order('started_at', { ascending: true })

      if (sessionsError) {
        throw new Error(`세션 조회 실패: ${sessionsError.message}`)
      }

      // 2. 해당 날짜의 집중 샘플 데이터 조회
      const { data: samples, error: samplesError } = await supabaseClient
        .from('focus_sample')
        .select('*')
        .in('session_id', sessions?.map((s: any) => s.session_id) || [])
        .order('ts', { ascending: true })

      if (samplesError) {
        throw new Error(`샘플 데이터 조회 실패: ${samplesError.message}`)
      }

      // 3. 해당 날짜의 이벤트 데이터 조회
      const { data: events, error: eventsError } = await supabaseClient
        .from('focus_event')
        .select('*')
        .in('session_id', sessions?.map((s: any) => s.session_id) || [])
        .order('ts', { ascending: true })

      if (eventsError) {
        throw new Error(`이벤트 데이터 조회 실패: ${eventsError.message}`)
      }

      // 4. ML 피쳐 데이터 조회
      const { data: mlFeatures, error: mlFeaturesError } = await supabaseClient
        .from('ml_features')
        .select('*')
        .in('session_id', sessions?.map((s: any) => s.session_id) || [])
        .order('ts', { ascending: true })

      if (mlFeaturesError) {
        throw new Error(`ML 피쳐 데이터 조회 실패: ${mlFeaturesError.message}`)
      }

      // 5. 집중 상태 통계 계산
      const focusStatusStats = this.calculateFocusStatusStats(mlFeatures || [])

      // 6. 리포트 데이터 생성
      const reportData = this.buildDailyReportData(
        date,
        sessions || [],
        samples || [],
        events || [],
        mlFeatures || [],
        focusStatusStats
      )

      return {
        success: true,
        data: reportData,
        message: '일일 리포트가 성공적으로 생성되었습니다.'
      }

    } catch (error) {
      console.error('일일 리포트 생성 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        data: undefined
      }
    }
  }

  /**
   * 집중 상태 통계 계산
   */
  private static calculateFocusStatusStats(mlFeatures: any[]) {
    if (!mlFeatures || mlFeatures.length === 0) {
      return {
        focusedCount: 0,
        normalCount: 0,
        distractedCount: 0,
        totalCount: 0,
        averageFocusScore: 0,
        focusRatio: 0
      }
    }

    const focusedCount = mlFeatures.filter(f => f.focus_status === 'focused').length
    const normalCount = mlFeatures.filter(f => f.focus_status === 'normal').length
    const distractedCount = mlFeatures.filter(f => f.focus_status === 'distracted').length
    const totalCount = mlFeatures.length

    const validScores = mlFeatures.filter(f => f.focus_score !== null && f.focus_score !== undefined)
    const averageFocusScore = validScores.length > 0
      ? Math.round(validScores.reduce((sum, f) => sum + f.focus_score, 0) / validScores.length)
      : 0

    const focusRatio = totalCount > 0 ? Math.round((focusedCount / totalCount) * 100) : 0

    return {
      focusedCount,
      normalCount,
      distractedCount,
      totalCount,
      averageFocusScore,
      focusRatio
    }
  }

  /**
   * 일일 리포트 데이터 구성
   */
  private static buildDailyReportData(
    date: string,
    sessions: any[],
    samples: any[],
    events: any[],
    mlFeatures: any[],
    focusStatusStats: any
  ): DailyReportType {
    // ML 피쳐 데이터를 활용한 집중 점수 계산
    const focusScorePoints = this.generateFocusScorePoints(samples, mlFeatures, events)

    return {
      date,
      focusScorePoints,
      highlights: this.calculateHighlights(sessions, samples, events, mlFeatures),
      aiAdvice: this.generateAIAdvice(sessions, samples, events, mlFeatures),
      reward: this.calculateReward(sessions, samples, mlFeatures)
    }
  }

  /**
   * 집중 점수 포인트 생성
   */
  private static generateFocusScorePoints(
    samples: FocusSample[],
    mlFeatures: any[],
    events: FocusEvent[]
  ): FocusScorePoint[] {
    const points: FocusScorePoint[] = []

    // 기존 샘플 데이터 처리
    samples.forEach(sample => {
      if (sample.ts && sample.score !== null && sample.score !== undefined) {
        points.push({
          ts: sample.ts,
          score: sample.score,
          events: []
        })
      }
    })

    // ML 피쳐 데이터 처리
    mlFeatures.forEach(feature => {
      if (feature.ts && feature.focus_score !== null && feature.focus_score !== undefined) {
        points.push({
          ts: feature.ts,
          score: feature.focus_score,
          events: []
        })
      }
    })

    // 시간순 정렬
    return points.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  }

  /**
   * 총 집중 시간 계산 (클라이언트 사이드)
   */
  private static calculateTotalFocusTime(sessions: FocusSession[]): string {
    let totalMinutes = 0;
    sessions.forEach(session => {
      const start = new Date(session.started_at);
      const end = new Date(session.ended_at || new Date());
      totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
    });
    return `${Math.floor(totalMinutes / 60)}:${String(Math.floor(totalMinutes % 60)).padStart(2, '0')}`;
  }

  /**
   * 평균 집중 점수 계산 (클라이언트 사이드)
   */
  private static calculateAverageScore(samples: FocusSample[], mlFeatures: any[]): number {
    const allScores = [...samples.map(s => s.score), ...mlFeatures.map(f => f.focus_score)];
    return allScores.length > 0 ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : 0;
  }

  /**
   * 최고 점수 계산 (클라이언트 사이드)
   */
  private static calculatePeakScore(samples: FocusSample[], mlFeatures: any[]): number {
    const allScores = [...samples.map(s => s.score), ...mlFeatures.map(f => f.focus_score)];
    return allScores.length > 0 ? Math.max(...allScores) : 0;
  }

  /**
   * 하이라이트 데이터 계산
   */
  private static calculateHighlights(
    sessions: FocusSession[],
    samples: FocusSample[],
    events: FocusEvent[],
    mlFeatures: any[]
  ) {
    // 총 집중 시간 계산
    const totalFocusMinutes = sessions.reduce((sum, session) => {
      const start = new Date(session.started_at)
      const end = new Date(session.ended_at || new Date())
      return sum + (end.getTime() - start.getTime()) / (1000 * 60)
    }, 0)

    // 평균 집중 점수 계산
    const avgScore = samples.length > 0 
      ? Math.round(samples.reduce((sum, s) => sum + s.score, 0) / samples.length)
      : 0

    // 최고 점수와 시간 찾기
    const peakSample = samples.reduce((max, sample) => 
      sample.score > max.score ? sample : max, 
      { score: 0, ts: '' } as FocusSample
    )

    // 최저 점수와 시간 찾기
    const dropSample = samples.reduce((min, sample) => 
      sample.score < min.score ? sample : min, 
      { score: 100, ts: '' } as FocusSample
    )

    // 휴대폰 사용 이벤트 분석
    const phoneEvents = events.filter(e => e.event_type === 'phone')
    const phoneUsage = {
      count: phoneEvents.length,
      totalTime: phoneEvents.reduce((sum, e) => 
        sum + ((e.payload as any)?.duration || 0), 0
      ),
      peakTime: phoneEvents.length > 0 
        ? new Date(phoneEvents[0].ts).toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : '없음'
    }

    // 방해 요소 분석
    const distractionEvents = events.filter(e => 
      e.event_type === 'phone' || e.event_type === 'distraction'
    )
    const distractionCount = distractionEvents.length

    // 성과 등급 계산
    const getGrade = (score: number) => {
      if (score >= 90) return '우수'
      if (score >= 80) return '양호'
      if (score >= 70) return '보통'
      if (score >= 60) return '미흡'
      return '부족'
    }

    return {
      // 총 집중 시간
      totalFocusTime: {
        time: `${Math.floor(totalFocusMinutes / 60)}:${String(Math.floor(totalFocusMinutes % 60)).padStart(2, '0')}`,
        goalProgress: Math.min(Math.round((totalFocusMinutes / 240) * 100), 100), // 4시간 목표 기준
        weekTrend: 12 // 예시값, 실제로는 주간 데이터와 비교 필요
      },
      // 평균 집중도
      averageFocus: {
        score: avgScore,
        grade: getGrade(avgScore),
        sessionImprovement: 5 // 예시값, 실제로는 이전 세션과 비교 필요
      },
      // 방해 요소
      distractions: {
        count: distractionCount,
        mainCause: distractionCount > 0 ? '휴대폰 사용' : '없음',
        details: distractionEvents.slice(0, 3).map(event => ({
          type: event.event_type,
          time: new Date(event.ts).toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          impact: event.event_type === 'phone' ? '높음' : '보통'
        })),
        yesterdayChange: -2 // 예시값, 실제로는 어제 데이터와 비교 필요
      },
      // 기존 데이터 (호환성을 위해 유지)
      peak: {
        time: peakSample.ts ? new Date(peakSample.ts).toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '없음',
        score: peakSample.score,
        duration: 45 // 예시값
      },
      drop: {
        time: dropSample.ts ? new Date(dropSample.ts).toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '없음',
        score: dropSample.score,
        reason: '집중도 하락'
      },
      phoneUsage
    }
  }

  /**
   * AI 조언 생성
   */
  private static generateAIAdvice(
    sessions: FocusSession[],
    samples: FocusSample[],
    events: FocusEvent[],
    mlFeatures: any[]
  ) {
    // 기본 조언
    let message = "오늘도 좋은 집중 세션을 보내셨습니다."
    let routine = {
      id: "morning_focus",
      name: "아침 집중 루틴",
      enabled: false,
      description: "오전 9-11시 집중 세션 자동 시작"
    }

    // 데이터 기반 개선 조언
    if (samples.length > 0) {
      const avgScore = samples.reduce((sum, s) => sum + s.score, 0) / samples.length
      
      if (avgScore < 60) {
        message = "집중도가 다소 낮았습니다. 휴식 시간을 늘리고 환경을 개선해보세요."
        routine = {
          id: "break_reminder",
          name: "휴식 알림 루틴",
          enabled: false,
          description: "30분마다 5분 휴식 알림"
        }
      } else if (avgScore > 80) {
        message = "훌륭한 집중력을 보여주셨습니다! 이 패턴을 유지해보세요."
      }
    }

    // 휴대폰 사용 패턴 분석
    const phoneEvents = events.filter(e => e.event_type === 'phone')
    if (phoneEvents.length > 5) {
      message += " 휴대폰 사용이 잦았습니다. 알림을 차단하는 것을 고려해보세요."
    }

    return {
      message,
      routine
    }
  }

  /**
   * 보상 계산
   */
  private static calculateReward(
    sessions: FocusSession[],
    samples: FocusSample[],
    mlFeatures: any[]
  ) {
    // 총 집중 시간 기반 경험치 계산
    const totalMinutes = sessions.reduce((sum, session) => {
      const start = new Date(session.started_at)
      const end = new Date(session.ended_at || new Date())
      return sum + (end.getTime() - start.getTime()) / (1000 * 60)
    }, 0)

    // 평균 점수 기반 보너스
    const avgScore = samples.length > 0 
      ? samples.reduce((sum, s) => sum + s.score, 0) / samples.length
      : 0

    const baseExp = Math.round(totalMinutes * 10) // 분당 10경험치
    const scoreBonus = Math.round(avgScore * 2) // 점수당 2경험치 보너스
    const totalExp = baseExp + scoreBonus

    // 레벨 계산 (간단한 공식)
    const level = Math.floor(totalExp / 1000) + 1
    const progress = (totalExp % 1000) / 10

    // 스티커 보상 (예시)
    const stickers = ["🌟", "🎯", "⚡", "🏆", "💎"]

    return {
      exp: totalExp,
      level,
      progress: Math.round(progress),
      stickers: stickers.slice(0, Math.min(level, stickers.length))
    }
  }

  /**
   * 주간 리포트 생성
   */
  static async generateWeeklyReport(
    userId: string,
    year: number,
    week: number
  ): Promise<ApiResponse<any>> {
    try {
      const supabase = supabaseBrowser()
      
      // 주간 데이터 조회 로직 구현
      // ...

      return {
        success: true,
        data: {},
        message: '주간 리포트가 성공적으로 생성되었습니다.'
      }

    } catch (error) {
      console.error('주간 리포트 생성 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        data: null
      }
    }
  }

  /**
   * 일일 요약 데이터 생성/업데이트 (클라이언트 사이드)
   */
  static async upsertDailySummary(
    userId: string,
    date: string
  ): Promise<ApiResponse<DailySummary>> {
    try {
      const supabase = supabaseBrowser()
      
      // 해당 날짜의 데이터 집계
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)

      if (sessionsError) {
        throw new Error(`세션 조회 실패: ${sessionsError.message}`)
      }

      // 집계 데이터 계산
      const focusMin = sessions?.reduce((sum, session) => {
        const start = new Date(session.started_at)
        const end = new Date(session.ended_at || new Date())
        return sum + (end.getTime() - start.getTime()) / (1000 * 60)
      }, 0) || 0

      const avgScore = sessions?.length 
        ? sessions.reduce((sum, s) => sum + (s.focus_score || 0), 0) / sessions.length 
        : 0

      const sessionsCount = sessions?.length || 0

      // 일일 요약 데이터 업서트
      const { data: summary, error: upsertError } = await supabase
        .from('daily_summary')
        .upsert({
          user_id: userId,
          date,
          focus_min: Math.round(focusMin),
          avg_score: Math.round(avgScore * 100) / 100,
          sessions_count: sessionsCount
        })
        .select()
        .single()

      if (upsertError) {
        throw new Error(`일일 요약 업데이트 실패: ${upsertError.message}`)
      }

      return {
        success: true,
        data: summary as DailySummary,
        message: '일일 요약이 업데이트되었습니다.'
      }

    } catch (error) {
      console.error('일일 요약 업데이트 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        data: undefined
      }
    }
  }

  /**
   * 일일 요약 데이터 생성/업데이트 (서버 사이드)
   */
  static async upsertDailySummaryServer(
    userId: string,
    date: string,
    supabaseClient: any
  ): Promise<ApiResponse<DailySummary>> {
    try {
      // 해당 날짜의 데이터 집계
      const { data: sessions, error: sessionsError } = await supabaseClient
        .from('focus_session')
        .select('*')
        .eq('user_id', userId)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)

      if (sessionsError) {
        throw new Error(`세션 조회 실패: ${sessionsError.message}`)
      }

      // 집계 데이터 계산
      const focusMin = sessions?.reduce((sum: any, session: any) => {
        const start = new Date(session.started_at)
        const end = new Date(session.ended_at || new Date())
        return sum + (end.getTime() - start.getTime()) / (1000 * 60)
      }, 0) || 0

      const avgScore = sessions?.length 
        ? sessions.reduce((sum: any, s: any) => sum + (s.focus_score || 0), 0) / sessions.length 
        : 0

      const sessionsCount = sessions?.length || 0

      // 일일 요약 데이터 업서트
      const { data: summary, error: upsertError } = await supabaseClient
        .from('daily_summary')
        .upsert({
          user_id: userId,
          date,
          focus_min: Math.round(focusMin),
          avg_score: Math.round(avgScore * 100) / 100,
          sessions_count: sessionsCount
        })
        .select()
        .single()

      if (upsertError) {
        throw new Error(`일일 요약 업데이트 실패: ${upsertError.message}`)
      }

      return {
        success: true,
        data: summary as DailySummary,
        message: '일일 요약이 업데이트되었습니다.'
      }

    } catch (error) {
      console.error('일일 요약 업데이트 실패:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        data: undefined
      }
    }
  }
} 