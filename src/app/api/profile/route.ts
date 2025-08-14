import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// GET: 사용자 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 사용자 프로필 정보 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('프로필 조회 실패:', profileError)
      return NextResponse.json(
        { error: '프로필을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
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
        return NextResponse.json(
          { error: '프로필 생성에 실패했습니다.' },
          { status: 500 }
        )
      }

      return NextResponse.json(newProfile)
    }

    return NextResponse.json(profile)

  } catch (error) {
    console.error('프로필 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT: 프로필 정보 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await supabaseServer()
    
    // 현재 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { display_name, handle, avatar_url, bio, school, major } = body

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
      return NextResponse.json(
        { error: '프로필 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedProfile)

  } catch (error) {
    console.error('프로필 업데이트 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
