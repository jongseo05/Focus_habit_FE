'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestApiPage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const testApi = async (endpoint: string, method: string = 'GET', body?: any) => {
    setLoading(true)
    const startTime = new Date()
    
    try {
      console.log(`테스트 시작: ${method} ${endpoint}`)
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      }
      
      if (body) {
        options.body = JSON.stringify(body)
      }
      
      const response = await fetch(endpoint, options)
      const data = await response.json()
      
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()
      
      const result = {
        endpoint,
        method,
        status: response.status,
        duration: `${duration}ms`,
        data,
        timestamp: new Date().toISOString()
      }
      
      console.log('테스트 결과:', result)
      setResults(prev => [result, ...prev])
      
    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()
      
      const result = {
        endpoint,
        method,
        status: 'ERROR',
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }
      
      console.error('테스트 에러:', result)
      setResults(prev => [result, ...prev])
    } finally {
      setLoading(false)
    }
  }

  const testStudyRoomDebug = () => {
    testApi('/api/social/study-room-debug', 'POST', {
      name: '테스트 룸',
      description: 'API 테스트용 룸',
      max_participants: 5,
      session_type: 'study',
      goal_minutes: 60
    })
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">API 테스트 페이지</h1>
      
      <div className="grid gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>기본 테스트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              onClick={() => testApi('/api/social/test')}
              disabled={loading}
            >
              기본 API 테스트
            </Button>
            <Button 
              onClick={() => testApi('/api/social/test-supabase')}
              disabled={loading}
            >
              Supabase 연결 테스트
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>스터디룸 생성 테스트</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testStudyRoomDebug}
              disabled={loading}
            >
              스터디룸 생성 디버그 테스트
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>테스트 결과</CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-gray-500">테스트를 실행해보세요</p>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      result.status === 200 ? 'bg-green-100 text-green-800' :
                      result.status === 'ERROR' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {result.status}
                    </span>
                    <span className="text-sm text-gray-500">{result.duration}</span>
                    <span className="text-sm text-gray-500">{result.method}</span>
                    <span className="text-sm font-mono">{result.endpoint}</span>
                  </div>
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(result.data || result.error, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
