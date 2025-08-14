import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 대결 초대 응답 (동의/거부)
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { invitation_id, response } = body

    // 필수 필드 검증
    if (!invitation_id || !response || !['accepted', 'rejected'].includes(response)) {
      return NextResponse.json({ error: 'Missing required fields or invalid response' }, { status: 400 })
    }

    // 대결 초대 조회
    const { data: invitation, error: invitationError } = await supabase
      .from('challenge_invitation')
      .select('*')
      .eq('invitation_id', invitation_id)
      .eq('status', 'pending')
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found or expired' }, { status: 404 })
    }

    // 만료 시간 확인
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 })
    }

    // 이미 응답했는지 확인 (challenge_invitation_response 테이블)
    const { data: existingResponse, error: existingError } = await supabase
      .from('challenge_invitation_response')
      .select('response_id')
      .eq('invitation_id', invitation_id)
      .eq('user_id', user.id)
      .single()

    if (existingResponse) {
      return NextResponse.json({ 
        error: 'You have already responded to this invitation',
        details: '이미 이 대결 초대에 응답했습니다.',
        code: 'DUPLICATE_RESPONSE'
      }, { status: 409 })
    }

    // 추가 검증: challenge_invitation 테이블의 responses 필드도 확인
    const currentResponses = invitation.responses || {}
    if (currentResponses[user.id] && currentResponses[user.id] !== 'pending') {
      return NextResponse.json({ 
        error: 'You have already responded to this invitation',
        details: '이미 이 대결 초대에 응답했습니다.',
        code: 'DUPLICATE_RESPONSE_IN_RESPONSES'
      }, { status: 409 })
    }

    // 응답 저장
    const { data: responseData, error: responseError } = await supabase
      .from('challenge_invitation_response')
      .insert({
        invitation_id,
        user_id: user.id,
        response
      })
      .select()
      .single()

    if (responseError) {
      console.error('Challenge invitation response error:', responseError)
      return NextResponse.json({ 
        error: 'Failed to save response', 
        details: responseError.message,
        code: responseError.code 
      }, { status: 500 })
    }

    // 초대 상태 업데이트 (responses 필드)
    currentResponses[user.id] = response

    // 모든 참가자가 응답했는지 확인
    const { data: participants, error: participantsError } = await supabase
      .from('room_participants')
      .select('user_id')
      .eq('room_id', invitation.room_id)
      .is('left_at', null)

    if (participantsError) {
      console.error('Participants fetch error:', participantsError)
    } else {
      const allParticipantIds = participants.map(p => p.user_id)
      const allResponded = allParticipantIds.every(id => 
        currentResponses[id] === 'accepted' || currentResponses[id] === 'rejected'
      )

      let newStatus = invitation.status
      if (allResponded) {
        // 모든 참가자가 동의했는지 확인
        const allAccepted = allParticipantIds.every(id => currentResponses[id] === 'accepted')
        newStatus = allAccepted ? 'accepted' : 'rejected'
      }

      // 초대 상태 업데이트
      const { data: updatedInvitation, error: updateError } = await supabase
        .from('challenge_invitation')
        .update({
          responses: currentResponses,
          status: newStatus
        })
        .eq('invitation_id', invitation_id)
        .select()
        .single()

      if (!updateError && updatedInvitation) {
        // Realtime으로 대결 초대 응답 알림 전송
        try {
          // 두 채널 모두에 전송 (호환성을 위해)
          const channels = [
            'challenge_invitations',
            `social_room:${invitation.room_id}`
          ]
          
          for (const channelName of channels) {
            await supabase
              .channel(channelName)
              .send({
                type: 'broadcast',
                event: 'challenge_invitation_response',
                payload: {
                  invitation_id: invitation_id,
                  user_id: user.id,
                  response: response,
                  responses: currentResponses,
                  status: newStatus,
                  timestamp: new Date().toISOString()
                }
              })
          }
          
          console.log('Realtime 응답 알림 전송 성공:', {
            invitation_id,
            user_id: user.id,
            response,
            status: newStatus
          })
        } catch (realtimeError) {
          console.warn('Realtime 알림 전송 실패:', realtimeError)
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      response: responseData,
      message: `Challenge invitation ${response} successfully` 
    })
  } catch (error) {
    console.error('Challenge invitation response error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
