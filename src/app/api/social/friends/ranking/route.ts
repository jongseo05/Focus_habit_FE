import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { 
  FriendRankingResponse, 
  FriendRanking 
} from '@/types/social'

// GET: 친구 랭킹 조회
export async function GET(request: NextRequest) {
  console.log('=== 친구 랭킹 조회 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'weekly'
    const limit = parseInt(searchParams.get('limit') || '20')

    console.log('조회 파라미터:', { period, limit })

    // 기간 유효성 검증
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return NextResponse.json(
        { error: '유효하지 않은 기간입니다.' },
        { status: 400 }
      )
    }

    // 기간별 시작/끝 날짜 계산
    const now = new Date()
    let periodStart: Date
    let periodEnd: Date

    switch (period) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        break
      case 'weekly':
        const dayOfWeek = now.getDay()
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday)
        periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        break
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    }

    console.log('기간 설정:', { periodStart, periodEnd })

    // 현재 사용자와 친구들의 집중도 통계 조회
    const { data: focusStats, error: statsError } = await supabase
      .from('focus_session')
      .select(`
        user_id,
        duration_minutes,
        average_focus_score
      `)
      .gte('started_at', periodStart.toISOString())
      .lt('started_at', periodEnd.toISOString())
      .not('user_id', 'is', null)

    console.log('집중도 통계 조회 결과:', { stats: focusStats?.length, error: statsError })

    if (statsError) {
      console.error('집중도 통계 조회 실패:', statsError)
      return NextResponse.json(
        { error: '집중도 통계를 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 친구 목록 조회
    const { data: friends, error: friendsError } = await supabase
      .from('user_friends')
      .select('friend_id')
      .eq('user_id', user.id)

    console.log('친구 목록 조회 결과:', { friends: friends?.length, error: friendsError })

    if (friendsError) {
      console.error('친구 목록 조회 실패:', friendsError)
      return NextResponse.json(
        { error: '친구 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 친구 ID 목록 생성 (현재 사용자 포함)
    const friendIds = friends?.map(f => f.friend_id) || []
    const allUserIds = [user.id, ...friendIds]

    // 사용자 프로필 정보 조회
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, handle')
      .in('user_id', allUserIds)

    if (profilesError) {
      console.error('프로필 조회 실패:', profilesError)
      return NextResponse.json(
        { error: '사용자 프로필을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 통계 데이터 집계
    const userStats = new Map<string, {
      total_focus_time: number
      average_focus_score: number
      total_sessions: number
    }>()

    // 초기값 설정
    allUserIds.forEach(userId => {
      userStats.set(userId, {
        total_focus_time: 0,
        average_focus_score: 0,
        total_sessions: 0
      })
    })

    // 통계 데이터 집계
    focusStats?.forEach(stat => {
      if (stat.user_id && userStats.has(stat.user_id)) {
        const current = userStats.get(stat.user_id)!
        userStats.set(stat.user_id, {
          total_focus_time: current.total_focus_time + (stat.duration_minutes || 0),
          average_focus_score: current.average_focus_score + (stat.average_focus_score || 0),
          total_sessions: current.total_sessions + 1
        })
      }
    })

    // 평균 계산
    userStats.forEach((stats, userId) => {
      if (stats.total_sessions > 0) {
        stats.average_focus_score = stats.average_focus_score / stats.total_sessions
      }
    })

    // 랭킹 생성 (총 집중 시간 기준)
    const rankings: FriendRanking[] = Array.from(userStats.entries())
      .map(([userId, stats]) => {
        const profile = profiles?.find(p => p.user_id === userId)
        return {
          user_id: userId,
          display_name: profile?.display_name || 'Unknown',
          avatar_url: profile?.avatar_url,
          handle: profile?.handle || '',
          total_focus_time: stats.total_focus_time,
          average_focus_score: Math.round(stats.average_focus_score * 100) / 100,
          rank: 0, // 임시값
          period: period as 'daily' | 'weekly' | 'monthly'
        }
      })
      .sort((a, b) => b.total_focus_time - a.total_focus_time)
      .map((ranking, index) => ({
        ...ranking,
        rank: index + 1
      }))
      .slice(0, limit)

    // 현재 사용자의 랭킹 찾기
    const userRanking = rankings.find(r => r.user_id === user.id)

    const response: FriendRankingResponse = {
      rankings,
      user_rank: userRanking?.rank,
      period
    }

    console.log('=== 친구 랭킹 조회 완료 ===')
    return NextResponse.json(response)

  } catch (error) {
    console.error('=== 친구 랭킹 조회 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '친구 랭킹을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
