import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import JSZip from 'jszip'

// 개인화 데이터 타입 정의 (웹소켓 프레임 분석 기반)
interface PersonalizationDataPoint {
  id: string
  user_id: string
  session_id: string
  data_type: 'focus' | 'nonfocus'
  timestamp: string
  eye_status: number | string
  ear_value: number
  head_pose_pitch: number
  head_pose_yaw: number
  head_pose_roll: number
  created_at: string
}

// Presigned URL 요청 함수
const getPresignedUrl = async (userId: string): Promise<{ presigned_url: string; storage_path: string }> => {
  const baseUrl = process.env.EXTERNAL_API_BASE_URL || 'https://focushabit.site'
  
  const response = await fetch(`${baseUrl}/api/v1/storage/presigned-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      file_name: `${userId}_data.zip`
    })
  })
  
  if (!response.ok) {
    throw new Error('Presigned URL 생성에 실패했습니다')
  }
  
  return await response.json()
}

// 파일 업로드 함수
const uploadFile = async (presignedUrl: string, file: Buffer): Promise<void> => {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': 'application/zip'
    }
  })
  
  if (!response.ok) {
    throw new Error('파일 업로드에 실패했습니다')
  }
}

// 모델 학습 시작 요청 함수
const startTraining = async (userId: string, storagePath: string): Promise<{ message: string }> => {
  const baseUrl = process.env.EXTERNAL_API_BASE_URL || 'https://focushabit.site'
  
  const response = await fetch(`${baseUrl}/api/v1/models/train-personal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_id: userId,
      storage_path: storagePath
    })
  })
  
  if (!response.ok) {
    throw new Error('모델 학습 시작에 실패했습니다')
  }
  
  return await response.json()
}

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
    const { userId, sessionId } = body

    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'userId와 sessionId가 필요합니다' },
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

    console.log(`개인화 데이터 처리 시작 - 사용자: ${userId}, 세션: ${sessionId}`)

    // 1. DB에서 해당 세션의 데이터만 조회
    console.log(`사용자 ${userId}의 세션 ${sessionId} 데이터 조회 시작`)
    
    const { data: collectedData, error: dataError } = await supabase
      .from('personalization_data')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (dataError) {
      console.error('데이터 조회 오류:', dataError)
      throw new Error('수집된 데이터를 조회할 수 없습니다')
    }

    if (!collectedData || collectedData.length === 0) {
      return NextResponse.json(
        { error: '수집된 데이터가 없습니다' },
        { status: 404 }
      )
    }

    console.log(`DB에서 조회된 총 데이터: ${collectedData.length}개 (세션 ${sessionId})`)
    
    // 디버깅: 실제 데이터 샘플 확인
    console.log('데이터 샘플:', collectedData.slice(0, 3).map(item => ({
      id: item.id,
      data_type: item.data_type,
      timestamp: item.timestamp,
      eye_status: item.eye_status
    })))
    
    // 디버깅: data_type별 개수 확인
    const focusCount = collectedData.filter(item => item.data_type === 'focus').length
    const nonFocusCount = collectedData.filter(item => item.data_type === 'nonfocus').length
    console.log(`데이터 타입별 개수 - focus: ${focusCount}개, nonfocus: ${nonFocusCount}개`)
    
    // 디버깅: 모든 데이터의 data_type 확인
    console.log('모든 데이터의 data_type:', collectedData.map(item => item.data_type))

    // 2. 데이터를 focus/nonfocus로 분리
    const focusData: PersonalizationDataPoint[] = []
    const nonFocusData: PersonalizationDataPoint[] = []

    // 해당 세션의 데이터를 타입별로 분리
    collectedData.forEach((item: any) => {
      const dataPoint: PersonalizationDataPoint = {
        id: item.id,
        user_id: item.user_id,
        session_id: item.session_id,
        data_type: item.data_type,
        timestamp: item.timestamp,
        eye_status: item.eye_status, // 문자열 상태 그대로 사용
        ear_value: item.ear_value || 0,
        head_pose_pitch: item.head_pose_pitch || 0,
        head_pose_yaw: item.head_pose_yaw || 0,
        head_pose_roll: item.head_pose_roll || 0,
        created_at: item.created_at
      }

      if (item.data_type === 'focus') {
        focusData.push(dataPoint)
      } else if (item.data_type === 'nonfocus') {
        nonFocusData.push(dataPoint)
      }
    })

    console.log(`데이터 분리 완료 - 집중: ${focusData.length}개, 비집중: ${nonFocusData.length}개 (세션 ${sessionId})`)

    if (focusData.length === 0 || nonFocusData.length === 0) {
      return NextResponse.json(
        { error: '집중 데이터와 비집중 데이터가 모두 필요합니다' },
        { status: 400 }
      )
    }

    // 3. JSON 파일로 변환
    console.log(`JSON 파일 생성 시작 - 집중 데이터 ${focusData.length}개, 비집중 데이터 ${nonFocusData.length}개`)
    
    // 3-1. focus.json 생성
    console.log('focus.json 생성 중...')
    const focusFrames = focusData.map(item => ({
      timestamp: new Date(item.timestamp).getTime(),
      eye_status: {
        status: item.eye_status === 1 || item.eye_status === 'OPEN' || item.eye_status === 'open' ? 'OPEN' : 'CLOSED',
        ear_value: item.ear_value || 0
      },
      head_pose: {
        pitch: item.head_pose_pitch || 0,
        yaw: item.head_pose_yaw || 0,
        roll: item.head_pose_roll || 0
      }
    }))

    const focusJson = JSON.stringify(focusFrames, null, 2)
    console.log(`focus.json 생성 완료 - ${focusFrames.length}개 프레임`)

    // 3-2. nonfocus.json 생성
    console.log('nonfocus.json 생성 중...')
    const nonFocusFrames = nonFocusData.map(item => ({
      timestamp: new Date(item.timestamp).getTime(),
      eye_status: {
        status: item.eye_status === 1 || item.eye_status === 'OPEN' || item.eye_status === 'open' ? 'OPEN' : 'CLOSED',
        ear_value: item.ear_value || 0
      },
      head_pose: {
        pitch: item.head_pose_pitch || 0,
        yaw: item.head_pose_yaw || 0,
        roll: item.head_pose_roll || 0
      }
    }))

    const nonFocusJson = JSON.stringify(nonFocusFrames, null, 2)
    console.log(`nonfocus.json 생성 완료 - ${nonFocusFrames.length}개 프레임`)
    
    console.log(`모든 JSON 파일 생성 완료 - focus.json: ${focusFrames.length}개 프레임, nonfocus.json: ${nonFocusFrames.length}개 프레임`)
    
    // 4. ZIP 파일 생성 (focus.json, nonfocus.json 포함)
    console.log(`ZIP 파일 생성 시작 - focus.json과 nonfocus.json 포함`)
    
    const zip = new JSZip()
    zip.file('focus.json', focusJson)
    zip.file('nonfocus.json', nonFocusJson)

    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    console.log(`ZIP 파일 생성 완료: ${zipBuffer.length} bytes (focus.json: ${focusFrames.length}개, nonfocus.json: ${nonFocusFrames.length}개 포함)`)

    // 5. Presigned URL 요청
    const { presigned_url, storage_path } = await getPresignedUrl(userId)
    console.log('Presigned URL 생성 완료')

    // 6. 파일 업로드
    await uploadFile(presigned_url, zipBuffer)
    console.log('파일 업로드 완료')

    // 7. 모델 학습 시작
    const trainingResult = await startTraining(userId, storage_path)
    console.log('모델 학습 시작:', trainingResult.message)

    // 8. 개인화 모델 정보 업데이트
    const { error: updateError } = await supabase
      .from('user_personalization_models')
      .upsert({
        user_id: userId,
        focus_samples_collected: focusData.length,
        non_focus_samples_collected: nonFocusData.length,
        last_training_date: new Date().toISOString(),
        training_status: 'training',
        data_collection_session_id: sessionId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (updateError) {
      console.error('모델 정보 업데이트 오류:', updateError)
      // 에러가 발생해도 전체 프로세스를 실패로 처리하지 않음
    }

    return NextResponse.json({
      success: true,
      message: '개인화 데이터 처리가 완료되었습니다',
      data: {
        focusDataCount: focusData.length,
        nonFocusDataCount: nonFocusData.length,
        totalDataCount: collectedData.length,
        zipFileSize: zipBuffer.length,
        storagePath: storage_path,
        trainingMessage: trainingResult.message,
        filesIncluded: ['focus.json', 'nonfocus.json']
      }
    })

  } catch (error) {
    console.error('개인화 데이터 처리 오류:', error)
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '개인화 데이터 처리 중 오류가 발생했습니다',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
