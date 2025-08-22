import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, storage_path } = body

    // 요청 검증
    if (!user_id || !storage_path) {
      return NextResponse.json(
        { error: 'user_id와 storage_path가 필요합니다' },
        { status: 400 }
      )
    }

    // 백엔드 API URL 설정 (환경 변수 또는 기본값)
    const backendUrl = process.env.BACKEND_API_URL || 'https://focushabit.site'

    // 백엔드 API로 개인화 모델 학습 요청 전달
    const backendResponse = await fetch(`${backendUrl}/api/v1/models/train-personal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id,
        storage_path
      })
    })

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json()
      console.error('백엔드 API 오류:', errorData)
      return NextResponse.json(
        { error: '백엔드 API 호출 실패' },
        { status: backendResponse.status }
      )
    }

    const result = await backendResponse.json()

    return NextResponse.json({
      message: result.message || 'Training request received. Training will start in the background.'
    })
  } catch (error) {
    console.error('개인화 모델 학습 API 오류:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
