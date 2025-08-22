import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다' },
        { status: 400 }
      )
    }

    // 사용자 ID 확인
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    console.log(`데이터 재수집 시작 - 사용자: ${userId}`)

    // 새로운 세션 ID 생성
    const newSessionId = `recollect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // 개인화 모델 정보 업데이트 - 새로운 세션으로 데이터 수집 상태로 변경
    const { data: updatedModel, error: updateError } = await supabase
      .from('user_personalization_models')
      .upsert({
        user_id: userId,
        data_collection_session_id: newSessionId,
        training_status: 'collecting',
        last_updated: new Date().toISOString()
      })
      .select()
      .single()

    if (updateError) {
      console.error('모델 정보 업데이트 오류:', updateError)
      throw new Error('데이터 재수집을 시작할 수 없습니다')
    }

    console.log(`데이터 재수집 세션 시작: ${newSessionId}`)

    return NextResponse.json({
      success: true,
      data: {
        sessionId: newSessionId,
        message: '데이터 재수집이 시작되었습니다. 새로운 데이터를 수집할 수 있습니다.',
        training_status: 'collecting'
      }
    })

  } catch (error) {
    console.error('데이터 재수집 시작 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '데이터 재수집 시작 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
