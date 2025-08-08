import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 요청 본문 파싱
    const { code } = await req.json()
    
    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Code is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Supabase 클라이언트 생성
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // 코드 검증
    const { data: codeData, error: codeError } = await supabaseClient
      .from('watch_codes')
      .select('*')
      .eq('code', code)
      .eq('is_used', false)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (codeError || !codeData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired code' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(codeData.user_id)
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 코드 사용 처리
    await supabaseClient
      .from('watch_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', codeData.id)

    // 워치용 JWT 토큰 생성 (24시간 유효)
    const { data: tokenData, error: tokenError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
      options: {
        redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/callback`,
      }
    })

    if (tokenError) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate token' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 워치 연결 정보 저장
    await supabaseClient
      .from('watch_connections')
      .upsert({
        user_id: codeData.user_id,
        watch_id: `watch_${Date.now()}`, // 임시 워치 ID
        connected_at: new Date().toISOString(),
        is_active: true
      })

    return new Response(
      JSON.stringify({ 
        jwt: tokenData.properties.access_token,
        user_id: codeData.user_id,
        message: 'Code verified successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

