import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  requireAuth, 
  handleAPIError 
} from '@/lib/api/standardResponse'

// 일주일 트렌드 데이터 생성 함수
async function generateWeeklyTrends(supabase: any, userId: string, friendIds: string[]) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const weekStart = new Date(now.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000)
  weekStart.setHours(0, 0, 0, 0)

  const weekDays = ['월', '화', '수', '목', '금', '토', '일']
  const trends = []

  // 각 요일별 데이터 수집
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    // 사용자 데이터
    const { data: userSessions } = await supabase
      .from('focus_session')
      .select('session_id, started_at, ended_at, focus_score')
      .eq('user_id', userId)
      .gte('started_at', dayStart.toISOString())
      .lt('started_at', dayEnd.toISOString())
      .not('ended_at', 'is', null)

    const userDayStats = calculateDayStats(userSessions || [])

    // 친구들 데이터 (평균)
    const friendsDayStats = await Promise.all(
      friendIds.map(async (friendId) => {
        const { data: friendSessions } = await supabase
          .from('focus_session')
          .select('session_id, started_at, ended_at, focus_score')
          .eq('user_id', friendId)
          .gte('started_at', dayStart.toISOString())
          .lt('started_at', dayEnd.toISOString())
          .not('ended_at', 'is', null)

        return calculateDayStats(friendSessions || [])
      })
    )

    // 친구들 평균 계산
    const avgFriendsFocusTime = friendsDayStats.length > 0 
      ? Math.round(friendsDayStats.reduce((sum, stats) => sum + stats.focus_time, 0) / friendsDayStats.length)
      : 0
    const avgFriendsFocusScore = friendsDayStats.length > 0 
      ? Math.round(friendsDayStats.reduce((sum, stats) => sum + stats.focus_score, 0) / friendsDayStats.length)
      : 0

    trends.push({
      day: weekDays[i],
      date: dayStart.toISOString().split('T')[0],
      user: {
        focus_time: userDayStats.focus_time,
        focus_score: userDayStats.focus_score,
        sessions: userDayStats.sessions
      },
      friends_avg: {
        focus_time: avgFriendsFocusTime,
        focus_score: avgFriendsFocusScore,
        sessions: Math.round(friendsDayStats.reduce((sum, stats) => sum + stats.sessions, 0) / friendsDayStats.length)
      }
    })
  }

  return trends
}

// 일일 통계 계산 함수
function calculateDayStats(sessions: any[]) {
  const totalFocusTime = sessions.reduce((sum, session) => {
    if (session.started_at && session.ended_at) {
      const duration = Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60))
      return sum + duration
    }
    return sum
  }, 0)

  const validScores = sessions.filter(s => s.focus_score !== null && s.focus_score !== undefined)
  const averageFocusScore = validScores.length > 0 
    ? Math.round(validScores.reduce((sum, s) => sum + s.focus_score, 0) / validScores.length)
    : 0

  return {
    focus_time: totalFocusTime,
    focus_score: averageFocusScore,
    sessions: sessions.length
  }
}

// GET: 친구 비교 통계 조회
export async function GET(request: NextRequest) {
  console.log('=== 친구 비교 통계 조회 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 표준 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'weekly' // daily, weekly, monthly
    const friendId = searchParams.get('friend_id') // 특정 친구와 비교
    const limit = parseInt(searchParams.get('limit') || '10')

    console.log('비교 통계 파라미터:', { period, friendId, limit })

    // 기간 설정
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'weekly':
        const dayOfWeek = now.getDay()
        startDate = new Date(now.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    console.log('기간 설정:', { startDate: startDate.toISOString(), endDate: endDate.toISOString() })

    // 1단계: 친구 목록 조회
    const { data: friendships, error: friendshipsError } = await supabase
      .from('user_friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (friendshipsError) {
      console.error('친구 관계 조회 실패:', friendshipsError)
      throw friendshipsError
    }

    if (!friendships || friendships.length === 0) {
      return createSuccessResponse({
        user_stats: null,
        friend_stats: [],
        comparisons: []
      }, '친구가 없습니다.')
    }

    const friendIds = friendships.map(f => f.friend_id)
    
    // 특정 친구와 비교하는 경우 해당 친구만 포함
    let targetFriendIds = friendIds
    if (friendId && friendIds.includes(friendId)) {
      targetFriendIds = [friendId]
    }

    // 2단계: 사용자 본인의 통계 계산
    const { data: userSessions, error: userSessionsError } = await supabase
      .from('focus_session')
      .select('session_id, started_at, ended_at, focus_score, goal_min')
      .eq('user_id', user.id)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .not('ended_at', 'is', null)

    if (userSessionsError) {
      console.error('사용자 세션 조회 실패:', userSessionsError)
      throw userSessionsError
    }

    // 3단계: 친구들의 통계 계산
    const friendsStatsPromises = targetFriendIds.map(async (friendUserId) => {
      const { data: friendSessions, error: friendSessionsError } = await supabase
        .from('focus_session')
        .select('session_id, started_at, ended_at, focus_score, goal_min')
        .eq('user_id', friendUserId)
        .gte('started_at', startDate.toISOString())
        .lte('started_at', endDate.toISOString())
        .not('ended_at', 'is', null)

      if (friendSessionsError) {
        console.error(`친구 ${friendUserId} 세션 조회 실패:`, friendSessionsError)
        return null
      }

      // 친구 프로필 정보
      const { data: friendProfile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, handle')
        .eq('user_id', friendUserId)
        .single()

      if (profileError || !friendProfile) {
        console.error(`친구 ${friendUserId} 프로필 조회 실패:`, profileError)
        return null
      }

      return {
        friend_profile: friendProfile,
        sessions: friendSessions || []
      }
    })

    const friendsStats = await Promise.all(friendsStatsPromises)
    const validFriendsStats = friendsStats.filter(stat => stat !== null)

    // 4단계: 통계 계산 함수
    const calculateStats = (sessions: any[]) => {
      if (!sessions || sessions.length === 0) {
        return {
          total_focus_time: 0,
          average_focus_score: 0,
          total_sessions: 0,
          completed_sessions: 0,
          completion_rate: 0,
          total_goal_time: 0,
          goal_achievement_rate: 0
        }
      }

      const totalFocusTime = sessions.reduce((sum, session) => {
        if (session.started_at && session.ended_at) {
          const duration = Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / (1000 * 60))
          return sum + duration
        }
        return sum
      }, 0)

      const validScores = sessions.filter(s => s.focus_score !== null && s.focus_score !== undefined)
      const averageFocusScore = validScores.length > 0 
        ? Math.round(validScores.reduce((sum, s) => sum + s.focus_score, 0) / validScores.length)
        : 0

      const completedSessions = sessions.filter(s => s.ended_at !== null).length
      const completionRate = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0

      const totalGoalTime = sessions.reduce((sum, s) => sum + (s.goal_min || 25), 0)
      const goalAchievementRate = totalGoalTime > 0 ? Math.round((totalFocusTime / totalGoalTime) * 100) : 0

      return {
        total_focus_time: totalFocusTime,
        average_focus_score: averageFocusScore,
        total_sessions: sessions.length,
        completed_sessions: completedSessions,
        completion_rate: completionRate,
        total_goal_time: totalGoalTime,
        goal_achievement_rate: Math.min(goalAchievementRate, 100)
      }
    }

    // 5단계: 사용자 통계
    const userStats = calculateStats(userSessions || [])

    // 6단계: 친구들 통계
    const friendStats = validFriendsStats.map(friendData => ({
      friend_profile: friendData!.friend_profile,
      stats: calculateStats(friendData!.sessions)
    }))

    // 7단계: 비교 결과 생성
    const comparisons = friendStats.map(friendData => {
      const friendStats = friendData.stats
      const comparison = {
        friend_profile: friendData.friend_profile,
        user_stats: userStats,
        friend_stats: friendStats,
        comparison: {
          focus_time_diff: userStats.total_focus_time - friendStats.total_focus_time,
          focus_score_diff: userStats.average_focus_score - friendStats.average_focus_score,
          sessions_diff: userStats.total_sessions - friendStats.total_sessions,
          completion_rate_diff: userStats.completion_rate - friendStats.completion_rate,
          goal_achievement_diff: userStats.goal_achievement_rate - friendStats.goal_achievement_rate
        }
      }
      return comparison
    })

    // 8단계: 사용자 프로필 정보 조회
    const { data: userProfile, error: userProfileError } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, handle')
      .eq('user_id', user.id)
      .single()

    if (userProfileError || !userProfile) {
      console.error('사용자 프로필 조회 실패:', userProfileError)
      throw userProfileError
    }

    // 9단계: 랭킹 정보 (사용자 포함 전체 랭킹)
    const allUsersForRanking = [
      { profile: userProfile, stats: userStats },
      ...friendStats.map(f => ({ profile: f.friend_profile, stats: f.stats }))
    ]
    const topFriends = allUsersForRanking
      .sort((a, b) => b.stats.total_focus_time - a.stats.total_focus_time)
      .slice(0, limit)
      .map((userData, index) => ({
        rank: index + 1,
        friend_profile: userData.profile,
        stats: userData.stats
      }))

    // 10단계: 사용자 순위 계산
    const allUsersForRank = [
      { profile: { user_id: user.id }, stats: userStats },
      ...friendStats.map(f => ({ profile: f.friend_profile, stats: f.stats }))
    ]
    const sortedUsers = allUsersForRank.sort((a, b) => b.stats.total_focus_time - a.stats.total_focus_time)
    const userRank = sortedUsers.findIndex(u => u.profile.user_id === user.id) + 1

    // 11단계: 일주일 트렌드 데이터 생성 (주간 조회 시에만)
    let weeklyTrends = null
    if (period === 'weekly') {
      weeklyTrends = await generateWeeklyTrends(supabase, user.id, targetFriendIds)
    }

    const response = {
      user_stats: {
        ...userStats,
        user_rank: userRank,
        total_friends: friendStats.length,
        user_id: user.id
      },
      friend_stats: friendStats,
      comparisons: comparisons,
      top_friends: topFriends,
      weekly_trends: weeklyTrends,
      period: period,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString()
    }

    console.log('=== 친구 비교 통계 조회 완료 ===')
    return createSuccessResponse(
      response,
      `${period} 친구 비교 통계를 조회했습니다.`
    )

  } catch (error) {
    return handleAPIError(error, '친구 비교 통계 조회')
  }
}
