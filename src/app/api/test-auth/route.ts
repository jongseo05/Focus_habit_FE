import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('=== 인증 테스트 ===')
    console.log('사용자:', user)
    console.log('인증 에러:', authError)
    
    if (authError) {
      return NextResponse.json({ 
        error: '인증 실패', 
        details: authError.message,
        code: authError.status 
      }, { status: 401 })
    }
    
    if (!user) {
      return NextResponse.json({ 
        error: '사용자를 찾을 수 없음',
        message: '로그인이 필요합니다.'
      }, { status: 401 })
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email
      },
      message: '인증 성공'
    })
  } catch (error) {
    console.error('인증 테스트 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
