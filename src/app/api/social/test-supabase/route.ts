import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: Supabase 연결 테스트
export async function GET() {
  console.log('=== Supabase 연결 테스트 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    console.log('Supabase 서버 연결 성공')
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('인증 결과:', { user: user?.id, authError })
    
    // 간단한 쿼리 테스트
    const { data: testData, error: queryError } = await supabase
      .from('study_rooms')
      .select('count')
      .limit(1)
    
    console.log('쿼리 테스트 결과:', { testData, queryError })
    
    return NextResponse.json({ 
      message: 'Supabase 연결 테스트 완료',
      auth: { user: user?.id, authError },
      query: { testData, queryError },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('=== Supabase 연결 테스트 에러 ===')
    console.error('에러 타입:', typeof error)
    console.error('에러 메시지:', error)
    console.error('에러 스택:', error instanceof Error ? error.stack : '스택 없음')
    
    return NextResponse.json(
      { 
        error: 'Supabase 연결 테스트 실패',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
