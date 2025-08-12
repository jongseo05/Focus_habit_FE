// AI 모델 기반 집중도 점수 계산 엔진

export interface FocusFeatures {
  // 시각적 지표
  visual?: {
    eyeStatus: 'OPEN' | 'CLOSED' | 'PARTIAL'
    earValue: number // 0.1 ~ 0.5 (눈이 열려있을수록 높음)
    headPose: {
      pitch: number // -20° ~ +20°
      yaw: number   // -30° ~ +30°
      roll: number  // -10° ~ +10°
    }
    gazeDirection: 'FORWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
  }
  
  // 청각적 지표
  audio?: {
    isSpeaking: boolean
    speechContent: string
    isStudyRelated: boolean
    confidence: number // 0.0 ~ 1.0
    audioLevel: number // 0 ~ 100
  }
  
  // 행동 지표
  behavior?: {
    mouseActivity: boolean
    keyboardActivity: boolean
    tabSwitches: number
    idleTime: number // 초 단위
  }
  
  // 시간 지표
  time?: {
    sessionDuration: number // 분 단위
    lastBreakTime: number // 분 단위
    consecutiveFocusTime: number // 분 단위
  }
}

// 집중 상태 타입 정의
export type FocusStatus = 'focused' | 'normal' | 'distracted'

// 집중 상태 판단 결과
export interface FocusStatusResult {
  status: FocusStatus
  confidence: number
  score: number
  factors: {
    eyeFactor: number
    headPoseFactor: number
    audioFactor: number
    behaviorFactor: number
  }
}

// 집중 상태 판단 함수
export function determineFocusStatus(features: FocusFeatures): FocusStatusResult {
  let totalScore = 0
  let totalConfidence = 0
  let factorCount = 0
  
  const factors = {
    eyeFactor: 0,
    headPoseFactor: 0,
    audioFactor: 0,
    behaviorFactor: 0
  }

  // 1. 시각적 지표 분석 (눈 상태, 머리 자세)
  if (features.visual) {
    const { eyeStatus, earValue, headPose } = features.visual
    
    // 눈 상태 분석
    let eyeScore = 0
    let eyeConfidence = 0.5
    
    if (eyeStatus === 'OPEN') {
      eyeScore = 80 + (earValue * 40) // 80-100점
      eyeConfidence = 0.8
    } else if (eyeStatus === 'PARTIAL') {
      eyeScore = 40 + (earValue * 40) // 40-80점
      eyeConfidence = 0.6
    } else if (eyeStatus === 'CLOSED') {
      eyeScore = 0 + (earValue * 20) // 0-20점
      eyeConfidence = 0.9
    }
    
    factors.eyeFactor = eyeScore
    
    // 머리 자세 분석
    let headPoseScore = 100
    let headPoseConfidence = 0.7
    
    // 머리가 너무 많이 기울어지면 점수 감점
    const pitchDeviation = Math.abs(headPose.pitch)
    const yawDeviation = Math.abs(headPose.yaw)
    const rollDeviation = Math.abs(headPose.roll)
    
    if (pitchDeviation > 15) headPoseScore -= 30
    if (yawDeviation > 25) headPoseScore -= 30
    if (rollDeviation > 8) headPoseScore -= 20
    
    factors.headPoseFactor = Math.max(0, headPoseScore)
    
    // 시각적 지표 종합 점수
    const visualScore = (eyeScore + headPoseScore) / 2
    const visualConfidence = (eyeConfidence + headPoseConfidence) / 2
    
    totalScore += visualScore
    totalConfidence += visualConfidence
    factorCount++
  }

  // 2. 청각적 지표 분석
  if (features.audio) {
    const { isStudyRelated, confidence, audioLevel } = features.audio
    
    let audioScore = 50 // 기본값
    let audioConfidence = confidence || 0.5
    
    if (isStudyRelated) {
      audioScore = 80 + (confidence * 20) // 80-100점
    } else {
      audioScore = 20 + (confidence * 30) // 20-50점
    }
    
    // 조용한 환경이면 점수 가산
    if (audioLevel < 30) {
      audioScore += 10
    }
    
    factors.audioFactor = Math.min(100, audioScore)
    totalScore += audioScore
    totalConfidence += audioConfidence
    factorCount++
  }

  // 3. 행동 지표 분석
  if (features.behavior) {
    const { mouseActivity, keyboardActivity, tabSwitches, idleTime } = features.behavior
    
    let behaviorScore = 50 // 기본값
    let behaviorConfidence = 0.6
    
    // 마우스/키보드 활동이 있으면 점수 가산
    if (mouseActivity || keyboardActivity) {
      behaviorScore += 20
    }
    
    // 탭 전환이 적으면 점수 가산
    if (tabSwitches < 3) {
      behaviorScore += 15
    } else {
      behaviorScore -= (tabSwitches - 2) * 5
    }
    
    // 유휴 시간이 적으면 점수 가산
    if (idleTime < 60) { // 1분 미만
      behaviorScore += 15
    } else {
      behaviorScore -= Math.min(30, idleTime / 60 * 5)
    }
    
    factors.behaviorFactor = Math.max(0, Math.min(100, behaviorScore))
    totalScore += behaviorScore
    totalConfidence += behaviorConfidence
    factorCount++
  }

  // 4. 시간 지표 분석
  if (features.time) {
    const { sessionDuration, consecutiveFocusTime } = features.time
    
    let timeScore = 50 // 기본값
    let timeConfidence = 0.7
    
    // 연속 집중 시간이 길면 점수 가산
    if (consecutiveFocusTime > 30) { // 30분 이상
      timeScore += 20
    } else if (consecutiveFocusTime > 15) { // 15분 이상
      timeScore += 10
    }
    
    totalScore += timeScore
    totalConfidence += timeConfidence
    factorCount++
  }

  // 최종 점수 계산
  const finalScore = factorCount > 0 ? Math.round(totalScore / factorCount) : 50
  const finalConfidence = factorCount > 0 ? totalConfidence / factorCount : 0.5

  // 집중 상태 판단
  let status: FocusStatus = 'normal'
  if (finalScore >= 75) {
    status = 'focused'
  } else if (finalScore <= 35) {
    status = 'distracted'
  }

  return {
    status,
    confidence: finalConfidence,
    score: finalScore,
    factors
  }
}

export interface FocusScoreResult {
  score: number // 0-100
  confidence: number // 0.0-1.0
  breakdown: {
    visual: number
    audio: number
    behavior: number
    time: number
  }
  analysis: {
    primaryFactor: string
    secondaryFactor: string
    recommendations: string[]
  }
}

export class FocusScoreEngine {
  private static readonly WEIGHTS = {
    visual: 0.35,    // 시각적 지표 (35%)
    audio: 0.30,     // 청각적 지표 (30%)
    behavior: 0.25,  // 행동 지표 (25%)
    time: 0.10       // 시간 지표 (10%)
  }

  /**
   * AI 모델 기반 집중도 점수 계산
   */
  static calculateFocusScore(features: FocusFeatures): FocusScoreResult {
    const scores = {
      visual: this.calculateVisualScore(features.visual),
      audio: this.calculateAudioScore(features.audio),
      behavior: this.calculateBehaviorScore(features.behavior),
      time: this.calculateTimeScore(features.time)
    }

    // 가중 평균으로 최종 점수 계산
    const finalScore = Math.round(
      scores.visual * this.WEIGHTS.visual +
      scores.audio * this.WEIGHTS.audio +
      scores.behavior * this.WEIGHTS.behavior +
      scores.time * this.WEIGHTS.time
    )

    // 신뢰도 계산
    const confidence = this.calculateConfidence(features)

    // 분석 결과 생성
    const analysis = this.generateAnalysis(scores, features)

    return {
      score: Math.max(0, Math.min(100, finalScore)),
      confidence,
      breakdown: scores,
      analysis
    }
  }

  /**
   * 시각적 집중도 점수 계산 (0-100)
   */
  private static calculateVisualScore(visual?: FocusFeatures['visual']): number {
    if (!visual) return 50 // 기본값

    let score = 50

    // 눈 상태 기반 점수 (0-40점)
    switch (visual.eyeStatus) {
      case 'OPEN':
        score += 40
        break
      case 'PARTIAL':
        score += 20
        break
      case 'CLOSED':
        score += 0
        break
    }

    // EAR 값 기반 점수 (0-20점)
    if (visual.earValue >= 0.3) {
      score += 20 // 눈이 잘 열려있음
    } else if (visual.earValue >= 0.2) {
      score += 10 // 눈이 부분적으로 열려있음
    }

    // 머리 자세 기반 점수 (0-20점)
    const headPoseScore = this.calculateHeadPoseScore(visual.headPose)
    score += headPoseScore

    // 시선 방향 기반 점수 (0-20점)
    const gazeScore = this.calculateGazeScore(visual.gazeDirection)
    score += gazeScore

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 머리 자세 점수 계산
   */
  private static calculateHeadPoseScore(headPose: FocusFeatures['visual']['headPose']): number {
    let score = 20

    // 각도가 클수록 점수 감소
    const pitchDeviation = Math.abs(headPose.pitch)
    const yawDeviation = Math.abs(headPose.yaw)
    const rollDeviation = Math.abs(headPose.roll)

    if (pitchDeviation > 15) score -= 5
    if (yawDeviation > 20) score -= 5
    if (rollDeviation > 8) score -= 5

    return Math.max(0, score)
  }

  /**
   * 시선 방향 점수 계산
   */
  private static calculateGazeScore(gazeDirection: string): number {
    switch (gazeDirection) {
      case 'FORWARD':
        return 20 // 정면 응시
      case 'UP':
      case 'DOWN':
        return 15 // 위아래로 보는 것은 학습 활동일 수 있음
      case 'LEFT':
      case 'RIGHT':
        return 10 // 좌우로 보는 것은 방해 요소일 가능성
      default:
        return 10
    }
  }

  /**
   * 청각적 집중도 점수 계산 (0-100)
   */
  private static calculateAudioScore(audio?: FocusFeatures['audio']): number {
    if (!audio) return 50 // 기본값

    let score = 50

    // 발화 여부 기반 점수
    if (audio.isSpeaking) {
      if (audio.isStudyRelated) {
        score += 30 // 학습 관련 발화
      } else {
        score -= 20 // 학습과 무관한 발화
      }
    } else {
      score += 10 // 조용함 (집중 상태일 가능성)
    }

    // 신뢰도 기반 점수 조정
    const confidenceAdjustment = (audio.confidence - 0.5) * 20
    score += confidenceAdjustment

    // 오디오 레벨 기반 점수 (너무 크거나 작으면 감점)
    if (audio.audioLevel > 80) {
      score -= 15 // 너무 시끄러움
    } else if (audio.audioLevel < 10) {
      score += 5 // 적당한 조용함
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 행동 기반 집중도 점수 계산 (0-100)
   */
  private static calculateBehaviorScore(behavior?: FocusFeatures['behavior']): number {
    if (!behavior) return 50 // 기본값

    let score = 50

    // 마우스/키보드 활동 기반 점수
    if (behavior.mouseActivity || behavior.keyboardActivity) {
      score += 25 // 활동적 (집중 상태일 가능성)
    } else {
      score -= 15 // 비활동적 (집중하지 않을 가능성)
    }

    // 탭 전환 기반 점수
    if (behavior.tabSwitches === 0) {
      score += 20 // 탭 전환 없음 (집중 상태)
    } else if (behavior.tabSwitches <= 2) {
      score += 10 // 적은 탭 전환
    } else {
      score -= 20 // 과도한 탭 전환
    }

    // 유휴 시간 기반 점수
    if (behavior.idleTime < 30) {
      score += 20 // 30초 미만 유휴
    } else if (behavior.idleTime < 120) {
      score += 10 // 2분 미만 유휴
    } else {
      score -= 20 // 2분 이상 유휴
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 시간 기반 집중도 점수 계산 (0-100)
   */
  private static calculateTimeScore(time?: FocusFeatures['time']): number {
    if (!time) return 50 // 기본값

    let score = 50

    // 세션 지속시간 기반 점수
    if (time.sessionDuration >= 60) {
      score += 20 // 1시간 이상 지속
    } else if (time.sessionDuration >= 30) {
      score += 15 // 30분 이상 지속
    } else if (time.sessionDuration >= 15) {
      score += 10 // 15분 이상 지속
    }

    // 마지막 휴식 시간 기반 점수
    if (time.lastBreakTime >= 60) {
      score += 15 // 1시간 이상 휴식 없음
    } else if (time.lastBreakTime >= 30) {
      score += 10 // 30분 이상 휴식 없음
    }

    // 연속 집중 시간 기반 점수
    if (time.consecutiveFocusTime >= 45) {
      score += 15 // 45분 이상 연속 집중
    } else if (time.consecutiveFocusTime >= 25) {
      score += 10 // 25분 이상 연속 집중
    }

    return Math.max(0, Math.min(100, score))
  }

  /**
   * 전체 신뢰도 계산
   */
  private static calculateConfidence(features: FocusFeatures): number {
    let confidence = 0.5
    let factorCount = 0

    if (features.visual) {
      confidence += 0.2
      factorCount++
    }
    if (features.audio) {
      confidence += 0.2
      factorCount++
    }
    if (features.behavior) {
      confidence += 0.15
      factorCount++
    }
    if (features.time) {
      confidence += 0.1
      factorCount++
    }

    // 데이터가 많을수록 신뢰도 증가
    if (factorCount > 0) {
      confidence += (factorCount - 1) * 0.05
    }

    return Math.min(1.0, confidence)
  }

  /**
   * 분석 결과 생성
   */
  private static generateAnalysis(
    scores: FocusScoreResult['breakdown'], 
    features: FocusFeatures
  ): FocusScoreResult['analysis'] {
    const factors = [
      { name: '시각적 집중도', score: scores.visual, key: 'visual' },
      { name: '청각적 집중도', score: scores.audio, key: 'audio' },
      { name: '행동 패턴', score: scores.behavior, key: 'behavior' },
      { name: '시간 관리', score: scores.time, key: 'time' }
    ]

    // 점수 순으로 정렬
    factors.sort((a, b) => b.score - a.score)

    const primaryFactor = factors[0].name
    const secondaryFactor = factors[1].name

    // 권장사항 생성
    const recommendations: string[] = []
    
    if (scores.visual < 60) {
      recommendations.push('자세를 바르게 하고 화면을 정면으로 응시하세요')
    }
    if (scores.audio < 60) {
      recommendations.push('학습과 관련된 내용으로 대화를 유지하세요')
    }
    if (scores.behavior < 60) {
      recommendations.push('불필요한 탭 전환을 줄이고 작업에 집중하세요')
    }
    if (scores.time < 60) {
      recommendations.push('적절한 휴식과 함께 지속적인 집중을 유지하세요')
    }

    if (recommendations.length === 0) {
      recommendations.push('현재 상태가 양호합니다. 이대로 유지하세요!')
    }

    return {
      primaryFactor,
      secondaryFactor,
      recommendations
    }
  }

  /**
   * 실시간 집중도 모니터링을 위한 점수 추적
   */
  static trackFocusScore(sessionId: string, features: FocusFeatures): Promise<FocusScoreResult> {
    return new Promise(async (resolve) => {
      try {
        // 집중도 점수 계산
        const result = this.calculateFocusScore(features)
        
        // 데이터베이스에 저장
        const response = await fetch('/api/focus-score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            focusScore: result.score,
            timestamp: new Date().toISOString(),
            confidence: result.confidence,
            analysisMethod: 'ai_engine',
            features
          })
        })

        if (response.ok) {
          console.log('✅ 집중도 점수 저장 성공:', result.score)
        } else {
          console.warn('⚠️ 집중도 점수 저장 실패:', response.status)
        }

        resolve(result)
      } catch (error) {
        console.error('❌ 집중도 점수 추적 실패:', error)
        resolve(this.calculateFocusScore(features)) // 계산된 점수라도 반환
      }
    })
  }
}
