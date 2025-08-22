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
    const { user_id, file_name } = body

    // 요청 검증
    if (!user_id || !file_name) {
      return NextResponse.json(
        { error: 'user_id와 file_name이 필요합니다' },
        { status: 400 }
      )
    }

    // 백엔드 API URL 설정 (환경 변수 또는 기본값)
    const backendUrl = process.env.BACKEND_API_URL || 'https://focushabit.site'

    // 백엔드 API에서 Presigned URL 요청
    const backendResponse = await fetch(`${backendUrl}/api/v1/storage/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id,
        file_name
      })
    })

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json()
      console.error('백엔드 Presigned URL API 오류:', errorData)
      return NextResponse.json(
        { error: 'Presigned URL 요청 실패' },
        { status: backendResponse.status }
      )
    }

    const result = await backendResponse.json()

    return NextResponse.json({
      presigned_url: result.presigned_url,
      storage_path: result.storage_path
    })
  } catch (error) {
    console.error('Presigned URL API 오류:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
