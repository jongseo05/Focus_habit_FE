'use client'

import React from 'react'
import { useGestureRecognition } from '@/hooks/useGestureRecognition'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function GestureRecognitionTest() {
  const {
    // 카메라 상태
    isVideoReady,
    isCameraError,
    cameraError,
    
    // 스트리밍 상태
    isStreaming,
    framesSent,
    
    // 제스처 인식 결과
    currentGesture,
    lastGestureTime,
    gestureHistory,
    
    // 제어 함수
    startCamera,
    stopCamera,
    startStreaming,
    stopStreaming,
    setFrameRate,
    
    // 참조
    videoRef
  } = useGestureRecognition({
    frameRate: 10,
    autoStart: false
  })

  const handleFrameRateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fps = parseInt(event.target.value)
    if (fps > 0 && fps <= 30) {
      setFrameRate(fps)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">실시간 제스처 인식</h1>
        <div className="flex gap-2">
          <Badge variant={isVideoReady ? 'default' : 'secondary'}>
            카메라: {isVideoReady ? '준비됨' : '대기중'}
          </Badge>
          <Badge variant={isStreaming ? 'default' : 'secondary'}>
            스트리밍: {isStreaming ? '진행중' : '중지됨'}
          </Badge>
        </div>
      </div>

      {/* 카메라 피드 */}
      <Card>
        <CardHeader>
          <CardTitle>카메라 피드</CardTitle>
          <CardDescription>
            실시간 카메라 영상 - 초당 10프레임으로 제스처 분석을 위해 전송됩니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-w-full h-auto border rounded-lg"
              style={{ 
                maxWidth: '640px', 
                maxHeight: '480px',
                transform: 'scaleX(-1)' // 화면 표시도 좌우반전
              }}
            />
          </div>
          
          {isCameraError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              <p><strong>카메라 오류:</strong> {cameraError}</p>
            </div>
          )}
          
          <div className="flex gap-2 justify-center">
            <Button onClick={startCamera} disabled={isVideoReady}>
              카메라 시작
            </Button>
            <Button onClick={stopCamera} disabled={!isVideoReady} variant="destructive">
              카메라 중지
            </Button>
            <Button 
              onClick={startStreaming} 
              disabled={!isVideoReady || isStreaming}
              variant="outline"
            >
              제스처 분석 시작
            </Button>
            <Button 
              onClick={stopStreaming} 
              disabled={!isStreaming}
              variant="outline"
            >
              제스처 분석 중지
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 스트리밍 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>스트리밍 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="frameRate">프레임 레이트 (FPS):</Label>
            <Input
              id="frameRate"
              type="number"
              min="1"
              max="30"
              defaultValue="10"
              onChange={handleFrameRateChange}
              className="w-20"
            />
            <span className="text-sm text-gray-600">전송된 프레임: {framesSent}개</span>
          </div>
        </CardContent>
      </Card>

      {/* 현재 제스처 */}
      <Card>
        <CardHeader>
          <CardTitle>현재 제스처 인식 결과</CardTitle>
        </CardHeader>
        <CardContent>
          {currentGesture ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-lg px-4 py-2">
                  {currentGesture}
                </Badge>
                <span className="text-sm text-gray-500">
                  {lastGestureTime ? new Date(lastGestureTime).toLocaleTimeString() : ''}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">제스처가 인식되지 않았습니다</p>
          )}
        </CardContent>
      </Card>

      {/* 제스처 히스토리 */}
      <Card>
        <CardHeader>
          <CardTitle>제스처 히스토리 (최근 10개)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-auto">
            {gestureHistory.slice(0, 10).length > 0 ? (
              gestureHistory.slice(0, 10).map((item, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <Badge variant="outline">{item.gesture}</Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500">제스처 히스토리가 없습니다</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 기술 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>기술 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>WebSocket URL:</strong> {process.env.NEXT_PUBLIC_WEBSOCKET_URL}</p>
          <p><strong>전송 형식:</strong> 순수 Base64 JPEG 문자열 (접두사 없음)</p>
          <p><strong>프레임 레이트:</strong> 초당 10프레임 (조정 가능)</p>
          <p><strong>해상도:</strong> 최대 640x480px</p>
          <p><strong>응답 형식:</strong> {`{ "gesture": "thumbs_up", "timestamp": "2024-01-01T12:00:00.000Z" }`}</p>
          <div className="mt-4 p-3 bg-blue-50 rounded border">
            <p className="font-semibold">백엔드 처리 과정:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
              <li>Base64 문자열 수신</li>
              <li>Base64 → 바이트 → NumPy 배열 변환</li>
              <li>BGR → RGB 색상 변환</li>
              <li>MediaPipe를 통한 제스처 분석</li>
              <li>JSON 형태로 결과 전송</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
