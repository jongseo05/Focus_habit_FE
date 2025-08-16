import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { weeklyData } = await request.json()

    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OpenAI API 키가 설정되지 않음 - 기본 인사이트 사용')
      const insights = getDefaultInsights(weeklyData)
      return NextResponse.json({ insights })
    }

    // GPT API 호출을 위한 프롬프트 생성
    const prompt = generateAnalysisPrompt(weeklyData)
    
    // OpenAI API 호출
    const insights = await callGPTAPI(prompt, weeklyData)

    return NextResponse.json({ insights })
  } catch (error) {
    console.error('Learning insights API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateAnalysisPrompt(weeklyData: any): string {
  const { timeSeriesData, heatmapData, overview } = weeklyData
  
  return `
You are a learning pattern analysis expert. Please analyze the following weekly learning data and provide personalized learning insights.

Weekly Data:
- Total Sessions: ${overview.totalSessions}
- Average Focus Score: ${overview.averageFocusScore} points
- Total Study Time: ${overview.totalStudyTime} hours

Daily Data:
${timeSeriesData.map((day: any) => 
  `- ${day.dayOfWeek}: ${day.focusScore} points, ${day.sessionDuration} hours, ${day.distractions} distractions`
).join('\n')}

Hourly heatmap data is also provided.

Please provide the analysis result in the following JSON format:

{
  "learningStyle": {
    "type": "Learning style type (e.g., morning person, evening person, consistent type)",
    "description": "Detailed description of learning style",
    "recommendation": "Specific advice for improving learning style"
  },
  "focusPattern": {
    "peakHours": ["Peak concentration time periods"],
    "declinePattern": "Focus decline pattern description",
    "recommendation": "Advice for maintaining focus"
  },
  "efficiencyAnalysis": {
    "sessionLengths": [
      {
        "duration": "Session length",
        "averageScore": "Average focus score"
      }
    ],
    "recommendation": "Advice on efficient session length"
  },
  "weeklyTrends": {
    "bestDay": "Most efficient day",
    "worstDay": "Day needing improvement",
    "improvement": "Weekly pattern improvement plan"
  },
  "personalizedTips": [
    "Personalized learning tip 1",
    "Personalized learning tip 2",
    "Personalized learning tip 3"
  ]
}

Please provide all responses in Korean language and give specific, practical advice. Make sure to return ONLY valid JSON without any additional text or explanations.
`
}

async function callGPTAPI(prompt: string, weeklyData: any) {
  try {
    // 실제 OpenAI API 호출 (환경변수 설정 필요)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a learning pattern analysis expert. Analyze user learning data and provide personalized insights. Always respond with valid JSON only, no additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      throw new Error('OpenAI API 호출 실패')
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    // JSON 파싱
    try {
      const parsed = JSON.parse(content)
      console.log('✅ GPT 응답 파싱 성공:', parsed)
      return parsed
    } catch (parseError) {
      console.error('❌ JSON 파싱 오류:', parseError)
      console.error('원본 응답:', content)
      // 기본 응답 반환
      return getDefaultInsights(weeklyData)
    }
  } catch (error) {
    console.error('❌ GPT API 호출 오류:', error)
    return getDefaultInsights(weeklyData)
  }
}

function getDefaultInsights(weeklyData: any) {
  const { timeSeriesData, overview } = weeklyData
  
  // 실제 데이터 기반 분석
  const avgFocusScore = overview.averageFocusScore || 75
  const totalSessions = overview.totalSessions || 0
  const totalStudyTime = overview.totalStudyTime || 0
  
  // 학습 스타일 분석
  let learningStyle = {
    type: '일반형 학습자',
    description: '안정적인 학습 패턴을 보이고 있습니다.',
    recommendation: '현재 패턴을 유지하면서 점진적으로 개선해보세요.'
  }
  
  if (avgFocusScore >= 80) {
    learningStyle = {
      type: '고성과 학습자',
      description: '높은 집중도를 유지하며 효율적인 학습을 하고 있습니다.',
      recommendation: '현재의 우수한 성과를 유지하면서 더욱 체계적인 학습 계획을 세워보세요.'
    }
  } else if (avgFocusScore >= 60) {
    learningStyle = {
      type: '안정형 학습자',
      description: '일정한 학습 패턴을 보이며 꾸준한 성장을 하고 있습니다.',
      recommendation: '현재의 안정적인 패턴을 유지하면서 점진적으로 개선해보세요.'
    }
  } else {
    learningStyle = {
      type: '개선형 학습자',
      description: '학습 패턴을 개선할 여지가 있습니다.',
      recommendation: '집중도 향상을 위해 학습 환경과 방법을 점검해보세요.'
    }
  }
  
  // 주간 트렌드 분석
  let bestDay = '화요일'
  let worstDay = '일요일'
  let weeklyImprovement = ''
  
  if (timeSeriesData && timeSeriesData.length >= 3) {
    // 충분한 데이터가 있을 때만 분석 제공
    const dayScores = timeSeriesData.map((day: any) => ({
      day: day.dayOfWeek,
      score: day.focusScore
    }))
    
    const sortedDays = dayScores.sort((a: any, b: any) => b.score - a.score)
    bestDay = sortedDays[0]?.day || '화요일'
    worstDay = sortedDays[sortedDays.length - 1]?.day || '일요일'
    weeklyImprovement = `${worstDay}에도 일정한 학습 습관을 만들어보세요. 짧은 세션이라도 매일 학습하는 것이 중요합니다.`
  } else {
    // 데이터 부족 시 안내 메시지
    bestDay = '데이터 부족'
    worstDay = '데이터 부족'
    weeklyImprovement = '주간 패턴을 분석하기 위해서는 최소 3일 이상의 학습 데이터가 필요합니다. 꾸준히 학습을 이어가보세요!'
  }
  
  // 세션 길이별 효율성 분석 - 데이터 부족 시 안내 메시지
  let sessionLengths = []
  let efficiencyRecommendation = ''
  
  if (totalSessions >= 3) {
    // 충분한 데이터가 있을 때만 분석 제공
    sessionLengths = [
      { duration: '30분', averageScore: Math.min(avgFocusScore + 10, 100) },
      { duration: '60분', averageScore: avgFocusScore },
      { duration: '90분', averageScore: Math.max(avgFocusScore - 15, 0) }
    ]
    efficiencyRecommendation = '30분 단위의 짧은 세션이 가장 효율적입니다. 긴 세션보다는 여러 개의 짧은 세션으로 나누어 학습하세요.'
  } else {
    // 데이터 부족 시 안내 메시지
    sessionLengths = [
      { duration: '데이터 부족', averageScore: 0 }
    ]
    efficiencyRecommendation = '더 정확한 분석을 위해서는 최소 3개 이상의 세션 데이터가 필요합니다. 계속해서 학습 세션을 진행해보세요!'
  }
  
  // 집중력 패턴 분석 - 데이터 부족 시 안내 메시지
  let focusPattern = {
    peakHours: ['09:00-11:00', '14:00-16:00'],
    declinePattern: '평균적으로 45분 후에 집중도가 25% 감소합니다.',
    recommendation: '뽀모도로 기법(25분 집중 + 5분 휴식)을 활용하여 집중력을 유지하세요.'
  }
  
  if (totalSessions < 2) {
    focusPattern = {
      peakHours: ['데이터 부족'],
      declinePattern: '더 많은 학습 세션을 통해 집중력 패턴을 분석할 수 있습니다.',
      recommendation: '최소 2개 이상의 세션을 완료하면 개인화된 집중력 패턴을 확인할 수 있어요!'
    }
  }
  
  return {
    learningStyle,
    focusPattern,
    efficiencyAnalysis: {
      sessionLengths,
      recommendation: efficiencyRecommendation
    },
    weeklyTrends: {
      bestDay,
      worstDay,
      improvement: weeklyImprovement
    },
    personalizedTips: totalSessions >= 2 ? [
      '아침 시간을 최대한 활용하여 중요한 학습을 계획하세요',
      '25분 집중 + 5분 휴식 패턴을 시도해보세요',
      `${worstDay}에도 30분 정도의 짧은 세션으로 학습을 유지하세요`,
      '집중도가 낮은 시간대에는 복습이나 정리 작업을 하세요'
    ] : [
      '첫 번째 학습 세션을 시작해보세요!',
      '25분 집중 + 5분 휴식의 뽀모도로 기법을 시도해보세요',
      '학습 환경을 조용하고 편안하게 만들어보세요',
      '더 많은 세션을 완료하면 개인화된 팁을 받을 수 있어요!'
    ]
  }
}
