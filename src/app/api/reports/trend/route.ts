import { NextRequest, NextResponse } from 'next/server'

// Mock 데이터 생성 함수
const generateTrendData = () => {
  const data = []
  const today = new Date()
  
  for (let i = 27; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    
    // 주중과 주말에 따른 패턴 생성
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    
    let focusScore, studyTime, sessions
    
    if (isWeekend) {
      // 주말: 낮은 집중도, 적은 학습시간
      focusScore = Math.floor(Math.random() * 30) + 50 // 50-80
      studyTime = Math.floor(Math.random() * 60) + 30 // 30-90분
      sessions = Math.floor(Math.random() * 3) + 1 // 1-3세션
    } else {
      // 주중: 높은 집중도, 많은 학습시간
      focusScore = Math.floor(Math.random() * 40) + 60 // 60-100
      studyTime = Math.floor(Math.random() * 120) + 60 // 60-180분
      sessions = Math.floor(Math.random() * 5) + 1 // 1-5세션
    }
    
    data.push({
      date: date.toISOString().split('T')[0],
      focusScore,
      studyTime,
      sessions,
    })
  }
  
  return data
}

export async function GET(request: NextRequest) {
  try {
    // 실제 환경에서는 데이터베이스에서 데이터를 가져옵니다
    const trendData = generateTrendData()
    
    // API 응답 지연 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 300))
    
    return NextResponse.json({
      success: true,
      data: trendData,
      message: '트렌드 데이터를 성공적으로 가져왔습니다.'
    })
  } catch (error) {
    console.error('트렌드 데이터 조회 중 오류:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: '트렌드 데이터를 가져오는데 실패했습니다.'
      },
      { status: 500 }
    )
  }
} 