import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type) {
      return NextResponse.json(
        { error: '보상 타입이 필요합니다' },
        { status: 400 }
      )
    }

    if (type !== 'daily') {
      return NextResponse.json(
        { error: '지원하지 않는 보상 타입입니다' },
        { status: 400 }
      )
    }

    // 실제 구현에서는 사용자의 보상 상태를 확인하고 업데이트
    // 여기서는 mock 응답을 반환
    const mockReward = {
      type: 'daily',
      exp: Math.floor(Math.random() * 200) + 100, // 100-300 EXP
      level: 8,
      progress: Math.floor(Math.random() * 100),
      stickers: ["🌟", "🎯", "⚡", "🏆", "💎"].slice(0, Math.floor(Math.random() * 3) + 1),
      claimed: true,
      message: '일일 보상을 성공적으로 받았습니다!'
    }

    return NextResponse.json(mockReward)
  } catch (error) {
    console.error('Reward API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
} 