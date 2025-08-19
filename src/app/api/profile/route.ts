import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '../../../lib/supabase/server'
import { 
  createSimpleSuccessResponse, 
  createSimpleErrorResponse, 
  requireAuth, 
  handleAPIError
} from '../../../lib/api/standardResponse'

// GET: 사용자 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    // 사용자 프로필 정보 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('프로필 조회 실패:', profileError)
      return createSimpleErrorResponse('프로필을 불러오는데 실패했습니다.', 500)
    }

    // 프로필이 없으면 기본값으로 생성
    if (!profile) {
      // 사용자 번호 생성 (기존 사용자 수 + 1)
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      const userNumber = (count || 0) + 1
      const defaultProfile = {
        user_id: user.id,
        display_name: `사용자${userNumber}`,
        handle: `user${userNumber}`,
        avatar_url: null,
        bio: null,
        school: null,
        major: null,
        status: 'online',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert(defaultProfile)
        .select()
        .single()

      if (createError) {
        console.error('기본 프로필 생성 실패:', createError)
        return createSimpleErrorResponse('프로필 생성에 실패했습니다.', 500)
      }

      return createSimpleSuccessResponse(newProfile, '기본 프로필이 생성되었습니다.')
    }

    return createSimpleSuccessResponse(profile, '프로필을 성공적으로 조회했습니다.')

  } catch (error) {
    return handleAPIError(error, '프로필 조회')
  }
}

// PUT: 프로필 정보 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 인증 확인
    const authResult = await requireAuth(supabase)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user } = authResult

    const body = await request.json()
    const { display_name, handle, avatar_url, bio, school, major } = body

    // 필수 필드 검증
    if (!display_name || !handle) {
      return createSimpleErrorResponse('표시 이름과 핸들은 필수입니다.', 400)
    }

    // 업데이트할 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (display_name !== undefined) updateData.display_name = display_name
    if (handle !== undefined) updateData.handle = handle
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url
    if (bio !== undefined) updateData.bio = bio
    if (school !== undefined) updateData.school = school
    if (major !== undefined) updateData.major = major

    // 프로필 업데이트
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        user_id: user.id,
        ...updateData
      })
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('프로필 업데이트 실패:', updateError)
      return createSimpleErrorResponse('프로필 업데이트에 실패했습니다.', 500)
    }

    return createSimpleSuccessResponse(updatedProfile, '프로필이 성공적으로 업데이트되었습니다.')

  } catch (error) {
    return handleAPIError(error, '프로필 업데이트')
  }
}
