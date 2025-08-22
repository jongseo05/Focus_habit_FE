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
    const { sessionId, action } = body

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'sessionId와 action이 필요합니다' },
        { status: 400 }
      )
    }

    // 사용자 ID 확인
    if (user.id !== body.userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    console.log(`개인화 세션 정리 요청 - 사용자: ${user.id}, 세션: ${sessionId}, 액션: ${action}`)

    if (action === 'delete') {
      // 중단된 세션의 모든 데이터 삭제
      const { error: deleteError } = await supabase
        .from('personalization_data')
        .delete()
        .eq('user_id', user.id)
        .eq('session_id', sessionId)

      if (deleteError) {
        console.error('데이터 삭제 오류:', deleteError)
        throw new Error('중단된 세션 데이터를 삭제할 수 없습니다')
      }

      console.log(`세션 ${sessionId}의 데이터 삭제 완료`)

      return NextResponse.json({
        success: true,
        message: '중단된 세션 데이터가 삭제되었습니다',
        data: {
          sessionId,
          action: 'deleted'
        }
      })

    } else if (action === 'mark_incomplete') {
      // 세션을 불완전으로 표시 (나중에 정리할 수 있도록)
      const { error: updateError } = await supabase
        .from('personalization_data')
        .update({ 
          session_id: `${sessionId}_incomplete_${Date.now()}` 
        })
        .eq('user_id', user.id)
        .eq('session_id', sessionId)

      if (updateError) {
        console.error('세션 마킹 오류:', updateError)
        throw new Error('세션을 불완전으로 표시할 수 없습니다')
      }

      console.log(`세션 ${sessionId}를 불완전으로 표시 완료`)

      return NextResponse.json({
        success: true,
        message: '세션이 불완전으로 표시되었습니다',
        data: {
          sessionId,
          action: 'marked_incomplete'
        }
      })

    } else {
      return NextResponse.json(
        { error: '유효하지 않은 액션입니다. delete 또는 mark_incomplete를 사용하세요' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('개인화 세션 정리 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '세션 정리 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// GET 요청으로 사용자의 불완전한 세션 목록 조회
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const includeIncomplete = searchParams.get('include_incomplete') === 'true'

    // 사용자의 개인화 데이터 세션 목록 조회
    let query = supabase
      .from('personalization_data')
      .select('session_id, data_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (includeIncomplete) {
      // 불완전한 세션도 포함
      query = query.or(`session_id.like.%_incomplete_%`)
    }

    const { data: sessions, error: queryError } = await query

    if (queryError) {
      console.error('세션 조회 오류:', queryError)
      throw new Error('세션 목록을 조회할 수 없습니다')
    }

    // 세션별로 데이터 개수 집계
    const sessionStats = sessions?.reduce((acc, item) => {
      const sessionId = item.session_id
      if (!acc[sessionId]) {
        acc[sessionId] = {
          sessionId,
          focusCount: 0,
          nonFocusCount: 0,
          totalCount: 0,
          createdAt: item.created_at,
          isIncomplete: sessionId.includes('_incomplete_')
        }
      }
      
      if (item.data_type === 'focus') {
        acc[sessionId].focusCount++
      } else if (item.data_type === 'nonfocus') {
        acc[sessionId].nonFocusCount++
      }
      acc[sessionId].totalCount++
      
      return acc
    }, {} as Record<string, any>) || {}

    const incompleteSessions = Object.values(sessionStats).filter(
      (session: any) => session.isIncomplete || session.totalCount < 50
    )

    return NextResponse.json({
      success: true,
      data: {
        incompleteSessions,
        totalIncomplete: incompleteSessions.length
      }
    })

  } catch (error) {
    console.error('불완전한 세션 조회 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '세션 조회 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
