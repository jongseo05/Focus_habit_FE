'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  BarChart3, 
  Calendar,
  ExternalLink,
  X,
  Sparkles
} from 'lucide-react'

interface SessionEndNotificationProps {
  isOpen: boolean
  onClose: () => void
  onViewReport: () => void
  sessionData: {
    duration: number // 분 단위
    averageFocusScore: number
    sampleCount: number
    eventCount: number
    mlFeatureCount: number
    sessionId: string
  }
}

export function SessionEndNotification({
  isOpen,
  onClose,
  onViewReport,
  sessionData
}: SessionEndNotificationProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  // 컴포넌트가 열릴 때 효과 재생
  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
      // 성공 사운드 재생 (브라우저 지원 시)
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2)
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
        
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.3)
      } catch (error) {
        // 사운드 재생 실패 시 조용히 처리
      }
      
      // 3초 후 컨페티 효과 제거
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return
      
      switch (event.key) {
        case 'Escape':
          handleClose()
          break
        case 'Enter':
          onViewReport()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onViewReport])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 200)
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}시간 ${mins}분`
    }
    return `${mins}분`
  }

  const getFocusScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getFocusScoreBadge = (score: number) => {
    if (score >= 80) return { text: '우수', color: 'bg-green-100 text-green-800' }
    if (score >= 60) return { text: '양호', color: 'bg-yellow-100 text-yellow-800' }
    return { text: '개선 필요', color: 'bg-red-100 text-red-800' }
  }

  const getMotivationalMessage = (score: number, duration: number) => {
    if (score >= 80 && duration >= 60) {
      return "완벽한 집중력이네요! 당신은 진정한 집중의 달인입니다! 🏆"
    } else if (score >= 80) {
      return "놀라운 집중도를 보여주셨네요! 더 오래 집중해보세요! 💪"
    } else if (duration >= 60) {
      return "긴 시간 집중하신 것 자체가 대단합니다! 집중도를 더 높여보세요! 📈"
    } else {
      return "좋은 시작입니다! 조금씩 개선해나가면 됩니다! 🌱"
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* 컨페티 효과 */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random() * 2}s`
              }}
            >
              <Sparkles className="h-4 w-4 text-yellow-400" />
            </div>
          ))}
        </div>
      )}

      <div className={`transform transition-all duration-300 ${
        isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}>
        <Card className="w-full max-w-md mx-4 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-3">
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-center mb-3">
              <div className="relative">
                <CheckCircle className="h-12 w-12 text-green-500 animate-pulse" />
                <div className="absolute inset-0 animate-ping">
                  <CheckCircle className="h-12 w-12 text-green-400" />
                </div>
              </div>
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">
              🎉 집중 세션 완료!
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {getMotivationalMessage(sessionData.averageFocusScore, sessionData.duration)}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 세션 요약 - 더 컴팩트하게 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                <div className="text-xs text-gray-600">집중 시간</div>
                <div className="text-base font-semibold text-blue-900">
                  {formatDuration(sessionData.duration)}
                </div>
              </div>
              
              <div className="text-center p-2 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                <div className="text-xs text-gray-600">평균 집중도</div>
                <div className="text-base font-semibold text-purple-900">
                  {sessionData.averageFocusScore}점
                </div>
              </div>
            </div>

            {/* 집중도 시각화 - 더 컴팩트하게 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">집중도</span>
                <Badge className={getFocusScoreBadge(sessionData.averageFocusScore).color}>
                  {getFocusScoreBadge(sessionData.averageFocusScore).text}
                </Badge>
              </div>
              <Progress 
                value={sessionData.averageFocusScore} 
                className="h-2"
              />
            </div>

            {/* 데이터 수집 현황 - 더 컴팩트하게 */}
            <div className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">수집된 데이터</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-sm font-semibold text-blue-600">
                    {sessionData.sampleCount}
                  </div>
                  <div className="text-xs text-gray-500">샘플</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-green-600">
                    {sessionData.eventCount}
                  </div>
                  <div className="text-xs text-gray-500">이벤트</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-purple-600">
                    {sessionData.mlFeatureCount}
                  </div>
                  <div className="text-xs text-gray-500">ML 피쳐</div>
                </div>
              </div>
            </div>

            {/* 액션 버튼들 */}
            <div className="space-y-2">
              <Button 
                onClick={onViewReport}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105 transition-transform"
              >
                <Calendar className="h-4 w-4 mr-2" />
                상세 리포트 보기
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="w-full hover:bg-gray-50"
              >
                닫기
              </Button>
            </div>

            {/* 세션 ID 및 단축키 안내 */}
            <div className="text-center space-y-1">
              <p className="text-xs text-gray-400">
                세션 ID: {sessionData.sessionId.slice(0, 8)}...
              </p>
              <p className="text-xs text-gray-400">
                ⌨️ Enter: 리포트 보기 | Esc: 닫기
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
