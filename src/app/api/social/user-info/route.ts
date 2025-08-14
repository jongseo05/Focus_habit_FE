import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// 사용자 정보 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 사용자 정보 조회
    const { data: userInfo, error } = await supabase
      .from('auth.users')
      .select('id, name, avatar_url')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('User info fetch error:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch user info', 
        details: error.message,
        code: error.code 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      user: userInfo,
      message: 'User info fetched successfully' 
    })
  } catch (error) {
    console.error('User info fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
