import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// DELETE: 친구 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  console.log('=== 친구 삭제 시작 ===')
  
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('인증 실패:', authError)
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const { friendId } = await params

    console.log('친구 삭제 데이터:', { user_id: user.id, friend_id: friendId })

    // 친구 관계가 존재하는지 확인
    const { data: friendship, error: friendshipError } = await supabase
      .from('user_friends')
      .select('friendship_id')
      .eq('user_id', user.id)
      .eq('friend_id', friendId)
      .eq('status', 'active')
      .single()

    if (friendshipError || !friendship) {
      console.error('친구 관계 확인 실패:', friendshipError)
      return NextResponse.json(
        { error: '존재하지 않는 친구 관계입니다.' },
        { status: 404 }
      )
    }

    // 친구 관계 삭제 (양방향)
    const { error: deleteError } = await supabase
      .from('user_friends')
      .delete()
      .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`)

    if (deleteError) {
      console.error('친구 관계 삭제 실패:', deleteError)
      return NextResponse.json(
        { error: '친구 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('=== 친구 삭제 완료 ===')
    return NextResponse.json({
      success: true,
      message: '친구를 성공적으로 삭제했습니다.'
    })

  } catch (error) {
    console.error('=== 친구 삭제 실패 ===')
    console.error('에러:', error)
    return NextResponse.json(
      { error: '친구 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
