import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

// GET: 간단한 테스트 API
export async function GET() {
  console.log('=== 테스트 API 호출됨 ===')
  return NextResponse.json({ 
    message: '테스트 API가 정상 작동합니다',
    timestamp: new Date().toISOString()
  })
}

// POST: 간단한 테스트 API
export async function POST(request: NextRequest) {
  console.log('=== 테스트 POST API 호출됨 ===')
  
  try {
    const body = await request.json()
    console.log('받은 데이터:', body)
    
    return NextResponse.json({ 
      message: '테스트 POST API가 정상 작동합니다',
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('테스트 API 에러:', error)
    return NextResponse.json(
      { error: '테스트 API 에러' },
      { status: 500 }
    )
  }
}
