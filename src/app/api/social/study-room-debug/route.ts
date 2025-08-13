import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// POST: 스터디룸 생성 디버깅
export async function POST(request: NextRequest) {
  console.log('=== 스터디룸 생성 디버깅 시작 ===')
  
  try {
    // 1단계: Supabase 연결
    console.log('1단계: Supabase 연결 시도...')
    const supabase = await supabaseServer()
    console.log('✅ Supabase 서버 연결 성공')
    
    // 2단계: 인증 확인
    console.log('2단계: 인증 확인...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증 결과:', { user: user?.id, authError })
    
    if (authError || !user) {
      console.error('❌ 인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.', step: 'auth' },
        { status: 401 }
      )
    }
    console.log('✅ 인증 성공')
    
    // 3단계: 요청 데이터 파싱
    console.log('3단계: 요청 데이터 파싱...')
    const body = await request.json()
    console.log('받은 요청 데이터:', body)
    
    // 4단계: 데이터 검증
    console.log('4단계: 데이터 검증...')
    if (!body.name || !body.name.trim()) {
      console.error('❌ 룸 이름이 없습니다')
      return NextResponse.json(
        { error: '룸 이름이 필요합니다.', step: 'validation' },
        { status: 400 }
      )
    }
    console.log('✅ 데이터 검증 성공')
    
    // 5단계: 스터디룸 생성
    console.log('5단계: 스터디룸 생성...')
    const roomData = {
      host_id: user.id,
      name: body.name,
      description: body.description || '',
      max_participants: body.max_participants || 10,
      session_type: body.session_type || 'study',
      goal_minutes: body.goal_minutes || 60,
      is_active: true
    }
    
    console.log('생성할 룸 데이터:', roomData)
    
    const { data: room, error: createError } = await supabase
      .from('study_rooms')
      .insert(roomData)
      .select()
      .single()
    
    console.log('생성 결과:', { room, createError })
    
    if (createError || !room) {
      console.error('❌ 스터디룸 생성 실패:', createError)
      return NextResponse.json(
        { 
          error: '스터디룸 생성에 실패했습니다.', 
          step: 'create',
          details: createError 
        },
        { status: 500 }
      )
    }
    console.log('✅ 스터디룸 생성 성공:', room.room_id)
    
    // 6단계: 방장 참가자 추가
    console.log('6단계: 방장 참가자 추가...')
    const { error: joinError } = await supabase
      .from('room_participants')
      .insert({
        room_id: room.room_id,
        user_id: user.id,
        is_host: true
      })
    
    if (joinError) {
      console.error('❌ 방장 참가자 추가 실패:', joinError)
      // 참가자 추가 실패해도 룸은 생성되었으므로 경고만
    } else {
      console.log('✅ 방장 참가자 추가 성공')
    }
    
    console.log('=== 스터디룸 생성 디버깅 완료 ===')
    return NextResponse.json({
      success: true,
      room,
      message: '스터디룸 생성 완료'
    })
    
  } catch (error) {
    console.error('=== 스터디룸 생성 디버깅 에러 ===')
    console.error('에러 타입:', typeof error)
    console.error('에러 메시지:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    
    return NextResponse.json(
      { 
        error: '스터디룸 생성 중 예상치 못한 에러가 발생했습니다.',
        step: 'unknown',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
