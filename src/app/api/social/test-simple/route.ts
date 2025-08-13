import { NextResponse } from 'next/server'

export async function GET() {
  console.log('=== 간단한 테스트 API 호출됨 ===')
  console.log('현재 시간:', new Date().toISOString())
  
  return NextResponse.json({ 
    message: '테스트 API가 정상 작동합니다',
    timestamp: new Date().toISOString()
  })
}
