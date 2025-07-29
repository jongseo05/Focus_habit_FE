import { NextRequest, NextResponse } from 'next/server'
import { DailyReportData } from '@/types/dailyReport'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')

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

    // 실제 구현에서는 데이터베이스에서 해당 날짜의 데이터를 조회
    // 여기서는 mock 데이터를 반환
    const mockData: DailyReportData = {
      date,
      focusScorePoints: Array.from({ length: 36 }, (_, i) => {
        const minute = i * 5 // 5분 간격으로 3시간 (180분)
        const timestamp = new Date(date + `T14:00:${minute * 60}`).toISOString() // 오후 2시부터 시작
        
        // Generate realistic focus score pattern for 3-hour session
        let baseScore = 70
        if (minute < 30) baseScore = 60 // 시작 시 집중도 낮음
        else if (minute >= 30 && minute < 90) baseScore = 85 // 중간 구간 최고 집중
        else if (minute >= 90 && minute < 150) baseScore = 75 // 후반부 약간 하락
        else baseScore = 65 // 마무리 구간
        
        const score = Math.max(0, Math.min(100, baseScore + (Math.random() - 0.5) * 15))
        
        const events: any[] = []
        if (Math.random() < 0.08) events.push('phone')
        if (Math.random() < 0.03) events.push('distraction')
        if (Math.random() < 0.02) events.push('break')
        if (score > 80) events.push('focus')
        if (Math.random() < 0.05) events.push('posture')
        
        return {
          ts: timestamp,
          score: Math.round(score),
          events
        }
      }),
      highlights: {
        peak: {
          time: "14:30",
          score: 95,
          duration: 45
        },
        drop: {
          time: "16:15",
          score: 35,
          reason: "휴대폰 사용 증가"
        },
        phoneUsage: {
          count: 8,
          totalTime: 23,
          peakTime: "16:00"
        }
      },
      aiAdvice: {
        message: "오후 2-4시에 집중도가 최고조에 달했습니다. 중요한 작업을 이 시간에 배치하는 것을 권장합니다.",
        routine: {
          id: "morning_focus",
          name: "아침 집중 루틴",
          enabled: false,
          description: "오전 9-11시 집중 세션 자동 시작"
        }
      },
      reward: {
        exp: 1250,
        level: 8,
        progress: 75,
        stickers: ["🌟", "🎯", "⚡", "🏆", "💎"]
      }
    }

    // 실제 구현에서는 데이터가 없을 경우 404 반환
    // if (!dataExists) {
    //   return NextResponse.json(
    //     { error: '해당 날짜의 데이터가 없습니다' },
    //     { status: 404 }
    //   )
    // }

    return NextResponse.json(mockData)
  } catch (error) {
    console.error('Daily report API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
} 