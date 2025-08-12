import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { routineId, enabled } = body

    if (!routineId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'routineId와 enabled 파라미터가 필요합니다' },
        { status: 400 }
      )
    }

    // 실제 구현에서는 데이터베이스에서 루틴 상태를 업데이트
    // 여기서는 성공 응답만 반환
    console.log(`Routine ${routineId} ${enabled ? 'enabled' : 'disabled'}`)

    return NextResponse.json({
      success: true,
      routineId,
      enabled,
      message: `루틴이 ${enabled ? '활성화' : '비활성화'}되었습니다`
    })
  } catch (error) {
    console.error('Routine API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
} 