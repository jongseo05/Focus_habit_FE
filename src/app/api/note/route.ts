import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { snapshotId, note } = body

    if (!snapshotId || typeof note !== 'string') {
      return NextResponse.json(
        { error: 'snapshotId와 note 파라미터가 필요합니다' },
        { status: 400 }
      )
    }

    // 실제 구현에서는 데이터베이스에 메모를 저장
    // 여기서는 성공 응답만 반환
    console.log(`Note saved for snapshot ${snapshotId}:`, note)

    return NextResponse.json({
      success: true,
      snapshotId,
      note,
      message: '메모가 성공적으로 저장되었습니다'
    })
  } catch (error) {
    console.error('Note API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
} 