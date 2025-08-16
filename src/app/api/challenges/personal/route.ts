import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 개인 챌린지 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, type, target_value, unit, duration_days } = body

    // 필수 필드 검증
    if (!title || !type || !target_value || !unit || !duration_days) {
      return NextResponse.json({ error: '모든 필수 필드를 입력해주세요.' }, { status: 400 })
    }

    // 종료 날짜 계산
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + duration_days)

    // 개인 챌린지 생성
    const { data: newChallenge, error: createError } = await supabase
      .from('personal_challenge')
      .insert({
        user_id: user.id,
        title,
        description: description || '',
        type,
        target_value,
        current_value: 0,
        unit,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString(),
        is_active: true,
        is_completed: false
      })
      .select()
      .single()

    if (createError) {
      console.error('개인 챌린지 생성 실패:', createError)
      return NextResponse.json({ 
        error: '개인 챌린지 생성에 실패했습니다.',
        details: createError.message
      }, { status: 500 })
    }

    return NextResponse.json({ 
      challenge: newChallenge,
      message: '개인 챌린지가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('개인 챌린지 생성 중 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 개인 챌린지 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // personal_challenge 테이블에서 개인 챌린지 조회
    const { data: rawChallenges, error: challengeError } = await supabase
      .from('personal_challenge')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (challengeError) {
      console.error('개인 챌린지 조회 실패:', challengeError)
      return NextResponse.json({ 
        error: '개인 챌린지 조회에 실패했습니다.',
        details: challengeError.message
      }, { status: 500 })
    }

    // id 컬럼을 challenge_id로 매핑하여 타입 호환성 확보
    const challenges = (rawChallenges || []).map(challenge => ({
      ...challenge,
      challenge_id: challenge.id
    }))

    return NextResponse.json({ 
      challenges: challenges || [],
      message: '개인 챌린지 조회가 완료되었습니다.'
    })

  } catch (error) {
    console.error('개인 챌린지 조회 중 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// 개인 챌린지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const challengeId = searchParams.get('id')

    if (!challengeId) {
      return NextResponse.json({ error: '챌린지 ID가 필요합니다.' }, { status: 400 })
    }

    // 먼저 해당 챌린지가 현재 사용자의 것인지 확인
    const { data: existingChallenge, error: checkError } = await supabase
      .from('personal_challenge')
      .select('id, user_id')
      .eq('id', challengeId)
      .eq('user_id', user.id)
      .single()

    if (checkError || !existingChallenge) {
      return NextResponse.json({ error: '챌린지를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 챌린지 삭제
    const { error: deleteError } = await supabase
      .from('personal_challenge')
      .delete()
      .eq('id', challengeId)

    if (deleteError) {
      console.error('개인 챌린지 삭제 실패:', deleteError)
      return NextResponse.json({ 
        error: '개인 챌린지 삭제에 실패했습니다.',
        details: deleteError.message
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: '개인 챌린지가 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('개인 챌린지 삭제 중 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
