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
당신은 학습 패턴 분석 전문가입니다. 아래 사용자의 주간 집중 데이터를 분석하고 **학습 방법과 학습 습관 개선**에 관한 3가지 개인화된 인사이트를 제공해주세요.

=== 주간 데이터 요약 ===
${summary}

=== 데이터 설명 ===
- 집중도: AI가 얼굴 분석으로 측정한 집중 상태 (focused/normal/distracted)
- 눈 건강: EAR값 기반 깜빡임 패턴 분석 (정상 범위: 0.2-0.4)
- 자세: 머리 각도 분석 (pitch/yaw/roll 값으로 측정)
- 학습 일관성: 매일 꾸준히 학습하는 정도

=== 요청사항 ===
**학습 패턴 관점**에서 다음 형식으로 정확히 3개의 인사이트를 JSON 배열로 반환해주세요:

[
  {
    "type": "학습 스타일 분석",
    "title": "요일별/시간대별 학습 패턴 분석",
    "description": "언제 집중도가 높은지, 최적의 학습 시간대 분석",
    "advice": "💡 가장 집중도가 높은 시간에 중요한 과목을 배치하세요",
    "icon": "Clock",
    "color": "bg-blue-500"
  },
  {
    "type": "학습 세션 최적화" 또는 "학습 리듬 분석" 또는 "집중력 패턴",
    "title": "세션 길이, 휴식 패턴, 학습 리듬 분석", 
    "description": "얼마나 오래 집중할 수 있는지, 언제 휴식이 필요한지 분석",
    "advice": "💡 45분 학습 + 10분 휴식 패턴을 시도해보세요",
    "icon": "TrendingUp" 또는 "Target" 또는 "Activity",
    "color": "bg-emerald-500" 또는 "bg-orange-500" 또는 "bg-green-500"
  },
  {
    "type": "학습 습관 개선",
    "title": "학습 일관성 및 습관 개선 방안",
    "description": "꾸준한 학습을 위한 구체적인 개선 방안",
    "advice": "💡 매일 같은 시간에 학습하는 루틴을 만들어보세요",
    "icon": "Target",
    "color": "bg-purple-500"
  }
]

=== 가이드라인 ===
- **학습 방법론에 집중**: 언제, 얼마나, 어떻게 공부할지에 대한 조언
- **실행 가능한 학습 전략**: 구체적인 학습 계획과 방법 제시
- **개인 맞춤형**: 사용자의 실제 집중 패턴을 바탕으로 한 조언
- 기술적 조언(자세, 눈 건강) 대신 **학습 효율성** 관점의 조언
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
- 집중도: ${breakdown.attention || 0}%
- 눈 건강 (적절한 깜빡임): ${breakdown.eyeHealth || 0}%
- 자세 (머리 각도): ${breakdown.posture || 0}%
- 학습 일관성: ${breakdown.consistency || 0}%
`;
}

function getDefaultInsights(weeklyData: any) {
  const overview = weeklyData.overview || {}
  const timeData = weeklyData.timeSeriesData || []
  const breakdown = weeklyData.breakdown || {}
  
  const bestDay = timeData.reduce((best: any, current: any) => 
    current.focusScore > best.focusScore ? current : best, 
    { focusScore: 0, dayOfWeek: '월' }
  )

  const insights = [
    {
      type: "학습 스타일 분석",
      title: `'${bestDay.dayOfWeek}요일형 학습자'입니다!`,
      description: `${bestDay.dayOfWeek}요일 집중도가 ${bestDay.focusScore}점으로 가장 높았어요. 이 요일에 중요하고 어려운 과목을 배치하면 학습 효과가 극대화됩니다.`,
      advice: "💡 가장 집중도가 높은 요일에 중요한 과목이나 새로운 개념 학습을 계획하세요.",
      icon: "Clock",
      color: "bg-blue-500"
    },
    {
      type: "학습 리듬 분석",
      title: `지난 주 대비 집중 패턴 ${overview.trend === 'up' ? '향상' : overview.trend === 'down' ? '변화' : '안정'}`,
      description: `평균 집중도가 ${overview.change || 0}점 변화했습니다. ${overview.trend === 'up' ? '학습 리듬이 좋아지고 있어요!' : overview.trend === 'down' ? '학습 방법을 조정해볼 시점입니다.' : '안정적인 학습 패턴을 유지하고 있어요.'}`,
      advice: overview.trend === 'up' ? "💡 현재 학습 스케줄과 방법을 유지하세요!" : "💡 학습 시간대나 과목 순서를 바꿔보세요.",
      icon: "TrendingUp", 
      color: "bg-emerald-500"
    }
  ]

  // 학습 패턴 기반 조건부 인사이트
  const activeDays = timeData.filter((day: any) => day.sessionDuration > 0).length
  const avgSessionDuration = timeData.reduce((sum: number, day: any) => sum + day.sessionDuration, 0) / timeData.length
  
  if (activeDays < 4) {
    insights.push({
      type: "학습 습관 개선",
      title: "학습 일관성 향상이 필요해요",
      description: `일주일 중 ${activeDays}일만 학습했습니다. 꾸준한 학습이 기억 정착에 중요합니다.`,
      advice: "💡 매일 15-20분이라도 짧게 학습하는 습관을 만들어보세요.",
      icon: "Target",
      color: "bg-orange-500"
    })
  } else if (avgSessionDuration > 90) {
    insights.push({
      type: "학습 세션 최적화",
      title: "학습 세션을 짧게 나누어보세요",
      description: `평균 세션이 ${Math.round(avgSessionDuration)}분으로 깁니다. 너무 긴 세션은 집중도를 떨어뜨릴 수 있어요.`,
      advice: "💡 45-60분 학습 후 10-15분 휴식하는 패턴을 시도해보세요.",
      icon: "Activity",
      color: "bg-green-500"
    })
  } else if (avgSessionDuration < 25) {
    insights.push({
      type: "학습 세션 최적화", 
      title: "조금 더 긴 집중 시간을 연습해보세요",
      description: `평균 세션이 ${Math.round(avgSessionDuration)}분으로 짧습니다. 깊이 있는 학습을 위해 집중 시간을 늘려보세요.`,
      advice: "💡 30-40분 연속 집중을 목표로 점진적으로 늘려보세요.",
      icon: "Activity",
      color: "bg-green-500"
    })
  } else {
    insights.push({
      type: "학습 습관 개선",
      title: "훌륭한 학습 패턴입니다!",
      description: `일주일 중 ${activeDays}일 학습하고 적절한 세션 길이를 유지하고 있어요.`,
      advice: "💡 현재 패턴을 유지하면서 학습 내용의 깊이를 더해보세요.",
      icon: "Target",
      color: "bg-purple-500"
    })
  }

  return insights
}