import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 진행 상황 업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { challenge_id, progress_value } = body

    if (!challenge_id || progress_value === undefined) {
      return NextResponse.json({ error: 'Challenge ID and progress value are required' }, { status: 400 })
    }

    // 챌린지 존재 여부 및 활성 상태 확인
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenges')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('is_active', true)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found or inactive' }, { status: 404 })
    }

    // 참가자 확인
    const { data: participant, error: participantError } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge_id)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Not a participant of this challenge' }, { status: 403 })
    }

    // 진행 상황 업데이트
    const { error: updateError } = await supabase
      .from('challenge_participants')
      .update({ 
        current_progress: progress_value,
        updated_at: new Date().toISOString()
      })
      .eq('participant_id', participant.participant_id)

    if (updateError) {
      console.error('진행 상황 업데이트 실패:', updateError)
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 })
    }

    // 그룹 전체 진행 상황 계산
    const { data: allParticipants, error: fetchError } = await supabase
      .from('challenge_participants')
      .select('current_progress')
      .eq('challenge_id', challenge_id)

    if (fetchError) {
      console.error('참가자 목록 조회 실패:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    // 목표 타입에 따른 진행 상황 계산
    let totalProgress = 0
    let averageProgress = 0
    let progressPercentage = 0

    if (allParticipants && allParticipants.length > 0) {
      const totalParticipants = allParticipants.length
      
      if (challenge.goal_type === 'total_hours') {
        totalProgress = allParticipants.reduce((sum, p) => sum + (p.current_progress || 0), 0)
        progressPercentage = Math.min((totalProgress / challenge.goal_value) * 100, 100)
      } else if (challenge.goal_type === 'total_sessions') {
        totalProgress = allParticipants.reduce((sum, p) => sum + (p.current_progress || 0), 0)
        progressPercentage = Math.min((totalProgress / challenge.goal_value) * 100, 100)
      } else if (challenge.goal_type === 'average_focus_score') {
        totalProgress = allParticipants.reduce((sum, p) => sum + (p.current_progress || 0), 0)
        averageProgress = totalProgress / totalParticipants
        progressPercentage = Math.min((averageProgress / challenge.goal_value) * 100, 100)
      }
    }

    const groupProgress = {
      total: totalProgress,
      average: averageProgress,
      participants_count: allParticipants?.length || 0,
      goal_value: challenge.goal_value,
      progress_percentage: progressPercentage
    }

    return NextResponse.json({ 
      success: true, 
      group_progress: groupProgress,
      message: 'Progress updated successfully'
    })

  } catch (error) {
    console.error('진행 상황 업데이트 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: 챌린지 진행 상황 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const challenge_id = searchParams.get('challenge_id')

    if (!challenge_id) {
      console.error('challenge_id 파라미터 누락')
      return NextResponse.json({ error: 'Challenge ID is required' }, { status: 400 })
    }

    console.log('챌린지 진행 상황 조회 시작:', { challenge_id, user_id: user.id })

    // 챌린지 정보 조회
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenges')
      .select('*')
      .eq('challenge_id', challenge_id)
      .single()

    if (challengeError) {
      console.error('챌린지 조회 실패:', challengeError)
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    if (!challenge) {
      console.error('챌린지를 찾을 수 없음:', challenge_id)
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    console.log('챌린지 정보 조회 성공:', challenge)

    // 참가자들의 진행 상황 조회 (조인 없이)
    const { data: participants, error: participantsError } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge_id)

    if (participantsError) {
      console.error('참가자 진행 상황 조회 실패:', participantsError)
      return NextResponse.json({ error: 'Failed to fetch participants progress' }, { status: 500 })
    }

    console.log('참가자 정보 조회 성공:', { count: participants?.length || 0 })

    // 목표 타입에 따른 진행 상황 계산
    let totalProgress = 0
    let averageProgress = 0
    let progressPercentage = 0
    let userProgress = 0

    if (participants && participants.length > 0) {
      const totalParticipants = participants.length
      
      if (challenge.goal_type === 'total_hours') {
        totalProgress = participants.reduce((sum, p) => sum + (p.current_progress || 0), 0)
        progressPercentage = Math.min((totalProgress / challenge.goal_value) * 100, 100)
      } else if (challenge.goal_type === 'total_sessions') {
        totalProgress = participants.reduce((sum, p) => sum + (p.current_progress || 0), 0)
        progressPercentage = Math.min((totalProgress / challenge.goal_value) * 100, 100)
      } else if (challenge.goal_type === 'average_focus_score') {
        totalProgress = participants.reduce((sum, p) => sum + (p.current_progress || 0), 0)
        averageProgress = totalProgress / totalParticipants
        progressPercentage = Math.min((averageProgress / challenge.goal_value) * 100, 100)
      }

      // 현재 사용자의 진행 상황 찾기
      const currentUserParticipant = participants.find(p => p.user_id === user.id)
      if (currentUserParticipant) {
        userProgress = currentUserParticipant.current_progress || 0
      }

      console.log('진행 상황 계산 완료:', {
        totalProgress,
        averageProgress,
        progressPercentage,
        userProgress,
        totalParticipants
      })
    }

    const challengeProgress = {
      challenge_id,
      goal_type: challenge.goal_type,
      goal_value: challenge.goal_value,
      total_progress: totalProgress,
      average_progress: averageProgress,
      progress_percentage: progressPercentage,
      user_progress: userProgress,
      participants_count: participants?.length || 0,
      participants: participants?.map(p => ({
        user_id: p.user_id,
        name: 'Unknown', // 사용자 이름은 별도로 조회 필요
        avatar_url: undefined, // 아바타는 별도로 조회 필요
        current_progress: p.current_progress || 0,
        joined_at: p.joined_at
      })) || []
    }

    console.log('응답 데이터 준비 완료:', challengeProgress)

    return NextResponse.json({ 
      success: true, 
      challenge_progress: challengeProgress
    })

  } catch (error) {
    console.error('진행 상황 조회 오류:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
