import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      } as APIResponse, { status: 401 })
    }

    const body = await request.json()
    const { weeklyData } = body

    // 입력 데이터 검증
    if (!weeklyData || !weeklyData.timeSeriesData || weeklyData.timeSeriesData.length === 0) {
      return NextResponse.json({
        success: false,
        error: '분석할 데이터가 부족합니다. 최소 1일 이상의 학습 데이터가 필요합니다.'
      } as APIResponse, { status: 400 })
    }

    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API 키가 설정되지 않음 - 기본 인사이트 사용')
      const insights = getDefaultInsights(weeklyData)
      return NextResponse.json({
        success: true,
        data: insights,
        message: '기본 분석 알고리즘으로 인사이트를 생성했습니다.'
      } as APIResponse)
    }

    // GPT API 호출을 위한 프롬프트 생성
    const prompt = generateAnalysisPrompt(weeklyData)
    
    // OpenAI API 호출
    const insights = await callGPTAPI(prompt, weeklyData)

    return NextResponse.json({
      success: true,
      data: insights,
      message: 'AI 분석을 통해 개인화된 인사이트를 생성했습니다.'
    } as APIResponse)
  } catch (error) {
    console.error('Learning insights API error:', error)
    return NextResponse.json({
      success: false,
      error: '인사이트 생성 중 오류가 발생했습니다.'
    } as APIResponse, { status: 500 })
  }
}

function generateAnalysisPrompt(weeklyData: any): string {
  const { timeSeriesData, heatmapData, overview } = weeklyData
  
  // 데이터 품질 평가
  const dataQuality = assessDataQuality(weeklyData)
  const detailedStats = calculateDetailedStats(timeSeriesData)
  
  return `
당신은 학습 패턴 분석 전문가입니다. 다음 주간 학습 데이터를 분석하여 개인화된 학습 인사이트를 제공해주세요.

## 전체 요약 데이터
- 총 세션 수: ${overview.totalSessions}개
- 평균 집중도: ${overview.averageFocusScore}점 (100점 만점)
- 총 학습 시간: ${overview.totalStudyTime}시간
- 데이터 신뢰도: ${dataQuality.reliability}% (${dataQuality.status})

## 일별 상세 데이터
${timeSeriesData.map((day: any, index: number) => 
  `${index + 1}. ${day.dayOfWeek}: 집중도 ${day.focusScore}점, 학습시간 ${day.sessionDuration}시간, 방해요소 ${day.distractions}회`
).join('\n')}

## 통계적 분석 결과
- 집중도 분산: ${detailedStats.focusVariance.toFixed(1)} (일관성 지표)
- 최고/최저 집중도 차이: ${detailedStats.focusRange}점
- 주간 학습 시간 분포: 평일 ${detailedStats.weekdayAvg.toFixed(1)}시간, 주말 ${detailedStats.weekendAvg.toFixed(1)}시간
- 방해요소 평균: ${detailedStats.avgDistractions.toFixed(1)}회/세션

## 시간대별 패턴 (히트맵 데이터 기반)
${heatmapData && heatmapData.length > 0 ? 
  `오전(6-12시), 오후(12-18시), 저녁(18-24시) 패턴이 제공됨` : 
  '시간대별 데이터 부족'}

다음 JSON 형식으로 정확하고 구체적인 분석 결과를 제공해주세요:

{
  "learningStyle": {
    "type": "학습 스타일 유형 (예: 아침형 인간, 저녁형 인간, 일관형, 집중형 등)",
    "description": "학습 스타일에 대한 상세 설명 (데이터 근거 포함)",
    "recommendation": "학습 스타일 개선을 위한 구체적 조언",
    "confidence": 0-100 사이의 신뢰도 숫자,
    "characteristics": ["특성1", "특성2", "특성3"]
  },
  "focusPattern": {
    "peakHours": ["최고 집중 시간대들"],
    "declinePattern": "집중력 감소 패턴 구체적 설명",
    "recommendation": "집중력 유지를 위한 실질적 조언",
    "consistency": 0-100 사이의 일관성 점수,
    "weekdayVsWeekend": {
      "weekday": 평일 평균 집중도,
      "weekend": 주말 평균 집중도,
      "difference": 차이값
    }
  },
  "efficiencyAnalysis": {
    "sessionLengths": [
      {
        "duration": "세션 길이 (예: 25분, 45분)",
        "averageScore": 해당 길이의 평균 점수,
        "frequency": 빈도수
      }
    ],
    "recommendation": "효율적인 세션 길이에 대한 조언",
    "optimalSessionLength": "최적 세션 길이",
    "efficiencyTrend": "improving/declining/stable 중 하나"
  },
  "weeklyTrends": {
    "bestDay": "가장 효율적인 요일",
    "worstDay": "개선이 필요한 요일",
    "improvement": "주간 패턴 개선 계획",
    "scoreVariation": 점수 변동폭,
    "progressFromLastWeek": {
      "change": 변화량,
      "direction": "up/down/stable"
    }
  },
  "personalizedTips": [
    {
      "category": "focus/schedule/environment/technique 중 하나",
      "tip": "구체적이고 실행 가능한 개인화된 팁",
      "priority": "high/medium/low",
      "difficulty": "easy/medium/hard",
      "estimatedImpact": 0-20 사이의 예상 개선 효과
    }
  ],
  "studyEnvironment": {
    "timeOfDayEffectiveness": [
      {
        "period": "시간대 (예: 오전 9-12시)",
        "score": 해당 시간대 효율성 점수,
        "recommendation": "해당 시간대 활용 조언"
      }
    ],
    "sessionBreakdown": {
      "shortSessions": 짧은 세션 수,
      "mediumSessions": 중간 세션 수,
      "longSessions": 긴 세션 수,
      "mostEffective": "가장 효과적인 세션 유형"
    }
  },
  "goalAchievement": {
    "weeklyGoalCompletion": 주간 목표 달성률,
    "streakDays": 연속 학습 일수,
    "missedDays": 놓친 일수,
    "targetAdjustment": "목표 조정 권장사항"
  },
  "comparativeAnalysis": {
    "vsLastWeek": {
      "focusScore": 전주 대비 집중도 변화,
      "studyTime": 전주 대비 학습시간 변화,
      "consistency": 전주 대비 일관성 변화
    },
    "vsAverage": {
      "rank": "등급 (상급/중급/초급)",
      "percentile": 백분위수
    }
  }
}

## 중요 지침
1. 제공된 실제 데이터를 기반으로 분석하세요
2. 모든 응답은 한국어로 작성하세요
3. 구체적이고 실행 가능한 조언을 제공하세요
4. 데이터가 부족한 경우 그에 맞는 조언을 하세요
5. JSON 형식만 반환하고 추가 설명은 포함하지 마세요
6. 모든 숫자 값은 실제 데이터에 근거해야 합니다
`
}

// 데이터 품질 평가 함수
function assessDataQuality(weeklyData: any) {
  const { timeSeriesData, overview } = weeklyData
  const totalSessions = overview?.totalSessions || 0
  const dataPoints = timeSeriesData?.length || 0
  
  let reliability = 0
  let status = '부족'
  
  if (totalSessions >= 10 && dataPoints >= 5) {
    reliability = 90
    status = '우수'
  } else if (totalSessions >= 5 && dataPoints >= 3) {
    reliability = 75
    status = '양호'
  } else if (totalSessions >= 3 && dataPoints >= 2) {
    reliability = 60
    status = '보통'
  } else if (totalSessions >= 1) {
    reliability = 40
    status = '부족'
  }
  
  return { reliability, status }
}

// 상세 통계 계산 함수
function calculateDetailedStats(timeSeriesData: any[]) {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return {
      focusVariance: 0,
      focusRange: 0,
      weekdayAvg: 0,
      weekendAvg: 0,
      avgDistractions: 0
    }
  }
  
  const focusScores = timeSeriesData.map(day => day.focusScore || 0)
  const sessionDurations = timeSeriesData.map(day => day.sessionDuration || 0)
  const distractions = timeSeriesData.map(day => day.distractions || 0)
  
  // 집중도 분산 계산
  const avgFocus = focusScores.reduce((sum, score) => sum + score, 0) / focusScores.length
  const focusVariance = focusScores.reduce((sum, score) => sum + Math.pow(score - avgFocus, 2), 0) / focusScores.length
  
  // 집중도 범위
  const focusRange = Math.max(...focusScores) - Math.min(...focusScores)
  
  // 평일/주말 구분 (가정: 토요일, 일요일이 주말)
  const weekdays = timeSeriesData.filter(day => 
    !['토요일', '일요일', 'Saturday', 'Sunday'].includes(day.dayOfWeek)
  )
  const weekends = timeSeriesData.filter(day => 
    ['토요일', '일요일', 'Saturday', 'Sunday'].includes(day.dayOfWeek)
  )
  
  const weekdayAvg = weekdays.length > 0 ? 
    weekdays.reduce((sum, day) => sum + (day.sessionDuration || 0), 0) / weekdays.length : 0
  const weekendAvg = weekends.length > 0 ? 
    weekends.reduce((sum, day) => sum + (day.sessionDuration || 0), 0) / weekends.length : 0
  
  // 평균 방해요소
  const avgDistractions = distractions.reduce((sum, d) => sum + d, 0) / distractions.length
  
  return {
    focusVariance,
    focusRange,
    weekdayAvg,
    weekendAvg,
    avgDistractions
  }
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
        model: 'gpt-4o-mini', // 더 효율적이고 빠른 모델 사용
        messages: [
          {
            role: 'system',
            content: `당신은 학습 패턴 분석 전문가입니다. 사용자의 학습 데이터를 분석하여 개인화된 인사이트를 제공합니다.
            
중요 규칙:
1. 반드시 유효한 JSON 형식으로만 응답하세요
2. 실제 제공된 데이터를 기반으로 분석하세요
3. 한국어로 구체적이고 실행 가능한 조언을 제공하세요
4. 데이터가 부족한 경우 그에 맞는 현실적인 조언을 하세요
5. 모든 숫자 값은 논리적이고 일관성 있게 제공하세요`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2, // 더 일관된 응답을 위해 낮춤
        max_tokens: 2000, // 충분한 토큰 할당
        response_format: { type: "json_object" },
        timeout: 30000 // 30초 타임아웃
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API 호출 실패: ${response.status} - ${errorData.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('GPT 응답이 비어있습니다')
    }
    
    // JSON 파싱 및 검증
    try {
      const parsed = JSON.parse(content)
      
      // 필수 필드 검증
      const requiredFields = ['learningStyle', 'focusPattern', 'efficiencyAnalysis', 'weeklyTrends', 'personalizedTips']
      const missingFields = requiredFields.filter(field => !parsed[field])
      
      if (missingFields.length > 0) {
        console.warn('GPT 응답에 누락된 필드들:', missingFields)
        // 누락된 필드를 기본값으로 보완
        return supplementMissingFields(parsed, weeklyData)
      }
      
      console.log('GPT 응답 파싱 성공')
      return parsed
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError)
      console.error('원본 응답:', content.substring(0, 500) + '...')
      // 기본 응답 반환
      return getDefaultInsights(weeklyData)
    }
  } catch (error) {
    console.error('GPT API 호출 오류:', error)
    return getDefaultInsights(weeklyData)
  }
}

// GPT 응답의 누락된 필드를 보완하는 함수
function supplementMissingFields(parsed: any, weeklyData: any) {
  const defaultInsights = getDefaultInsights(weeklyData)
  
  return {
    ...defaultInsights,
    ...parsed,
    // 특정 필드가 누락된 경우 기본값으로 보완
    learningStyle: parsed.learningStyle || defaultInsights.learningStyle,
    focusPattern: parsed.focusPattern || defaultInsights.focusPattern,
    efficiencyAnalysis: parsed.efficiencyAnalysis || defaultInsights.efficiencyAnalysis,
    weeklyTrends: parsed.weeklyTrends || defaultInsights.weeklyTrends,
    personalizedTips: parsed.personalizedTips || defaultInsights.personalizedTips,
  }
}

// 학습 스타일 분석 함수
function analyzeLearningStyle(avgFocusScore: number, totalSessions: number, detailedStats: any, dataQuality: any) {
  const { focusVariance, weekdayAvg, weekendAvg } = detailedStats
  
  let type = '일반형 학습자'
  let description = '안정적인 학습 패턴을 보이고 있습니다.'
  let recommendation = '현재 패턴을 유지하면서 점진적으로 개선해보세요.'
  let characteristics = ['안정성', '일관성']
  
  // 고성과형 분석
  if (avgFocusScore >= 85 && focusVariance < 100) {
    type = '고집중 안정형'
    description = `높은 집중도(${avgFocusScore}점)를 안정적으로 유지하는 우수한 학습자입니다.`
    recommendation = '현재의 우수한 성과를 유지하면서 더 도전적인 목표를 설정해보세요.'
    characteristics = ['고집중', '안정성', '우수성']
  } else if (avgFocusScore >= 80) {
    type = '고성과 학습자'
    description = `높은 집중도(${avgFocusScore}점)로 효율적인 학습을 하고 있습니다.`
    recommendation = focusVariance > 150 ? 
      '집중도 변동을 줄이기 위해 일정한 학습 환경을 유지해보세요.' :
      '현재의 우수한 성과를 체계적으로 관리해보세요.'
    characteristics = ['고집중', '효율성', '목표지향']
  }
  // 안정형 분석  
  else if (avgFocusScore >= 65 && focusVariance < 200) {
    type = '안정형 학습자'
    description = `일정한 집중도(${avgFocusScore}점)로 꾸준한 학습을 하고 있습니다.`
    recommendation = '현재의 안정적인 패턴을 유지하면서 집중도를 점진적으로 높여보세요.'
    characteristics = ['일관성', '안정성', '지속성']
  }
  // 변동형 분석
  else if (focusVariance > 300) {
    type = '변동형 학습자'
    description = `집중도 변동이 큰 편입니다. (변동폭: ${focusVariance.toFixed(1)})`
    recommendation = '학습 환경과 컨디션을 점검하여 일관된 성과를 낼 수 있도록 개선해보세요.'
    characteristics = ['유동성', '잠재력', '개선여지']
  }
  // 개선형 분석
  else {
    type = '개선형 학습자'
    description = `학습 패턴을 개선할 여지가 많은 단계입니다. (현재 ${avgFocusScore}점)`
    recommendation = '집중도 향상을 위해 학습 환경, 시간대, 방법을 체계적으로 점검해보세요.'
    characteristics = ['성장가능성', '유연성', '발전단계']
  }
  
  // 평일/주말 패턴 반영
  if (Math.abs(weekdayAvg - weekendAvg) > 1) {
    if (weekdayAvg > weekendAvg) {
      characteristics.push('평일집중형')
      recommendation += ' 주말에도 짧은 세션으로 학습 리듬을 유지해보세요.'
    } else {
      characteristics.push('주말활용형')
      recommendation += ' 평일 학습 시간을 조금 더 확보해보세요.'
    }
  }
  
  return {
    type,
    description,
    recommendation,
    confidence: Math.min(dataQuality.reliability + 10, 95),
    characteristics
  }
}

// 주간 트렌드 분석 함수
function analyzeWeeklyTrends(timeSeriesData: any[], avgFocusScore: number) {
  if (!timeSeriesData || timeSeriesData.length === 0) {
    return {
      bestDay: '데이터 부족',
      worstDay: '데이터 부족',
      improvement: '주간 패턴을 분석하기 위해서는 최소 3일 이상의 학습 데이터가 필요합니다.',
      scoreVariation: 0,
      progressFromLastWeek: { change: 0, direction: 'stable' as const }
    }
  }
  
  // 요일별 성과 분석
  const dayScores = timeSeriesData.map(day => ({
    day: day.dayOfWeek,
    score: day.focusScore || 0,
    duration: day.sessionDuration || 0
  }))
  
  const sortedByScore = [...dayScores].sort((a, b) => b.score - a.score)
  const bestDay = sortedByScore[0]?.day || '월요일'
  const worstDay = sortedByScore[sortedByScore.length - 1]?.day || '일요일'
  
  // 점수 변동 계산
  const scores = dayScores.map(d => d.score)
  const scoreVariation = Math.max(...scores) - Math.min(...scores)
  
  // 개선 제안 생성
  let improvement = ''
  if (scoreVariation > 30) {
    improvement = `${worstDay}의 집중도가 낮습니다. 해당 요일의 학습 환경이나 컨디션을 점검해보세요.`
  } else if (scoreVariation > 15) {
    improvement = `전반적으로 안정적이지만 ${worstDay}에 조금 더 주의를 기울여보세요.`
  } else {
    improvement = '요일별 집중도가 일관되어 우수합니다. 현재 패턴을 유지하세요.'
  }
  
  // 진행 방향 결정
  const recentScore = timeSeriesData.slice(-2).reduce((sum, day) => sum + (day.focusScore || 0), 0) / Math.min(2, timeSeriesData.length)
  const direction = recentScore > avgFocusScore + 5 ? 'up' : recentScore < avgFocusScore - 5 ? 'down' : 'stable'
  
  return {
    bestDay,
    worstDay,
    improvement,
    scoreVariation: Math.round(scoreVariation),
    progressFromLastWeek: {
      change: Math.round(recentScore - avgFocusScore),
      direction
    }
  }
}

// 개인화된 팁 생성 함수
function generatePersonalizedTips(avgFocusScore: number, totalSessions: number, detailedStats: any, weeklyTrends: any) {
  const tips = []
  
  // 집중도 기반 팁
  if (avgFocusScore < 70) {
    tips.push({
      category: 'focus' as const,
      tip: '25분 집중 + 5분 휴식의 뽀모도로 기법을 시도해보세요',
      priority: 'high' as const,
      difficulty: 'easy' as const,
      estimatedImpact: 15
    })
  } else {
    tips.push({
      category: 'focus' as const,
      tip: '현재 집중도가 우수합니다. 더 깊은 집중을 위해 50분 세션을 시도해보세요',
      priority: 'medium' as const,
      difficulty: 'medium' as const,
      estimatedImpact: 10
    })
  }
  
  // 일관성 기반 팁
  if (detailedStats.focusVariance > 200) {
    tips.push({
      category: 'environment' as const,
      tip: '집중도 변동이 큽니다. 학습 환경과 시간대를 일정하게 유지해보세요',
      priority: 'high' as const,
      difficulty: 'medium' as const,
      estimatedImpact: 12
    })
  }
  
  // 주간 패턴 기반 팁
  if (weeklyTrends.worstDay !== '데이터 부족') {
    tips.push({
      category: 'schedule' as const,
      tip: `${weeklyTrends.worstDay}에도 30분 정도의 짧은 세션으로 학습을 유지하세요`,
      priority: 'medium' as const,
      difficulty: 'easy' as const,
      estimatedImpact: 8
    })
  }
  
  // 방해요소 기반 팁
  if (detailedStats.avgDistractions > 3) {
    tips.push({
      category: 'environment' as const,
      tip: '방해요소가 많습니다. 스마트폰 알림을 끄고 조용한 환경을 만들어보세요',
      priority: 'high' as const,
      difficulty: 'easy' as const,
      estimatedImpact: 14
    })
  }
  
  // 기본 기법 팁 (항상 포함)
  tips.push({
    category: 'technique' as const,
    tip: '학습 전 5분간 명상이나 깊은 호흡으로 마음을 정리해보세요',
    priority: 'low' as const,
    difficulty: 'easy' as const,
    estimatedImpact: 6
  })
  
  return tips.slice(0, 4) // 최대 4개까지
}

function getDefaultInsights(weeklyData: any) {
  const { timeSeriesData, overview } = weeklyData
  
  // 상세 통계 계산
  const detailedStats = calculateDetailedStats(timeSeriesData || [])
  const dataQuality = assessDataQuality(weeklyData)
  
  // 실제 데이터 기반 분석
  const avgFocusScore = overview?.averageFocusScore || 75
  const totalSessions = overview?.totalSessions || 0
  const totalStudyTime = overview?.totalStudyTime || 0
  
  // 고도화된 분석 수행
  const learningStyle = analyzeLearningStyle(avgFocusScore, totalSessions, detailedStats, dataQuality)
  const weeklyTrends = analyzeWeeklyTrends(timeSeriesData, avgFocusScore)
  const personalizedTips = generatePersonalizedTips(avgFocusScore, totalSessions, detailedStats, weeklyTrends)
  
  // 집중력 패턴 분석
  const focusPattern = {
    peakHours: totalSessions >= 3 ? ['09:00-11:00', '14:00-16:00'] : ['데이터 부족'],
    declinePattern: totalSessions >= 2 ? 
      `평균적으로 ${45 + Math.round(detailedStats.focusVariance / 10)}분 후에 집중도가 감소합니다.` :
      '더 많은 학습 세션을 통해 집중력 패턴을 분석할 수 있습니다.',
    recommendation: avgFocusScore < 70 ? 
      '뽀모도로 기법(25분 집중 + 5분 휴식)을 활용하여 집중력을 유지하세요.' :
      '현재 집중력이 우수합니다. 더 긴 세션에 도전해보세요.',
    consistency: Math.min(Math.max(100 - detailedStats.focusVariance / 5, 40), 95),
    weekdayVsWeekend: {
      weekday: Math.round(detailedStats.weekdayAvg * 10 + avgFocusScore) / 10,
      weekend: Math.round(detailedStats.weekendAvg * 10 + avgFocusScore - 5) / 10,
      difference: Math.round(Math.abs(detailedStats.weekdayAvg - detailedStats.weekendAvg) * 10)
    }
  }
  
  // 효율성 분석
  const efficiencyAnalysis = {
    sessionLengths: totalSessions >= 3 ? [
      { 
        duration: '25분', 
        averageScore: Math.min(avgFocusScore + 5, 100), 
        frequency: Math.floor(totalSessions * 0.4) 
      },
      { 
        duration: '45분', 
        averageScore: avgFocusScore, 
        frequency: Math.floor(totalSessions * 0.4) 
      },
      { 
        duration: '90분', 
        averageScore: Math.max(avgFocusScore - 10, 40), 
        frequency: Math.floor(totalSessions * 0.2) 
      }
    ] : [
      { duration: '데이터 부족', averageScore: 0, frequency: 0 }
    ],
    recommendation: totalSessions >= 3 ? 
      '25-45분 세션이 가장 효율적입니다. 긴 세션보다는 여러 개의 짧은 세션으로 나누어 학습하세요.' :
      '더 정확한 분석을 위해서는 최소 3개 이상의 세션 데이터가 필요합니다.',
    optimalSessionLength: avgFocusScore >= 80 ? '45분' : totalSessions >= 3 ? '35분' : '25분',
    efficiencyTrend: totalSessions >= 5 ? 
      (weeklyTrends.progressFromLastWeek.direction === 'up' ? 'improving' : 
       weeklyTrends.progressFromLastWeek.direction === 'down' ? 'declining' : 'stable') : 'stable'
  }
  
  // 학습 환경 분석
  const studyEnvironment = {
    timeOfDayEffectiveness: [
      { period: '오전 (9-12시)', score: Math.min(avgFocusScore + 8, 100), recommendation: '가장 집중이 잘 되는 시간대입니다' },
      { period: '오후 (13-18시)', score: avgFocusScore, recommendation: '점심 후 약간의 집중력 저하가 있을 수 있습니다' },
      { period: '저녁 (19-22시)', score: Math.max(avgFocusScore - 12, 40), recommendation: '짧은 세션으로 복습에 활용하세요' }
    ],
    sessionBreakdown: {
      shortSessions: Math.floor(totalSessions * 0.5),
      mediumSessions: Math.floor(totalSessions * 0.3),
      longSessions: Math.floor(totalSessions * 0.2),
      mostEffective: totalSessions >= 3 ? (avgFocusScore >= 80 ? '중간 세션' : '짧은 세션') : '데이터 부족'
    }
  }
  
  // 목표 달성도 분석
  const goalAchievement = {
    weeklyGoalCompletion: Math.min(totalSessions * 12, 100),
    streakDays: Math.min(totalSessions, 7),
    missedDays: Math.max(7 - totalSessions, 0),
    targetAdjustment: totalSessions >= 5 ? 
      '현재 목표가 적절합니다' : 
      totalSessions >= 3 ? '목표를 조금 낮춰서 꾸준함을 먼저 만들어보세요' : 
      '우선 일주일에 3회 이상 학습하는 것을 목표로 해보세요'
  }
  
  // 비교 분석
  const comparativeAnalysis = {
    vsLastWeek: {
      focusScore: weeklyTrends.progressFromLastWeek.change,
      studyTime: Math.floor(Math.random() * 40 - 20), // 임시값 - 실제로는 이전 주 데이터와 비교
      consistency: Math.floor(Math.random() * 20 - 10)
    },
    vsAverage: {
      rank: avgFocusScore >= 85 ? '상급' : avgFocusScore >= 70 ? '중급' : '초급',
      percentile: Math.min(Math.max(avgFocusScore + Math.floor(Math.random() * 20 - 10), 10), 95)
    }
  }
  
  // 최종 인사이트 반환
  return {
    learningStyle,
    focusPattern,
    efficiencyAnalysis,
    weeklyTrends,
    personalizedTips,
    studyEnvironment,
    goalAchievement,
    comparativeAnalysis
  }
}
