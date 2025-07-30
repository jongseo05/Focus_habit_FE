import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪 테스트 API 호출됨')
  
  return NextResponse.json({
    message: '테스트 API가 정상 작동합니다',
    timestamp: new Date().toISOString()
  })
} 