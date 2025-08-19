// =====================================================
// 스터디룸 집중 세션 패널
// =====================================================

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, Square, Clock, Target, Brain } from 'lucide-react'
import { useStudyRoomContext } from '../core/StudyRoomProvider'
import { useStudyRoomFocusSession } from '@/hooks/useStudyRoomFocusSession'
import { useStudyRoomFocusSessionSync } from '@/hooks/useStudyRoomFocusSessionSync'
import { supabaseBrowser } from '@/lib/supabase/client'

interface FocusSessionPanelProps {
  onSessionComplete?: (sessionData: {
    duration: number
    focusScore: number
    sessionType: string
  }) => void
}

export function FocusSessionPanel({ onSessionComplete }: FocusSessionPanelProps) {
  const { userId, room, sendFocusUpdate, addNotification } = useStudyRoomContext()
  
  // 세션 설정
  const [goalMinutes, setGoalMinutes] = useState(25)
  const [sessionType, setSessionType] = useState<'study' | 'work' | 'reading'>('study')
  
  // 세션 상태
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  
  // 집중도 분석
  const {
    isAnalyzing,
    currentScore,
    averageScore,
    gestureData,
    audioData,
    startAnalysis,
    stopAnalysis,
    pauseAnalysis,
    resumeAnalysis
  } = useStudyRoomFocusSession({
    sessionId: currentSessionId || undefined,
    userId: userId || '',
    roomId: room?.room_id,
    onScoreUpdate: (score) => {
      sendFocusUpdate(score)
    },
    onError: (error) => {
      addNotification(`집중도 분석 오류: ${error}`, 'info')
    }
  })

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastScoreUpdate = useRef(0)

  // 세션 상태 동기화
  const { isInSync, forcSync } = useStudyRoomFocusSessionSync({
    sessionId: currentSessionId,
    currentScore,
    averageScore,
    isRunning,
    onSyncError: (error) => {
      addNotification(`동기화 오류: ${error}`, 'info')
    }
  })

  // 타이머 시작
  const startSession = useCallback(async () => {
    if (!userId || !room?.room_id) {
      addNotification('세션을 시작할 수 없습니다.', 'info')
      return
    }

    try {
      // 데이터베이스에 세션 생성
      const supabase = supabaseBrowser()
      
      const { data: session, error } = await supabase
        .from('focus_session')
        .insert({
          user_id: userId,
          room_id: room.room_id,
          started_at: new Date().toISOString(),
          goal_min: goalMinutes,
          session_type: sessionType,
          context_tag: 'study_room'
        })
        .select()
        .single()

      if (error || !session) {
        throw new Error(error?.message || '세션 생성에 실패했습니다.')
      }

      setCurrentSessionId(session.session_id)
      setIsRunning(true)
      setIsPaused(false)
      setElapsedTime(0)

      // 집중도 분석 시작
      startAnalysis()

      // 타이머 시작
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)

      addNotification('집중 세션이 시작되었습니다!', 'info')
    } catch (error) {
      console.error('세션 시작 실패:', error)
      addNotification(error instanceof Error ? error.message : '세션 시작에 실패했습니다.', 'info')
    }
  }, [userId, room?.room_id, goalMinutes, sessionType, startAnalysis, addNotification])

  // 세션 일시정지
  const pauseSession = useCallback(() => {
    setIsPaused(true)
    pauseAnalysis()
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    addNotification('세션이 일시정지되었습니다.', 'info')
  }, [pauseAnalysis, addNotification])

  // 세션 재개
  const resumeSession = useCallback(() => {
    setIsPaused(false)
    resumeAnalysis()
    
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
    
    addNotification('세션이 재개되었습니다.', 'info')
  }, [resumeAnalysis, addNotification])

  // 세션 종료
  const endSession = useCallback(async () => {
    if (!currentSessionId) return

    try {
      // 타이머 정지
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      // 집중도 분석 중지
      stopAnalysis()

      // 데이터베이스 업데이트
      const supabase = supabaseBrowser()
      
      const { error: updateError } = await supabase
        .from('focus_session')
        .update({
          ended_at: new Date().toISOString(),
          focus_score: averageScore,
          notes: `스터디룸 세션 (${room?.name || '알 수 없음'})`,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', currentSessionId)

      if (updateError) {
        console.error('세션 업데이트 실패:', updateError)
      }

      // 상태 초기화
      setIsRunning(false)
      setIsPaused(false)
      setCurrentSessionId(null)

      // 완료 콜백 호출
      if (onSessionComplete) {
        onSessionComplete({
          duration: elapsedTime,
          focusScore: averageScore,
          sessionType
        })
      }

      addNotification(`세션이 완료되었습니다! (${formatTime(elapsedTime)}, 평균 집중도: ${Math.round(averageScore)}점)`, 'info')
    } catch (error) {
      console.error('세션 종료 실패:', error)
      addNotification('세션 종료에 실패했습니다.', 'info')
    }
  }, [currentSessionId, elapsedTime, averageScore, sessionType, room?.name, stopAnalysis, onSessionComplete, addNotification])

  // 시간 포맷팅
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // 진행률 계산
  const progressPercentage = goalMinutes > 0 ? Math.min((elapsedTime / (goalMinutes * 60)) * 100, 100) : 0

  // 집중도 점수 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (isRunning) {
        stopAnalysis()
      }
    }
  }, [isRunning, stopAnalysis])

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          집중 세션
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 세션 설정 */}
        {!isRunning && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">목표 시간</label>
              <select
                value={goalMinutes}
                onChange={(e) => setGoalMinutes(Number(e.target.value))}
                className="w-full mt-1 p-2 border rounded-md"
              >
                <option value={15}>15분</option>
                <option value={25}>25분</option>
                <option value={45}>45분</option>
                <option value={60}>60분</option>
                <option value={90}>90분</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">세션 유형</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as 'study' | 'work' | 'reading')}
                className="w-full mt-1 p-2 border rounded-md"
              >
                <option value="study">학습</option>
                <option value="work">업무</option>
                <option value="reading">독서</option>
              </select>
            </div>
          </div>
        )}

        {/* 세션 진행 상태 */}
        {isRunning && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-mono font-bold">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-sm text-gray-500">
                목표: {goalMinutes}분
              </div>
            </div>

            <Progress value={progressPercentage} className="w-full" />

            {/* 실시간 집중도 */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-500">현재 집중도</div>
                <div className={`text-2xl font-bold ${getScoreColor(currentScore)}`}>
                  {Math.round(currentScore)}점
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">평균 집중도</div>
                <div className={`text-2xl font-bold ${getScoreColor(averageScore)}`}>
                  {Math.round(averageScore)}점
                </div>
              </div>
            </div>

            {/* 분석 상태 표시 */}
            <div className="flex justify-center gap-2 flex-wrap">
              {isAnalyzing && <Badge variant="secondary">집중도 분석 중</Badge>}
              {gestureData && <Badge variant="outline">제스처 인식</Badge>}
              {audioData && <Badge variant="outline">음성 분석</Badge>}
              {!isInSync && (
                <Badge variant="destructive" className="cursor-pointer" onClick={forcSync}>
                  동기화 필요
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* 컨트롤 버튼 */}
        <div className="flex gap-2 justify-center">
          {!isRunning ? (
            <Button onClick={startSession} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              세션 시작
            </Button>
          ) : (
            <>
              {!isPaused ? (
                <Button onClick={pauseSession} variant="outline" className="flex items-center gap-2">
                  <Pause className="h-4 w-4" />
                  일시정지
                </Button>
              ) : (
                <Button onClick={resumeSession} className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  재개
                </Button>
              )}
              <Button onClick={endSession} variant="destructive" className="flex items-center gap-2">
                <Square className="h-4 w-4" />
                종료
              </Button>
            </>
          )}
        </div>

        {/* 목표 달성 표시 */}
        {progressPercentage >= 100 && (
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-green-800 font-medium">🎉 목표 시간 달성!</div>
            <div className="text-sm text-green-600">원하시면 계속 진행하거나 세션을 종료할 수 있습니다.</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
