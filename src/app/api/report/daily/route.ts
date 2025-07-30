import { NextRequest, NextResponse } from 'next/server'
import { ReportService } from '@/lib/database/reportService'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  console.log('🔧 API 라우트 시작')
  
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    
    console.log('📅 요청된 날짜:', date)

    if (!date) {
      return NextResponse.json(
        { error: '날짜 파라미터가 필요합니다' },
        { status: 400 }
      )
    }

    // 날짜 형식 검증
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: '잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용해주세요' },
        { status: 400 }
      )
    }

    // 사용자 인증 확인
    console.log('🔐 인증 확인 시작')
    const supabase = await supabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('❌ 인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      )
    }
    
    console.log('✅ 인증 성공, 사용자 ID:', user.id)

    // 실제 데이터 기반 리포트 생성
    console.log('📊 리포트 생성 시작')
    const supabaseClient = await supabaseServer()
    const result = await ReportService.generateDailyReportServer(user.id, date, supabaseClient)

    console.log('📊 리포트 생성 결과:', result)

    if (!result.success) {
      console.log('❌ 리포트 생성 실패:', result.error)
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    console.log('✅ 리포트 생성 성공, 데이터 반환')
    return NextResponse.json(result.data)

  } catch (error) {
    console.error('Daily report API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
} 