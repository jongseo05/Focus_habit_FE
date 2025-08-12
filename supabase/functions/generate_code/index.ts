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
    console.log('generate_code function started')
    
    // 환경변수 확인
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    console.log('SUPABASE_URL:', supabaseUrl ? 'set' : 'not set')
    console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'set' : 'not set')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Supabase 클라이언트 생성
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    })

    console.log('Supabase client created')

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('User authenticated:', user.id)

    // 4자리 랜덤 코드 생성 (1000-9999)
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    console.log('Generated code:', code)
    
    try {
      // 기존 사용자의 코드가 있다면 먼저 삭제
      console.log('Deleting existing codes for user:', user.id)
      const { error: deleteError } = await supabaseClient
        .from('watch_codes')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        console.error('Delete existing code error:', deleteError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to delete existing code',
            details: deleteError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('Existing codes deleted successfully')

      // 새로운 코드를 데이터베이스에 저장 (24시간 유효)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      console.log('Inserting new code with expiry:', expiresAt)
      
      const { error: insertError } = await supabaseClient
        .from('watch_codes')
        .insert({
          user_id: user.id,
          code: code,
          expires_at: expiresAt,
          is_used: false
        })

      if (insertError) {
        console.error('Code insertion error:', insertError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to insert new code',
            details: insertError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      console.log('Code inserted successfully')

    } catch (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ 
          error: 'Database operation failed',
          details: dbError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Function completed successfully')
    return new Response(
      JSON.stringify({ code }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

