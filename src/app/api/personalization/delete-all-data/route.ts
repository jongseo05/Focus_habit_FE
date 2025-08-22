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
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다' },
        { status: 400 }
      )
    }

    // 사용자 ID 확인
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    console.log(`개인화 데이터 삭제 시작 - 사용자: ${userId}`)

    // personalization_data 테이블의 모든 데이터 삭제
    const { error: deleteDataError } = await supabase
      .from('personalization_data')
      .delete()
      .eq('user_id', userId)

    if (deleteDataError) {
      console.error('개인화 데이터 삭제 오류:', deleteDataError)
      throw new Error('개인화 데이터를 삭제할 수 없습니다')
    }

    console.log('개인화 데이터 삭제 완료')

    // 모델 정보는 그대로 유지하되, 수집된 데이터 개수만 0으로 업데이트
    const { data: updatedModelInfo, error: updateError } = await supabase
      .from('user_personalization_models')
      .update({
        focus_samples_collected: 0,
        non_focus_samples_collected: 0,
        completion_percentage: 0,
        training_status: 'idle',
        data_collection_session_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('모델 정보 업데이트 오류:', updateError)
      throw new Error('모델 정보를 업데이트할 수 없습니다')
    }

    console.log('모델 정보 업데이트 완료')

    const responseData = {
      success: true,
      data: {
        message: '개인화 데이터가 모두 삭제되었습니다. 새로운 데이터 수집을 시작할 수 있습니다.',
        modelInfo: updatedModelInfo
      }
    }

    console.log('삭제 완료 응답:', JSON.stringify(responseData, null, 2))
    
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('개인화 데이터 삭제 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '개인화 데이터 삭제 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
