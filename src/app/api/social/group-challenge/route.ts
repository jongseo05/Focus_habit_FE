import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 챌린지 타입별 라벨 반환 함수
function getChallengeTypeLabel(type: string): string {
  switch (type) {
    case 'focus_time':
      return '집중 시간'
    case 'study_sessions':
      return '학습 세션'
    case 'streak_days':
      return '연속 학습'
    case 'focus_score':
      return '집중도 점수'
    case 'custom':
      return '커스텀'
    default:
      return '기타'
  }
}

// 그룹 챌린지 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { room_id, title, description, type, target_value, unit, end_date } = body

    // 필수 필드 검증
    if (!room_id || !title || !description || !type || !target_value || !unit || !end_date) {
      return NextResponse.json({ error: '모든 필수 필드를 입력해주세요.' }, { status: 400 })
    }

    // 룸 존재 확인 및 호스트 권한 확인
    console.log('검색하는 room_id:', room_id)
    
    // 기존 study_rooms 테이블에서 룸 확인
    const { data: room, error: roomError } = await supabase
      .from('study_rooms')
      .select('room_id, host_id')
      .eq('room_id', room_id)
      .single()

    console.log('룸 조회 결과:', { room, roomError })

    if (roomError || !room) {
      console.log('스터디룸을 찾을 수 없음. roomError:', roomError)
      return NextResponse.json({ error: '스터디룸을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 호스트 권한 확인 (기존 study_rooms 테이블의 host_id 사용)
    if (room.host_id !== user.id) {
      return NextResponse.json({ error: '호스트만 그룹 챌린지를 생성할 수 있습니다.' }, { status: 403 })
    }

    // 같은 타입의 활성 챌린지가 있는지 확인
    const { data: existingChallenge, error: existingError } = await supabase
      .from('group_challenge')
      .select('challenge_id')
      .eq('room_id', room_id)
      .eq('type', type)
      .eq('is_active', true)
      .single()

    if (existingChallenge) {
      return NextResponse.json({ error: `이미 활성 ${getChallengeTypeLabel(type)} 챌린지가 있습니다.` }, { status: 409 })
    }

    // 그룹 챌린지 생성
    const { data: newChallenge, error: createError } = await supabase
      .from('group_challenge')
      .insert({
        room_id,
        title,
        description,
        type,
        target_value,
        current_value: 0,
        unit,
        start_date: new Date().toISOString(),
        end_date,
        is_active: true,
        is_completed: false,
        created_by: user.id
      })
      .select()
      .single()

    if (createError) {
      console.error('그룹 챌린지 생성 실패:', createError)
      return NextResponse.json({ error: '그룹 챌린지 생성에 실패했습니다.' }, { status: 500 })
    }

    // Realtime 이벤트 전송
    try {
      supabase
        .channel('group_challenges')
        .send({
          type: 'broadcast',
          event: 'group_challenge_created',
          payload: {
            challenge_id: newChallenge.challenge_id,
            room_id: room_id,
            title: newChallenge.title,
            type: newChallenge.type,
            target_value: newChallenge.target_value,
            created_by: user.id,
            timestamp: new Date().toISOString()
          }
        })
    } catch (realtimeError) {
      console.warn('Realtime 이벤트 전송 실패:', realtimeError)
    }

    return NextResponse.json({ 
      challenge: newChallenge,
      message: '그룹 챌린지가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('그룹 챌린지 생성 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 그룹 챌린지 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const room_id = searchParams.get('room_id')

    if (!room_id) {
      return NextResponse.json({ error: 'room_id가 필요합니다.' }, { status: 400 })
    }

    // 현재 활성 그룹 챌린지들 조회
    const { data: challenges, error: challengeError } = await supabase
      .from('group_challenge')
      .select(`
        *,
        participants:group_challenge_participant(
          participant_id,
          user_id,
          contribution,
          last_contribution_at,
          joined_at
        )
      `)
      .eq('room_id', room_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (challengeError) {
      console.error('그룹 챌린지 조회 실패:', challengeError)
      return NextResponse.json({ error: '그룹 챌린지 조회에 실패했습니다.' }, { status: 500 })
    }

    if (!challenges || challenges.length === 0) {
      return NextResponse.json({ challenges: [], progressMap: {} })
    }

    // 각 챌린지별 진행률 계산
    const progressMap: Record<string, any> = {}
    
    for (const challenge of challenges) {
      // 참가자 정보 가져오기
      const { data: participants, error: participantsError } = await supabase
        .from('group_challenge_participant')
        .select(`
          participant_id,
          user_id,
          contribution,
          last_contribution_at,
          joined_at
        `)
        .eq('challenge_id', challenge.challenge_id)

      if (participantsError) {
        console.error('참가자 정보 조회 실패:', participantsError)
        continue
      }

      // 진행률 계산
      const participantsList = participants || []
      const totalContribution = participantsList.reduce((sum: number, p: any) => sum + (p.contribution || 0), 0)
      const completionPercentage = Math.min((totalContribution / challenge.target_value) * 100, 100)
      
      // 상위 기여자 계산
      const topContributors = participantsList
        .sort((a: any, b: any) => (b.contribution || 0) - (a.contribution || 0))
        .slice(0, 5)

      // 상위 기여자의 사용자 정보 가져오기
      const topContributorUserIds = topContributors.map((p: any) => p.user_id)
      const { data: topContributorUsers, error: usersError } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', topContributorUserIds)

      if (usersError) {
        console.error('상위 기여자 사용자 정보 조회 실패:', usersError)
        // 에러가 발생해도 기본값으로 진행
      }

      // 사용자 정보를 매핑하여 상위 기여자 목록 생성
      const topContributorsWithNames = topContributors.map((p: any) => {
        const userInfo = topContributorUsers?.find((u: any) => u.user_id === p.user_id)
        const userName = userInfo?.display_name || '사용자'
        
        return {
          user_id: p.user_id,
          name: userName,
          contribution: p.contribution || 0,
          avatar_url: userInfo?.avatar_url || null
        }
      })

      progressMap[challenge.challenge_id] = {
        challenge_id: challenge.challenge_id,
        total_participants: participantsList.length,
        active_participants: participantsList.filter((p: any) => p.contribution > 0).length,
        total_contribution: totalContribution,
        average_contribution: participantsList.length > 0 ? totalContribution / participantsList.length : 0,
        completion_percentage: completionPercentage,
        top_contributors: topContributorsWithNames,
        all_participants: participantsList.map((p: any) => ({
          user_id: p.user_id,
          contribution: p.contribution || 0,
          joined_at: p.joined_at
        }))
      }
    }

    return NextResponse.json({ challenges, progressMap })

  } catch (error) {
    console.error('그룹 챌린지 조회 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
