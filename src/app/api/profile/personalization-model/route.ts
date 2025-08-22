import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

interface PersonalizationModelInfo {
  focus_samples_collected: number
  non_focus_samples_collected: number
  total_samples_needed: number
  completion_percentage: number
  training_status: 'idle' | 'collecting' | 'training' | 'completed' | 'error'
  last_training_date: string | null
  data_collection_session_id: string | null
  last_updated: string
  created_at: string
  actual_focus_time: number // 실제 수집된 집중 시간 (초)
  actual_non_focus_time: number // 실제 수집된 비집중 시간 (초)
  can_recollect?: boolean // 재수집 가능 여부
  default_goal_minutes?: number // 기본 목표 시간 (분)
}

// GET: 사용자 개인화 모델 조회
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
    const userId = searchParams.get('userId')

    if (!userId) {
      console.error('API 호출 오류: userId 파라미터가 누락되었습니다')
      return NextResponse.json(
        { 
          error: 'userId 파라미터가 필요합니다',
          message: '클라이언트에서 사용자 ID를 전달하지 않았습니다'
        },
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

    // 개인화 모델 정보 조회
    const { data: modelInfo, error: modelError } = await supabase
      .from('user_personalization_models')
      .select('*')
      .eq('user_id', userId)
      .single()

    // 실제 수집된 데이터의 시간 계산 (누적 데이터 사용)
    let actualFocusTime = 0
    let actualNonFocusTime = 0

    // 사용자의 모든 누적 데이터 조회
    const { data: allData, error: dataError } = await supabase
      .from('personalization_data')
      .select('created_at, data_type, session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!dataError && allData) {
      // 실제 수집된 시간 계산 (초 단위)
      allData.forEach(item => {
        if (item.data_type === 'focus') {
          actualFocusTime += 2 // 2초마다 1개 데이터 가정
        } else if (item.data_type === 'nonfocus') {
          actualNonFocusTime += 2
        }
      })
      
      console.log(`실제 수집 시간 - 집중: ${actualFocusTime}초, 비집중: ${actualNonFocusTime}초`)
    }

    if (modelError) {
      // 데이터가 없으면 초기 모델 정보 생성
      if (modelError.code === 'PGRST116') {
        const { data: newModelInfo, error: insertError } = await supabase
          .from('user_personalization_models')
          .insert({
            user_id: userId,
            focus_samples_collected: 0,
            non_focus_samples_collected: 0,
            total_samples_needed: 1000, // 1000개로 증가
            completion_percentage: 0,
            model_version: '1.0.0',
            training_status: 'idle',
            default_goal_minutes: 30 // 기본 목표 시간 30분
          })
          .select()
          .single()

        if (insertError) {
          console.error('초기 모델 정보 생성 오류:', insertError)
          throw new Error('개인화 모델 정보를 생성할 수 없습니다')
        }

        const response: PersonalizationModelInfo = {
          focus_samples_collected: newModelInfo.focus_samples_collected,
          non_focus_samples_collected: newModelInfo.non_focus_samples_collected,
          total_samples_needed: newModelInfo.total_samples_needed,
          completion_percentage: newModelInfo.completion_percentage,
          training_status: newModelInfo.training_status,
          last_training_date: newModelInfo.last_training_date,
          data_collection_session_id: newModelInfo.data_collection_session_id,
          last_updated: newModelInfo.updated_at,
          created_at: newModelInfo.created_at,
          actual_focus_time: actualFocusTime,
          actual_non_focus_time: actualNonFocusTime,
          can_recollect: true // 초기 상태에서는 재수집 가능
        }

        return NextResponse.json({
          success: true,
          data: response
        })
      } else {
        console.error('모델 정보 조회 오류:', modelError)
        throw new Error('개인화 모델 정보를 조회할 수 없습니다')
      }
    }

    // 재수집 가능 여부 확인 (모델이 완료된 상태이거나 오류 상태일 때 재수집 가능)
    const canRecollect = modelInfo.training_status === 'completed' || 
                        modelInfo.training_status === 'error' ||
                        modelInfo.training_status === 'idle'

    const response: PersonalizationModelInfo = {
      focus_samples_collected: modelInfo.focus_samples_collected,
      non_focus_samples_collected: modelInfo.non_focus_samples_collected,
      total_samples_needed: modelInfo.total_samples_needed,
      completion_percentage: modelInfo.completion_percentage,
      training_status: modelInfo.training_status,
      last_training_date: modelInfo.last_training_date,
      data_collection_session_id: modelInfo.data_collection_session_id,
      last_updated: modelInfo.updated_at,
      created_at: modelInfo.created_at,
      actual_focus_time: actualFocusTime,
      actual_non_focus_time: actualNonFocusTime,
      can_recollect: canRecollect // 재수집 가능 여부 추가
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('개인화 모델 정보 조회 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '개인화 모델 정보 조회 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

// 개인화 모델 정보 업데이트
export async function PUT(request: NextRequest) {
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
    const { 
      userId, 
      training_status, 
      last_training_date,
      default_goal_minutes
    } = body

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

    // 개인화 모델 정보 업데이트
    const { data: updatedModel, error: updateError } = await supabase
      .from('user_personalization_models')
      .update({
        training_status: training_status || 'idle',
        last_training_date: last_training_date || null,
        default_goal_minutes: default_goal_minutes || 30,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('모델 정보 업데이트 오류:', updateError)
      throw new Error('개인화 모델 정보를 업데이트할 수 없습니다')
    }

    return NextResponse.json({
      success: true,
      data: updatedModel,
      message: '개인화 모델 정보가 업데이트되었습니다'
    })

  } catch (error) {
    console.error('개인화 모델 정보 업데이트 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '개인화 모델 정보 업데이트 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
