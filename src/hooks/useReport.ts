import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DailyReportData } from '@/types/dailyReport'

// =====================================================
// 1. Query Keys
// =====================================================

export const reportKeys = {
  all: ['report'] as const,
  daily: (date: string) => [...reportKeys.all, 'daily', date] as const,
  weekly: (year: number, week: number) => [...reportKeys.all, 'weekly', year, week] as const,
  summary: (date: string) => [...reportKeys.all, 'summary', date] as const,
}

// =====================================================
// 2. 일일 리포트 훅
// =====================================================

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: reportKeys.daily(date),
    queryFn: async (): Promise<DailyReportData> => {
      console.log('🚀 Supabase 직접 요청 시작:', date)
      
      try {
        // Supabase 클라이언트 직접 사용
        const { ReportService } = await import('@/lib/database/reportService')
        const { supabaseBrowser } = await import('@/lib/supabase/client')
        
        const supabase = supabaseBrowser()
        
        // 사용자 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          console.error('❌ 인증 오류:', authError)
          throw new Error('인증이 필요합니다')
        }
        
        console.log('✅ 인증 성공, 사용자 ID:', user.id)
        
        // ReportService 직접 호출
        const result = await ReportService.generateDailyReport(user.id, date)
        
        console.log('📊 리포트 생성 결과:', result)
        
        if (!result.success) {
          throw new Error(result.error || '리포트 생성에 실패했습니다')
        }
        
        console.log('✅ 리포트 데이터 반환:', result.data)
        if (!result.data) {
          throw new Error('리포트 데이터가 없습니다')
        }
        return result.data
      } catch (error) {
        console.error('❌ 리포트 요청 중 오류:', error)
        throw error
      }
    },
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// =====================================================
// 3. 주간 리포트 훅
// =====================================================

export function useWeeklyReport(year: number, week: number) {
  return useQuery({
    queryKey: reportKeys.weekly(year, week),
    queryFn: async () => {
      const response = await fetch(`/api/report/weekly?year=${year}&week=${week}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '주간 리포트를 불러오는데 실패했습니다.')
      }
      
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10분
    gcTime: 30 * 60 * 1000, // 30분
    retry: 2,
  })
}

// =====================================================
// 4. 일일 요약 훅
// =====================================================

export function useDailySummary(date: string) {
  return useQuery({
    queryKey: reportKeys.summary(date),
    queryFn: async () => {
      const response = await fetch(`/api/report/summary?date=${date}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '일일 요약을 불러오는데 실패했습니다.')
      }
      
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000, // 5분
  })
}

// =====================================================
// 5. 리포트 새로고침 뮤테이션
// =====================================================

export function useRefreshDailyReport() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ date }: { date: string }) => {
      const response = await fetch(`/api/report/daily?date=${date}&refresh=true`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '리포트 새로고침에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: (data, { date }) => {
      // 캐시 업데이트
      queryClient.setQueryData(reportKeys.daily(date), data)
      
      // 관련 쿼리들 무효화
      queryClient.invalidateQueries({
        queryKey: reportKeys.summary(date)
      })
    },
  })
}

// =====================================================
// 6. 리포트 내보내기 뮤테이션
// =====================================================

export function useExportReport() {
  return useMutation({
    mutationFn: async ({ 
      type, 
      date, 
      format = 'pdf' 
    }: { 
      type: 'daily' | 'weekly'
      date: string
      format?: 'pdf' | 'csv' | 'json'
    }) => {
      const response = await fetch(`/api/report/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, date, format }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '리포트 내보내기에 실패했습니다.')
      }
      
      return response.blob()
    },
    onSuccess: (blob, { type, date, format }) => {
      // 파일 다운로드
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `focus-report-${type}-${date}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
  })
}

// =====================================================
// 7. 리포트 공유 뮤테이션
// =====================================================

export function useShareReport() {
  return useMutation({
    mutationFn: async ({ 
      type, 
      date, 
      shareType = 'link' 
    }: { 
      type: 'daily' | 'weekly'
      date: string
      shareType?: 'link' | 'email' | 'social'
    }) => {
      const response = await fetch(`/api/report/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, date, shareType }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '리포트 공유에 실패했습니다.')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      // 공유 성공 처리 (예: 토스트 메시지)
      console.log('리포트 공유 성공:', data)
    },
  })
}

// =====================================================
// 8. 리포트 프리페치 훅
// =====================================================

export function usePrefetchReport() {
  const queryClient = useQueryClient()
  
  return {
    prefetchDaily: (date: string) => {
      queryClient.prefetchQuery({
        queryKey: reportKeys.daily(date),
        queryFn: async () => {
          const response = await fetch(`/api/report/daily?date=${date}`)
          if (!response.ok) throw new Error('Prefetch failed')
          return response.json()
        },
        staleTime: 5 * 60 * 1000,
      })
    },
    
    prefetchWeekly: (year: number, week: number) => {
      queryClient.prefetchQuery({
        queryKey: reportKeys.weekly(year, week),
        queryFn: async () => {
          const response = await fetch(`/api/report/weekly?year=${year}&week=${week}`)
          if (!response.ok) throw new Error('Prefetch failed')
          return response.json()
        },
        staleTime: 10 * 60 * 1000,
      })
    },
  }
} 

// =====================================================
// 9. 일일 활동 타임라인 훅
// =====================================================

export function useDailyActivities(date: string) {
  return useQuery({
    queryKey: [...reportKeys.all, 'activities', date],
    queryFn: async () => {
      const { supabaseBrowser } = await import('@/lib/supabase/client')
      const supabase = supabaseBrowser()
      
      // 사용자 인증 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('인증이 필요합니다')
      }
      
      // 해당 날짜의 세션 ID들 조회
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)
      
      if (sessionsError) {
        throw new Error(sessionsError.message)
      }
      
      const sessionIds = sessions?.map(s => s.session_id) || []
      
      if (sessionIds.length === 0) {
        return []
      }
      
      // 이벤트 데이터 조회
      const { data: events, error: eventsError } = await supabase
        .from('focus_event')
        .select('*')
        .in('session_id', sessionIds)
        .order('ts', { ascending: true })
      
      if (eventsError) {
        throw new Error(eventsError.message)
      }
      
      // 활동 데이터 변환
      return events?.map(event => ({
        timestamp: new Date(event.ts).toLocaleTimeString('ko-KR', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        }),
        action: getEventAction(event.event_type),
        type: getEventType(event.event_type),
        impact: getEventImpact(event.event_type),
        description: getEventDescription(event.event_type, event.payload)
      })) || []
    },
    staleTime: 5 * 60 * 1000, // 5분
    enabled: !!date,
  })
}

// 이벤트 관련 유틸리티 함수들
function getEventAction(eventType: string): string {
  const actionMap: Record<string, string> = {
    'phone': '휴대폰 사용',
    'distraction': '방해 요소',
    'break': '휴식',
    'focus': '집중',
    'posture': '자세 교정',
    'audio_analysis': '음성 분석'
  }
  return actionMap[eventType] || '기타 활동'
}

function getEventType(eventType: string): 'positive' | 'negative' | 'neutral' {
  const typeMap: Record<string, 'positive' | 'negative' | 'neutral'> = {
    'phone': 'negative',
    'distraction': 'negative', 
    'break': 'neutral',
    'focus': 'positive',
    'posture': 'positive',
    'audio_analysis': 'neutral'
  }
  return typeMap[eventType] || 'neutral'
}

function getEventImpact(eventType: string): number {
  const impactMap: Record<string, number> = {
    'phone': -5,
    'distraction': -3,
    'break': 0,
    'focus': 8,
    'posture': 3,
    'audio_analysis': 0
  }
  return impactMap[eventType] || 0
}

function getEventDescription(eventType: string, payload?: any): string {
  const descriptionMap: Record<string, string> = {
    'phone': '집중 세션 중 짧은 휴대폰 확인',
    'distraction': '외부 방해 요소 감지',
    'break': '의도적인 휴식 시간',
    'focus': '25분간 방해 없이 지속적인 주의 집중',
    'posture': '앉은 자세 개선 감지',
    'audio_analysis': '음성 분석을 통한 집중도 측정'
  }
  return descriptionMap[eventType] || '활동 감지됨'
}

// =====================================================
// 10. 일일 스냅샷 훅
// =====================================================

export function useDailySnapshots(date: string) {
  return useQuery({
    queryKey: [...reportKeys.all, 'snapshots', date],
    queryFn: async () => {
      const { supabaseBrowser } = await import('@/lib/supabase/client')
      const supabase = supabaseBrowser()
      
      // 사용자 인증 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('인증이 필요합니다')
      }
      
      // 해당 날짜의 세션 ID들 조회
      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_session')
        .select('session_id')
        .eq('user_id', user.id)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)
      
      if (sessionsError) {
        throw new Error(sessionsError.message)
      }
      
      const sessionIds = sessions?.map(s => s.session_id) || []
      
      if (sessionIds.length === 0) {
        return []
      }
      
      // 스냅샷 데이터 조회
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('snapshot')
        .select('*')
        .in('session_id', sessionIds)
        .order('ts', { ascending: false })
      
      if (snapshotsError) {
        throw new Error(snapshotsError.message)
      }
      
      // 스냅샷 데이터 변환
      return snapshots?.map(snapshot => ({
        id: snapshot.snapshot_id,
        timestamp: new Date(snapshot.ts).toLocaleTimeString('ko-KR'),
        thumbnail: snapshot.thumb_url || '/placeholder.svg?height=120&width=160',
        focusScore: snapshot.focus_score || 0,
        notes: getSnapshotNotes(snapshot.focus_score),
        type: getSnapshotType(snapshot.focus_score)
      })) || []
    },
    staleTime: 10 * 60 * 1000, // 10분
    enabled: !!date,
  })
}

function getSnapshotNotes(focusScore: number): string {
  if (focusScore >= 90) return "최고 집중 순간 - 우수한 자세와 주의력"
  if (focusScore >= 80) return "높은 집중도 유지 중"
  if (focusScore >= 60) return "보통 수준의 집중도"
  if (focusScore >= 40) return "집중도가 다소 낮음"
  return "집중도가 매우 낮음 - 개선 필요"
}

function getSnapshotType(focusScore: number): 'high_focus' | 'distraction' | 'break' | 'normal' {
  if (focusScore >= 90) return 'high_focus'
  if (focusScore >= 70) return 'normal'
  if (focusScore >= 50) return 'break'
  return 'distraction'
} 

// =====================================================
// 11. 일일 성취도 훅
// =====================================================

export function useDailyAchievements(date: string) {
  return useQuery({
    queryKey: [...reportKeys.all, 'achievements', date],
    queryFn: async () => {
      const { supabaseBrowser } = await import('@/lib/supabase/client')
      const supabase = supabaseBrowser()
      
      // 사용자 인증 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error('인증이 필요합니다')
      }
      
      // 활성 습관 조회
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
      
      if (habitsError) {
        throw new Error(habitsError.message)
      }
      
      // 오늘의 기록 조회
      const { data: records, error: recordsError } = await supabase
        .from('habit_records')
        .select('*')
        .eq('date', date)
      
      if (recordsError) {
        throw new Error(recordsError.message)
      }
      
      return habits?.map(habit => {
        const record = records?.find(r => r.habit_id === habit.id)
        const progress = record?.completed_count || 0
        const target = getHabitTarget(habit.name)
        
        return {
          id: habit.id,
          title: habit.name,
          description: habit.description || '',
          progress,
          target,
          completed: progress >= target,
          badge: getHabitBadge(habit.name),
          category: getHabitCategory(habit.name)
        }
      }) || []
    },
    staleTime: 10 * 60 * 1000, // 10분
    enabled: !!date,
  })
}

function getHabitTarget(habitName: string): number {
  const targetMap: Record<string, number> = {
    '집중력 마스터': 7,
    '일관성 챔피언': 30,
    '방해 요소 제거자': 50,
    '저녁 2시간 무휴대폰': 1,
    '주간 20시간 집중': 20,
    '연속 7일 목표달성': 7
  }
  return targetMap[habitName] || 1
}

function getHabitBadge(habitName: string): string {
  const badgeMap: Record<string, string> = {
    '집중력 마스터': '🎯',
    '일관성 챔피언': '🏆',
    '방해 요소 제거자': '📱',
    '저녁 2시간 무휴대폰': '🌙',
    '주간 20시간 집중': '⏰',
    '연속 7일 목표달성': '🔥'
  }
  return badgeMap[habitName] || '⭐'
}

function getHabitCategory(habitName: string): 'focus' | 'consistency' | 'improvement' | 'time' {
  const categoryMap: Record<string, 'focus' | 'consistency' | 'improvement' | 'time'> = {
    '집중력 마스터': 'focus',
    '일관성 챔피언': 'consistency',
    '방해 요소 제거자': 'improvement',
    '저녁 2시간 무휴대폰': 'time',
    '주간 20시간 집중': 'time',
    '연속 7일 목표달성': 'consistency'
  }
  return categoryMap[habitName] || 'focus'
} 

// 오늘의 집중 세션 목록 조회
export function useTodaySessions(date: string) {
  return useQuery({
    queryKey: [...reportKeys.all, 'sessions', date],
    queryFn: async () => {
      const { supabaseBrowser } = await import('@/lib/supabase/client')
      const supabase = supabaseBrowser()
      
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('인증되지 않은 사용자입니다.')
      }

      // 오늘 날짜의 집중 세션 조회
      const { data: sessions, error } = await supabase
        .from('focus_session')
        .select(`
          session_id,
          started_at,
          ended_at,
          context_tag,
          goal_min,
          focus_score,
          distractions
        `)
        .eq('user_id', user.id)
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59`)
        .order('started_at', { ascending: false })

      if (error) {
        throw new Error('세션 데이터를 불러오는데 실패했습니다.')
      }

      return sessions?.map(session => {
        // 실제 세션 시간 계산
        let actualDuration = 0
        if (session.ended_at) {
          const startTime = new Date(session.started_at)
          const endTime = new Date(session.ended_at)
          actualDuration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)) // 분 단위
        } else {
          // 진행 중인 세션의 경우 현재 시간까지의 경과 시간
          const startTime = new Date(session.started_at)
          const currentTime = new Date()
          actualDuration = Math.round((currentTime.getTime() - startTime.getTime()) / (1000 * 60)) // 분 단위
        }

        return {
          id: session.session_id,
          title: session.context_tag || `집중 세션 ${new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
          description: session.context_tag || '집중 세션',
          startTime: new Date(session.started_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          endTime: session.ended_at ? new Date(session.ended_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '진행 중',
          duration: actualDuration,
          averageScore: session.focus_score || 0,
          isActive: !session.ended_at,
          startedAt: session.started_at,
          endedAt: session.ended_at
        }
      }) || []
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!date,
  })
} 

// 특정 세션의 리포트 데이터 조회
export function useSessionReport(sessionId: string) {
  return useQuery({
    queryKey: [...reportKeys.all, 'session', sessionId],
    queryFn: async () => {
      const { supabaseBrowser } = await import('@/lib/supabase/client')
      const supabase = supabaseBrowser()
      
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('인증되지 않은 사용자입니다.')
      }

      // 세션 정보 조회
      const { data: session, error: sessionError } = await supabase
        .from('focus_session')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (sessionError || !session) {
        throw new Error('세션을 찾을 수 없습니다.')
      }

      // 세션 기간의 샘플 데이터 조회 (focus_sample 테이블)
      const { data: samples, error: samplesError } = await supabase
        .from('focus_sample')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (samplesError) {
        console.error('샘플 데이터 조회 실패:', samplesError)
      }

      // 세션 기간의 ML 피쳐 데이터 조회 (ml_features 테이블 - 집중 상태 포함)
      const { data: mlFeatures, error: mlFeaturesError } = await supabase
        .from('ml_features')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (mlFeaturesError) {
        console.error('ML 피쳐 데이터 조회 실패:', mlFeaturesError)
      }

      // 데이터 통합: focus_sample과 ml_features를 합쳐서 samples로 반환
      const allSamples = [
        ...(samples || []),
        ...(mlFeatures || []).map(ml => ({
          ...ml,
          // focus_sample 테이블과 호환성을 위한 매핑
          score: ml.focus_score,
          ear_value: ml.ear_value,
          eye_status: ml.eye_status,
          head_pose_pitch: ml.head_pose_pitch,
          head_pose_yaw: ml.head_pose_yaw,
          head_pose_roll: ml.head_pose_roll
        }))
      ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

      // 세션 기간의 이벤트 데이터 조회
      const { data: events, error: eventsError } = await supabase
        .from('focus_event')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (eventsError) {
        console.error('이벤트 데이터 조회 실패:', eventsError)
      }

      // 세션 기간의 스냅샷 데이터 조회
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('snapshot')
        .select('*')
        .eq('session_id', sessionId)
        .order('ts', { ascending: true })

      if (snapshotsError) {
        console.error('스냅샷 데이터 조회 실패:', snapshotsError)
      }

      console.log('📊 세션 데이터 조회 결과:', {
        sessionId,
        samplesCount: samples?.length || 0,
        mlFeaturesCount: mlFeatures?.length || 0,
        totalSamplesCount: allSamples.length,
        eventsCount: events?.length || 0,
        snapshotsCount: snapshots?.length || 0
      })

      return {
        session,
        samples: allSamples,
        events: events || [],
        snapshots: snapshots || [],
        mlFeatures: mlFeatures || []
      }
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!sessionId,
  })
} 