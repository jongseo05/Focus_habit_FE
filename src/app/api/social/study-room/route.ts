import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { CreateStudyRoomData } from '@/types/social'

// GET: 활성 스터디룸 목록 조회
export async function GET() {
  console.log('=== 활성 스터디룸 목록 조회 시작 ===')
  
  try {
    console.log('1. Supabase 서버 연결 시도...')
    const supabase = await supabaseServer()
    console.log('2. Supabase 서버 연결 완료')
    
    // 가장 기본적인 쿼리부터 테스트
    console.log('3. 기본 테이블 존재 확인...')
    const { data: testData, error: testError } = await supabase
      .from('study_rooms')
      .select('count')
      .limit(1)
    
    console.log('4. 기본 테스트 결과:', { testData, testError })
    
    if (testError) {
      console.error('5. 기본 테스트에서 에러 발생:', testError)
      throw testError
    }
    
    // 모든 룸 조회 (간단한 버전)
    console.log('6. 모든 룸 조회 시도...')
    const { data: allRooms, error: allError } = await supabase
      .from('study_rooms')
      .select('*')
      .limit(10)
    
    console.log('7. 모든 룸 조회 결과:', { allRooms, allError })
    
    if (allError) {
      console.error('8. 모든 룸 조회에서 에러 발생:', allError)
      throw allError
    }
    
    console.log('9. === 활성 스터디룸 목록 조회 완료 ===')
    return NextResponse.json(allRooms || [])
    
  } catch (error) {
    console.error('=== 스터디룸 목록 조회 실패 ===')
    console.error('에러 타입:', typeof error)
    console.error('에러 메시지:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    
    // 더 자세한 에러 정보를 클라이언트에 반환
    return NextResponse.json(
      { 
        error: '스터디룸 목록을 불러오는데 실패했습니다.',
        details: error instanceof Error ? error.message : String(error)
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
    
    // 스터디룸 생성
    const { data: room, error: createError } = await supabase
      .from('study_rooms')
      .insert({
        host_id: roomData.host_id,
        name: roomData.name,
        description: roomData.description,
        max_participants: roomData.max_participants,
        session_type: roomData.session_type,
        goal_minutes: roomData.goal_minutes,
        is_active: true
      })
      .select()
      .single()

    console.log('생성 결과:', { room, createError })

    if (createError || !room) {
      console.error('스터디룸 생성 실패:', createError)
      return NextResponse.json(
        { error: '스터디룸 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('스터디룸 생성 성공:', room.room_id)

    // 방장을 참가자로 추가
    const { error: joinError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.room_id,
        user_id: roomData.host_id,
        is_host: true
      })

    if (joinError) {
      console.error('방장 참가자 추가 실패:', joinError)
    } else {
      console.log('방장 참가자 추가 성공')
    }

    console.log('=== 스터디룸 생성 API 완료 ===')
    console.log('반환할 룸 데이터:', room)
    return NextResponse.json(room)
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
