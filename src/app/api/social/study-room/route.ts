import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { CreateStudyRoomData } from '@/types/social'

// GET: 활성 스터디룸 목록 조회
export async function GET(request: NextRequest) {
  console.log('=== 활성 스터디룸 목록 조회 시작 ===')
  
  try {
    console.log('1. Supabase 서버 연결 시도...')
    const supabase = await supabaseServer()
    console.log('2. Supabase 서버 연결 완료')
    
    // 쿼리 파라미터 확인
    const { searchParams } = new URL(request.url)
    const withChallenges = searchParams.get('withChallenges') === 'true'
    
    console.log('3. 쿼리 파라미터:', { withChallenges })
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }
    
    console.log('4. 인증된 사용자:', user.id)
    
    // 가장 기본적인 쿼리부터 테스트
    console.log('5. 기본 테이블 존재 확인...')
    const { data: testData, error: testError } = await supabase
      .from('study_rooms')
      .select('count')
      .limit(1)
    
    console.log('6. 기본 테스트 결과:', { testData, testError })
    
    if (testError) {
      console.error('7. 기본 테스트에서 에러 발생:', testError)
      throw testError
    }
    
    // 테이블에 데이터가 있는지 확인
    console.log('7.5. 테이블 데이터 확인...')
    const { data: allRooms, error: allError } = await supabase
      .from('study_rooms')
      .select('*')
      .limit(5)
    
    console.log('7.6. 모든 룸 데이터:', { allRooms, allError })
    
    // 활성 스터디룸 조회 (챌린지 정보 포함 여부에 따라)
    console.log('8. 활성 스터디룸 조회 시도...')
    
    if (withChallenges) {
      // 챌린지 정보를 포함하여 조회 (사용자가 참여 중인 스터디룸만)
      console.log('8.1. 사용자 참여 중인 스터디룸 조회 시도...')
      
      try {
        // 1단계: 사용자가 참여 중인 룸 ID 조회
        const { data: userRoomIds, error: userRoomIdsError } = await supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', user.id)
        
        if (userRoomIdsError) {
          console.error('8.2. 사용자 참여 룸 ID 조회에서 에러 발생:', userRoomIdsError)
          throw userRoomIdsError
        }
        
        if (!userRoomIds || userRoomIds.length === 0) {
          console.log('8.3. 사용자가 참여 중인 룸이 없음')
          return NextResponse.json([])
        }
        
        const roomIds = userRoomIds.map(r => r.room_id)
        console.log('8.4. 사용자 참여 룸 ID들:', roomIds)
        
        // 2단계: 해당 룸들의 상세 정보 조회
        const { data: userRooms, error: userRoomsError } = await supabase
          .from('study_rooms')
          .select('*')
          .in('room_id', roomIds)
          .eq('is_active', true)
        
        if (userRoomsError) {
          console.error('8.5. 사용자 참여 스터디룸 조회에서 에러 발생:', userRoomsError)
          throw userRoomsError
        }
        
        console.log('8.6. 사용자 참여 스터디룸 조회 성공:', userRooms?.length)
        
        // 챌린지 정보가 있는 경우에만 추가 조회
        const roomsWithChallenges = await Promise.all(
          (userRooms || []).map(async (room) => {
            try {
              // 스터디룸에서 생성된 챌린지 조회
              const { data: challenges, error: challengesError } = await supabase
                .from('group_challenge')
                .select('challenge_id, title, description, type, challenge_type, target_value, current_value, unit, start_date, end_date, is_active, is_completed')
                .eq('room_id', room.room_id)
                .eq('challenge_type', 'team') // 팀 챌린지만 조회
                .eq('is_active', true)
              
              console.log(`스터디룸 ${room.room_id}의 챌린지 조회 결과:`, { challenges, challengesError })
              
              if (challengesError) {
                console.error(`스터디룸 ${room.room_id}의 챌린지 조회 실패:`, challengesError)
                return { ...room, linked_challenge: null }
              }
              
              // 가장 최근의 활성 챌린지를 linked_challenge로 설정
              if (challenges && challenges.length > 0) {
                const latestChallenge = challenges.sort((a, b) => 
                  new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime()
                )[0]
                console.log(`스터디룸 ${room.room_id}의 최신 챌린지:`, latestChallenge)
                return { ...room, linked_challenge: latestChallenge }
              }
              
              return { ...room, linked_challenge: null }
            } catch (error) {
              console.error(`스터디룸 ${room.room_id}의 챌린지 조회 중 오류:`, error)
              return { ...room, linked_challenge: null }
            }
          })
        )
        
        console.log('9. 챌린지 정보 포함 조회 완료:', roomsWithChallenges.length)
        return NextResponse.json(roomsWithChallenges)
        
      } catch (challengeError) {
        console.error('9.1. 챌린지 정보 포함 조회 실패, 기본 조회로 대체:', challengeError)
        // 챌린지 정보 조회에 실패하면 기본 조회로 대체
        const { data: userRoomIds, error: userRoomIdsError } = await supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', user.id)
        
        if (userRoomIdsError) {
          throw userRoomIdsError
        }
        
        if (!userRoomIds || userRoomIds.length === 0) {
          return NextResponse.json([])
        }
        
        const roomIds = userRoomIds.map(r => r.room_id)
        const { data: userRooms, error: userRoomsError } = await supabase
          .from('study_rooms')
          .select('*')
          .in('room_id', roomIds)
          .eq('is_active', true)
        
        if (userRoomsError) {
          throw userRoomsError
        }
        
        return NextResponse.json(userRooms || [])
      }
    } else {
      // 기본 조회 (모든 활성 스터디룸)
      const { data: activeRooms, error: activeError } = await supabase
        .from('study_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)
      
      console.log('9. 활성 스터디룸 조회 결과:', { activeRooms, activeError })
      
      if (activeError) {
        console.error('10. 활성 스터디룸 조회에서 에러 발생:', activeError)
        throw activeError
      }
      
      console.log('11. === 활성 스터디룸 목록 조회 완료 ===')
      return NextResponse.json(activeRooms || [])
    }
    
  } catch (error) {
    console.error('=== 스터디룸 목록 조회 실패 ===')
    console.error('에러 타입:', typeof error)
    console.error('에러 메시지:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    
    // 더 자세한 에러 정보를 클라이언트에 반환
    return NextResponse.json(
      { 
        error: '스터디룸 목록을 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : JSON.stringify(error),
        errorType: typeof error,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// POST: 새 스터디룸 생성
export async function POST(request: NextRequest) {
  console.log('=== 스터디룸 생성 API 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    console.log('Supabase 서버 연결 완료')
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증 결과:', { user: user?.id, authError })
    
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    console.log('받은 요청 데이터:', body)
    
    const roomData: CreateStudyRoomData = {
      host_id: user.id,
      name: body.name,
      description: body.description,
      max_participants: body.max_participants || 10,
      session_type: body.session_type || 'study',
      goal_minutes: body.goal_minutes
    }

    console.log('생성할 룸 데이터:', roomData)
    
    // 🔄 트랜잭션으로 스터디룸 생성 + 호스트 참가 (원자적 처리)
    try {
      const { data: room, error: transactionError } = await supabase
        .rpc('create_study_room_with_host', {
          p_host_id: roomData.host_id,
          p_name: roomData.name,
          p_description: roomData.description,
          p_max_participants: roomData.max_participants,
          p_session_type: roomData.session_type,
          p_goal_minutes: roomData.goal_minutes
        })

      if (transactionError) {
        console.error('트랜잭션 스터디룸 생성 실패:', transactionError)
        
        // RPC 함수가 없으면 폴백으로 기존 방식 사용
        if (transactionError.code === '42883') {
          console.log('🔄 RPC 함수 없음, 기존 방식으로 폴백')
          return await createStudyRoomFallback(supabase, roomData)
        }
        
        return NextResponse.json(
          { error: '스터디룸 생성에 실패했습니다.' },
          { status: 500 }
        )
      }

      const roomData_result = Array.isArray(room) ? room[0] : room
      console.log('트랜잭션으로 스터디룸 생성 성공:', roomData_result?.room_id)
      
      return NextResponse.json(roomData_result)
      
    } catch (error) {
      console.error('❌ 트랜잭션 처리 중 오류:', error)
      // 폴백: 기존 방식으로 룸 생성
      return await createStudyRoomFallback(supabase, roomData)
    }

  } catch (error) {
    console.error('=== 스터디룸 생성 API 에러 ===')
    console.error('에러 타입:', typeof error)
    console.error('에러 메시지:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    return NextResponse.json(
      { error: '스터디룸 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 폴백 함수: RPC 함수가 없을 때 사용하는 기존 방식
async function createStudyRoomFallback(supabase: any, roomData: any) {
  console.log('🔄 폴백 모드로 스터디룸 생성 중...')
  
  try {
    // 1. 스터디룸 생성
    const { data: room, error: createError } = await supabase
      .from('study_rooms')
      .insert({
        host_id: roomData.host_id,
        name: roomData.name,
        description: roomData.description,
        max_participants: roomData.max_participants,
        session_type: roomData.session_type,
        goal_minutes: roomData.goal_minutes,
        current_participants: 1, // 호스트가 첫 참가자
        is_active: true
      })
      .select()
      .single()

    if (createError || !room) {
      console.error('폴백 스터디룸 생성 실패:', createError)
      return NextResponse.json(
        { error: '스터디룸 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 2. 방장을 참가자로 추가
    const { error: joinError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.room_id,
        user_id: roomData.host_id,
        is_host: true,
        is_connected: true,
        joined_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      })

    if (joinError && !joinError.message?.includes('duplicate')) {
      console.error('폴백 방장 참가자 추가 실패:', joinError)
      // 룸은 생성되었으므로 경고만 로그
    }

    console.log('✅ 폴백으로 스터디룸 생성 성공:', room.room_id)
    return NextResponse.json(room)
    
  } catch (error) {
    console.error('❌ 폴백 스터디룸 생성 실패:', error)
    return NextResponse.json(
      { error: '스터디룸 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
