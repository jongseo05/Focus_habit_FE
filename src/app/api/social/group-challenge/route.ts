import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 그룹 챌린지 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, goal_type, goal_value, duration_days } = body

    // 필수 필드 검증
    if (!name || !goal_type || !goal_value || !duration_days) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 목표 타입 검증
    if (!['total_hours', 'total_sessions', 'average_focus_score'].includes(goal_type)) {
      return NextResponse.json({ error: 'Invalid goal type' }, { status: 400 })
    }

    // 기간 검증
    if (duration_days < 1 || duration_days > 30) {
      return NextResponse.json({ error: 'Duration must be between 1 and 30 days' }, { status: 400 })
    }

    // 종료 날짜 계산
    const ends_at = new Date()
    ends_at.setDate(ends_at.getDate() + duration_days)

    // 챌린지 생성
    const { data: challenge, error: createError } = await supabase
      .from('group_challenges')
      .insert({
        name,
        description,
        goal_type,
        goal_value,
        duration_days,
        ends_at: ends_at.toISOString(),
        created_by: user.id
      })
      .select()
      .single()

    if (createError) {
      console.error('챌린지 생성 실패:', createError)
      return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 })
    }

    // 생성자를 참가자로 추가
    const { error: joinError } = await supabase
      .from('challenge_participants')
      .insert({
        challenge_id: challenge.challenge_id,
        user_id: user.id
      })

    if (joinError) {
      console.error('참가자 추가 실패:', joinError)
    }

    return NextResponse.json({ 
      success: true, 
      challenge 
    })

  } catch (error) {
    console.error('챌린지 생성 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: 활성 챌린지 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'all', 'my', 'available'

    let query = supabase
      .from('group_challenges')
      .select(`
        *,
        challenge_participants (
          user_id,
          current_progress,
          joined_at
        )
      `)
      .eq('is_active', true)

    // 타입별 필터링
    if (type === 'my') {
      // 내가 참가한 챌린지
      const { data: myChallenges } = await supabase
        .from('challenge_participants')
        .select('challenge_id')
        .eq('user_id', user.id)
      
      if (myChallenges && myChallenges.length > 0) {
        const challengeIds = myChallenges.map(cp => cp.challenge_id)
        query = query.in('challenge_id', challengeIds)
      } else {
        // 참가한 챌린지가 없으면 빈 배열 반환
        return NextResponse.json({ 
          success: true, 
          challenges: [] 
        })
      }
    } else if (type === 'available') {
      // 참가 가능한 챌린지 (내가 참가하지 않은 것)
      try {
        const { data: myChallenges } = await supabase
          .from('challenge_participants')
          .select('challenge_id')
          .eq('user_id', user.id)
        
        if (myChallenges && myChallenges.length > 0) {
          const challengeIds = myChallenges.map(cp => cp.challenge_id)
          // 각 ID에 대해 not.eq 조건을 추가
          challengeIds.forEach(id => {
            query = query.neq('challenge_id', id)
          })
        }
        // 참가한 챌린지가 없으면 모든 챌린지 표시
      } catch (error) {
        console.error('참가 가능한 챌린지 조회 실패:', error)
        // 에러 발생 시 모든 챌린지 표시
      }
    }

    const { data: challenges, error: fetchError } = await query
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('챌린지 조회 실패:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      challenges 
    })

  } catch (error) {
    console.error('챌린지 조회 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
