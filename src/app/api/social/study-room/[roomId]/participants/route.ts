import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 스터디룸 참가자 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  console.log('=== 참가자 목록 조회 시작 ===')
  console.log('룸 ID:', params.roomId)
  
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증된 사용자:', user?.id)
    
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 현재 참가 중인 참가자 목록 조회 (left_at이 null인 경우)
    console.log('참가자 쿼리 시작...')
    
    try {
      // 먼저 현재 사용자가 이 룸에 참가했는지 확인
      console.log('현재 사용자 참가 상태 확인...')
      const { data: currentParticipant, error: checkError } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', params.roomId)
        .eq('user_id', user.id)
        .single()

      console.log('현재 사용자 참가 상태:', currentParticipant)
      console.log('참가 상태 확인 에러:', checkError)

      // 참가하지 않았다면 자동으로 참가
      if (!currentParticipant) {
        console.log('현재 사용자가 룸에 참가하지 않음 - 자동 참가')
        const { error: joinError } = await supabase
          .from('room_participants')
          .insert({
            room_id: params.roomId,
            user_id: user.id,
            is_host: false,
            joined_at: new Date().toISOString(),
            is_connected: true,
            last_activity: new Date().toISOString()
          })

        if (joinError) {
          console.error('자동 참가 실패:', joinError)
        } else {
          console.log('자동 참가 성공')
        }
      } else if (currentParticipant.left_at) {
        // 나간 후 다시 참가하는 경우
        console.log('재참가 처리')
        const { error: rejoinError } = await supabase
          .from('room_participants')
          .update({
            left_at: null,
            joined_at: new Date().toISOString(),
            is_connected: true,
            last_activity: new Date().toISOString()
          })
          .eq('room_id', params.roomId)
          .eq('user_id', user.id)

        if (rejoinError) {
          console.error('재참가 실패:', rejoinError)
        } else {
          console.log('재참가 성공')
        }
      } else {
        console.log('이미 참가 중인 상태')
      }

      // 잠시 대기 후 참가자 목록 조회 (트랜잭션 완료 대기)
      await new Promise(resolve => setTimeout(resolve, 100))

      // 참가자 목록 조회 (RLS 문제를 피하기 위해 조인 없이)
      console.log('참가자 목록 조회...')
      const { data: participants, error } = await supabase
        .from('room_participants')
        .select('*')
        .eq('room_id', params.roomId)
        .is('left_at', null)
        .order('joined_at', { ascending: true })

      console.log('참가자 쿼리 결과:', { participants, error })

      if (error) {
        console.error('참가자 목록 조회 실패:', error)
        return NextResponse.json({
          participants: [],
          count: 0
        })
      }

      // 각 참가자의 사용자 정보를 개별적으로 가져오기
      const formattedParticipants = []
      for (const participant of participants || []) {
        try {
          // 사용자 정보 조회 (서버 사이드에서 직접 조회)
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(participant.user_id)
          
          if (userError) {
            console.error(`사용자 ${participant.user_id} 정보 조회 실패:`, userError)
            // 에러가 있어도 기본 정보로 계속 진행
            formattedParticipants.push({
              ...participant,
              user: {
                name: '사용자',
                avatar_url: null
              }
            })
          } else {
            const userName = userData.user?.user_metadata?.name || 
                           userData.user?.email?.split('@')[0] || 
                           '사용자'
            
            formattedParticipants.push({
              ...participant,
              user: {
                name: userName,
                avatar_url: userData.user?.user_metadata?.avatar_url || null
              }
            })
          }
        } catch (userFetchError) {
          console.error(`사용자 ${participant.user_id} 정보 조회 중 에러:`, userFetchError)
          // 에러가 있어도 기본 정보로 계속 진행
          formattedParticipants.push({
            ...participant,
            user: {
              name: '사용자',
              avatar_url: null
            }
          })
        }
      }

      console.log('변환된 참가자 목록:', formattedParticipants)

      const participantCount = formattedParticipants.length
      console.log('참가자 수:', participantCount)

      console.log('=== 참가자 목록 조회 완료 ===')
      return NextResponse.json({
        participants: formattedParticipants,
        count: participantCount
      })
    } catch (innerError) {
      console.error('참가자 처리 중 에러:', innerError)
      return NextResponse.json({
        participants: [],
        count: 0
      })
    }
  } catch (error) {
    console.error('=== 참가자 목록 조회 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '참가자 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
