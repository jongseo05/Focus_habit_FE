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
    // Supabase 클라이언트 생성
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 4자리 랜덤 코드 생성 (1000-9999)
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    
    // 임시로 데이터베이스 저장 없이 코드만 반환 (테스트용)
    try {
      // 코드를 데이터베이스에 저장 (24시간 유효)
      const { error: insertError } = await supabaseClient
        .from('watch_codes')
        .insert({
          user_id: user.id,
          code: code,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24시간 후
          is_used: false
        })

      if (insertError) {
        console.error('Code insertion error:', insertError)
        // 테스트를 위해 에러가 있어도 코드는 반환
        return new Response(
          JSON.stringify({ 
            code,
            warning: 'Database error, but code generated',
            details: insertError.message 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      // 테스트를 위해 에러가 있어도 코드는 반환
      return new Response(
        JSON.stringify({ 
          code,
          warning: 'Database error, but code generated',
          details: dbError.message 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ code }),
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

