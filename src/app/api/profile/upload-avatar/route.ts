import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { 
  createSimpleSuccessResponse, 
  createSimpleErrorResponse, 
  requireAuth, 
  handleAPIError
} from '@/lib/api/standardResponse'

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // FormData에서 파일 추출
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return createSimpleErrorResponse('파일이 필요합니다.', 400)
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return createSimpleErrorResponse('지원하지 않는 파일 형식입니다.', 400)
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return createSimpleErrorResponse('파일 크기는 5MB를 초과할 수 없습니다.', 400)
    }

    // 파일명 생성 (사용자 ID + 타임스탬프 + 확장자)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExtension}`

    // 기존 프로필 이미지 삭제 (있는 경우)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single()

    if (existingProfile?.avatar_url) {
      // 기존 이미지 URL에서 파일 경로 추출
      const oldFilePath = existingProfile.avatar_url.split('/').pop()
      if (oldFilePath) {
        await supabase.storage
          .from('profile-images')
          .remove([`${user.id}/${oldFilePath}`])
      }
    }

    // 새 이미지 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('이미지 업로드 실패:', uploadError)
      return createSimpleErrorResponse('이미지 업로드에 실패했습니다.', 500)
    }

    // 업로드된 이미지의 공개 URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName)

    // 프로필 테이블에 이미지 URL 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('프로필 업데이트 실패:', updateError)
      return createSimpleErrorResponse('프로필 업데이트에 실패했습니다.', 500)
    }

    return createSimpleSuccessResponse({ 
      avatar_url: publicUrl
    }, '프로필 이미지가 성공적으로 업로드되었습니다.')

  } catch (error) {
    return handleAPIError(error, '프로필 이미지 업로드')
  }
}

// 이미지 삭제
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // 현재 프로필 이미지 URL 가져오기
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.avatar_url) {
      return createSimpleErrorResponse('삭제할 이미지가 없습니다.', 404)
    }

    // Storage에서 이미지 삭제
    const filePath = profile.avatar_url.split('/').pop()
    if (filePath) {
      const { error: deleteError } = await supabase.storage
        .from('profile-images')
        .remove([`${user.id}/${filePath}`])

      if (deleteError) {
        console.error('이미지 삭제 실패:', deleteError)
      }
    }

    // 프로필에서 이미지 URL 제거
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('프로필 업데이트 실패:', updateError)
      return createSimpleErrorResponse('프로필 업데이트에 실패했습니다.', 500)
    }

    return createSimpleSuccessResponse(
      { avatar_url: null }, 
      '프로필 이미지가 성공적으로 삭제되었습니다.'
    )

  } catch (error) {
    return handleAPIError(error, '프로필 이미지 삭제')
  }
}

