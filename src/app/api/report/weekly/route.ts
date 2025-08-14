import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { ReportService } from '@/lib/database/reportService'

export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Weekly report authentication failed:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const week = parseInt(searchParams.get('week') || getCurrentWeek().toString())
    
    console.log(`📊 Weekly report request for year: ${year}, week: ${week}, userId: ${user.id}`)

    // 실제 데이터베이스에서 주간 리포트 생성
    const result = await ReportService.generateWeeklyReportServer(
      user.id,
      year,
      week,
      supabase
    )

    if (!result.success) {
      console.error('❌ Weekly report generation failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Failed to generate weekly report' },
        { status: 500 }
      )
    }

    console.log('✅ Weekly report generated successfully')
    return NextResponse.json(result.data)

  } catch (error) {
    console.error('❌ Weekly report API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * 현재 주차 계산 헬퍼 함수
 */
function getCurrentWeek(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + start.getDay() + 1) / 7)
} 