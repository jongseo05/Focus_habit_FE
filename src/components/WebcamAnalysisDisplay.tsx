"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { WebcamFrameAnalysisResult, FocusAnalysisFeatures } from '@/types/websocket'

interface WebcamAnalysisDisplayProps {
  analysisResult: WebcamFrameAnalysisResult | null
  focusFeatures: FocusAnalysisFeatures | null
  lastFocusScore: number
  isConnected: boolean
}

const WebcamAnalysisDisplay: React.FC<WebcamAnalysisDisplayProps> = ({
  analysisResult,
  focusFeatures,
  lastFocusScore,
  isConnected
}) => {
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)

  // 디버깅을 위한 로깅
  useEffect(() => {
    console.log('🎯 WebcamAnalysisDisplay props 업데이트:', {
      analysisResult: !!analysisResult,
      focusFeatures: !!focusFeatures,
      lastFocusScore,
      isConnected,
      timestamp: new Date().toISOString()
    })
  }, [analysisResult, focusFeatures, lastFocusScore, isConnected])

  useEffect(() => {
    if (analysisResult) {
      setLastUpdateTime(new Date())
      console.log('📊 웹캠 분석 결과 업데이트:', analysisResult)
    }
  }, [analysisResult])

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm font-medium">웹캠 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            웹소켓 연결 대기 중...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">웹캠 분석</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 집중도만 표시 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>집중도</span>
              <span className="font-medium">{Math.round(lastFocusScore)}%</span>
            </div>
            <Progress value={lastFocusScore} className="h-2" />
          </div>
          
          {lastUpdateTime && (
            <div className="text-xs text-muted-foreground">
              마지막 업데이트: {lastUpdateTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default WebcamAnalysisDisplay
