import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError 
} from '@/lib/api/standardResponse'

interface FriendRanking {
  user_id: string
  display_name: string
  avatar_url?: string
  handle: string
  total_focus_score: number
  total_focus_time: number
  average_focus_score: number
  rank: number
  weekly_streak?: number
}

interface RankingResponse {
  rankings: FriendRanking[]
  total_count: number
  period: 'weekly' | 'monthly'
  period_start: string
  period_end: string
}

// GET: 친구 랭킹 조회
export async function GET(request: NextRequest) {
  console.log('=== 친구 랭킹 조회 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'weekly' // weekly | monthly
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    console.log('랭킹 조회 파라미터:', { period, limit, offset })

    // 기간 설정
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date

    if (period === 'weekly') {
      // 이번 주 월요일부터 현재까지
      const dayOfWeek = now.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      periodStart = new Date(now)
      periodStart.setDate(now.getDate() - daysToMonday)
      periodStart.setHours(0, 0, 0, 0)
      periodEnd = new Date(now)
      periodEnd.setHours(23, 59, 59, 999)
    } else {
      // 이번 달 1일부터 현재까지
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      periodEnd = new Date(now)
      periodEnd.setHours(23, 59, 59, 999)
    }

    // 1단계: 친구 ID 목록 조회
    const { data: friendships, error: friendshipsError } = await supabase
      .from('user_friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (friendshipsError) {
      console.error('친구 관계 조회 실패:', friendshipsError)
      throw friendshipsError
    }

    console.log('랭킹용 친구 관계 조회 결과:', { 
      user_id: user.id, 
      friendships_count: friendships?.length,
      friendships: friendships 
    })

    if (!friendships || friendships.length === 0) {
      const response: RankingResponse = {
        rankings: [],
        total_count: 0,
        period: period as 'weekly' | 'monthly',
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString()
      }
      return createSuccessResponse(response, '친구가 없습니다.')
    }

    const friendIds = friendships.map(f => f.friend_id)
    const allUserIds = [user.id, ...friendIds]
    
    console.log('랭킹 계산용 사용자 ID들:', { 
      friendIds, 
      allUserIds 
    })

    // 2단계: 집중 세션 데이터 조회
    const { data: focusSessions, error: sessionsError } = await supabase
      .from('focus_sessions')
      .select(`
        user_id,
        total_focus_score,
        total_focus_time,
        started_at,
        ended_at
      `)
      .in('user_id', allUserIds)
      .gte('started_at', periodStart.toISOString())
      .lte('started_at', periodEnd.toISOString())
      .not('ended_at', 'is', null)

    if (sessionsError) {
      console.error('집중 세션 조회 실패:', sessionsError)
      throw sessionsError
    }

    // 3단계: 사용자별 집중도 통계 계산
    const userStats = new Map<string, {
      total_focus_score: number
      total_focus_time: number
      session_count: number
    }>()

    // 초기화
    allUserIds.forEach(userId => {
      userStats.set(userId, {
        total_focus_score: 0,
        total_focus_time: 0,
        session_count: 0
      })
    })

    // 통계 계산
    focusSessions?.forEach(session => {
      const stats = userStats.get(session.user_id)
      if (stats) {
        stats.total_focus_score += session.total_focus_score || 0
        stats.total_focus_time += session.total_focus_time || 0
        stats.session_count += 1
      }
    })

    // 4단계: 프로필 정보 조회
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, handle')
      .in('user_id', allUserIds)

    if (profilesError) {
      console.error('프로필 조회 실패:', profilesError)
      throw profilesError
    }

    // 5단계: 랭킹 계산 및 정렬
    const rankings: FriendRanking[] = []
    
    allUserIds.forEach(userId => {
      const stats = userStats.get(userId)
      const profile = profiles?.find(p => p.user_id === userId)
      
      if (stats && profile) {
        const average_focus_score = stats.session_count > 0 
          ? stats.total_focus_score / stats.session_count 
          : 0

        rankings.push({
          user_id: userId,
          display_name: profile.display_name || '알 수 없음',
          avatar_url: profile.avatar_url,
          handle: profile.handle || '',
          total_focus_score: stats.total_focus_score,
          total_focus_time: stats.total_focus_time,
          average_focus_score: Math.round(average_focus_score * 100) / 100,
          rank: 0, // 임시값, 정렬 후 설정
          weekly_streak: undefined // 나중에 구현
        })
      }
    })

    // 총 집중도 점수로 정렬 (내림차순)
    rankings.sort((a, b) => b.total_focus_score - a.total_focus_score)

    // 랭킹 설정
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1
    })

    // 페이지네이션 적용
    const paginatedRankings = rankings.slice(offset, offset + limit)

    const response: RankingResponse = {
      rankings: paginatedRankings,
      total_count: rankings.length,
      period: period as 'weekly' | 'monthly',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString()
    }

    console.log('랭킹 조회 완료:', {
      total_count: response.total_count,
      period: response.period,
      returned_count: paginatedRankings.length
    })

    return createSuccessResponse(response, '랭킹 조회가 완료되었습니다.')

  } catch (error) {
    return handleAPIError(error, '친구 랭킹 조회 중 오류가 발생했습니다.')
  }
}
