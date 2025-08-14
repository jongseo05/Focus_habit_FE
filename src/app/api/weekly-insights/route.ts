import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Weekly insights authentication failed:', userError)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      )
    }

    const { weeklyData } = await request.json()
    
    if (!weeklyData) {
      return NextResponse.json(
        { error: 'Weekly data is required' },
        { status: 400 }
      )
    }

    console.log(`🤖 GPT 주간 인사이트 생성 요청:`, { userId: user.id })

    // GPT API 호출
    const insights = await generateWeeklyInsights(weeklyData)

    console.log('✅ GPT 주간 인사이트 생성 완료')
    return NextResponse.json({
      success: true,
      insights
    })

  } catch (error) {
    console.error('❌ Weekly insights API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function generateWeeklyInsights(weeklyData: any) {
  try {
    // OpenAI API 키 확인
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // 주간 데이터 요약
    const summary = generateDataSummary(weeklyData)
    
    const prompt = `
당신은 집중력 향상 전문가입니다. 아래 사용자의 주간 집중 데이터를 분석하고 3가지 개인화된 인사이트를 제공해주세요.

=== 주간 데이터 요약 ===
${summary}

=== 요청사항 ===
다음 형식으로 정확히 3개의 인사이트를 JSON 배열로 반환해주세요:

[
  {
    "type": "학습 스타일 분석",
    "title": "구체적인 분석 제목",
    "description": "데이터 기반 구체적 설명",
    "advice": "💡 실행 가능한 조언",
    "icon": "Clock",
    "color": "bg-blue-500"
  },
  {
    "type": "집중력 트렌드",
    "title": "트렌드 분석 제목", 
    "description": "변화 패턴 설명",
    "advice": "💡 개선 방안",
    "icon": "TrendingUp",
    "color": "bg-emerald-500"
  },
  {
    "type": "개선 제안",
    "title": "맞춤형 제안 제목",
    "description": "문제점과 해결방안",
    "advice": "💡 구체적 실행 방법",
    "icon": "Target",
    "color": "bg-purple-500"
  }
]

=== 가이드라인 ===
- 데이터에 기반한 구체적 수치 언급
- 개인화된 조언 제공
- 긍정적이고 동기부여가 되는 톤
- 한국어로 작성
- JSON 형식만 반환 (다른 텍스트 없이)
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 집중력 향상 전문가입니다. 사용자의 데이터를 분석하여 개인화된 인사이트를 제공합니다.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    })

    if (!response.ok) {
      throw new Error(`GPT API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content received from GPT')
    }

    // JSON 파싱
    try {
      const insights = JSON.parse(content)
      return insights
    } catch (parseError) {
      console.error('JSON 파싱 실패:', content)
      // 기본 인사이트 반환
      return getDefaultInsights(weeklyData)
    }

  } catch (error) {
    console.error('GPT 인사이트 생성 실패:', error)
    // 기본 인사이트 반환
    return getDefaultInsights(weeklyData)
  }
}

function generateDataSummary(weeklyData: any) {
  const overview = weeklyData.overview || {}
  const timeData = weeklyData.timeSeriesData || []
  const breakdown = weeklyData.breakdown || {}
  
  // 요일별 패턴 분석
  const bestDay = timeData.reduce((best: any, current: any) => 
    current.focusScore > best.focusScore ? current : best, 
    { focusScore: 0, dayOfWeek: '월' }
  )
  
  const worstDay = timeData.reduce((worst: any, current: any) => 
    current.focusScore < worst.focusScore ? current : worst, 
    { focusScore: 100, dayOfWeek: '월' }
  )

  const activeDays = timeData.filter((day: any) => day.sessionDuration > 0).length

  return `
총 세션 수: ${overview.totalSessions || 0}회
총 집중 시간: ${Math.round((overview.totalFocusTime || 0) / 60)}시간 ${Math.round((overview.totalFocusTime || 0) % 60)}분
평균 집중도: ${overview.avgScore || 0}점
최고/최저 집중도: ${overview.peakScore || 0}점 / ${overview.lowestScore || 0}점
지난 주 대비 변화: ${overview.trend || 'stable'} (${overview.change || 0}점)

요일별 패턴:
- 최고 집중 요일: ${bestDay.dayOfWeek}요일 (${bestDay.focusScore}점)
- 최저 집중 요일: ${worstDay.dayOfWeek}요일 (${worstDay.focusScore}점)
- 활동한 날: 7일 중 ${activeDays}일

세부 분석:
- 주의력: ${breakdown.attention || 0}%
- 자세: ${breakdown.posture || 0}%
- 휴대폰 사용 제어: ${breakdown.phoneUsage || 0}%
- 학습 일관성: ${breakdown.consistency || 0}%
`;
}

function getDefaultInsights(weeklyData: any) {
  const overview = weeklyData.overview || {}
  const timeData = weeklyData.timeSeriesData || []
  
  const bestDay = timeData.reduce((best: any, current: any) => 
    current.focusScore > best.focusScore ? current : best, 
    { focusScore: 0, dayOfWeek: '월' }
  )

  return [
    {
      type: "학습 스타일 분석",
      title: `'${bestDay.dayOfWeek}요일형 학습자'입니다!`,
      description: `${bestDay.dayOfWeek}요일 집중도가 ${bestDay.focusScore}점으로 가장 높았어요.`,
      advice: "💡 이 요일에 중요한 학습을 계획하세요.",
      icon: "Clock",
      color: "bg-blue-500"
    },
    {
      type: "집중력 트렌드",
      title: `지난 주 대비 집중도 ${overview.trend === 'up' ? '향상' : overview.trend === 'down' ? '저하' : '유지'}`,
      description: `평균 집중도가 ${overview.change || 0}점 변화했습니다.`,
      advice: overview.trend === 'up' ? "💡 현재 패턴을 유지하세요!" : "💡 학습 환경을 점검해보세요.",
      icon: "TrendingUp", 
      color: "bg-emerald-500"
    },
    {
      type: "개선 제안",
      title: "꾸준한 학습 습관 만들기",
      description: `이번 주 총 ${overview.totalSessions || 0}회 학습하셨습니다.`,
      advice: "💡 매일 조금씩이라도 꾸준히 학습해보세요.",
      icon: "Target",
      color: "bg-purple-500"
    }
  ]
}