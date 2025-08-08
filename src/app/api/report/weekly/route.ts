import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { mockWeeklyReportData } from '@/lib/mockData'

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
    const week = parseInt(searchParams.get('week') || '1')
    
    console.log(`📊 Weekly report request for year: ${year}, week: ${week}, userId: ${user.id}`)

    // Mock 데이터 반환 (개발용)
    console.log('✅ Returning mock weekly report data')
    return NextResponse.json(mockWeeklyReportData)

  } catch (error) {
    console.error('❌ Weekly report API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 