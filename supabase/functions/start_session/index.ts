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

    // 요청 본문 파싱
    const { device_type = 'web' } = await req.json()

    // 현재 활성 세션이 있는지 확인 (30분 이내)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: existingSession, error: sessionError } = await supabaseClient
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116는 결과가 없는 경우
      console.error('Session query error:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing session' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let sessionId: string

    if (existingSession) {
      // 기존 세션 재사용
      sessionId = existingSession.id
      console.log('Reusing existing session:', sessionId)
    } else {
      // 새 세션 생성
      const { data: newSession, error: createError } = await supabaseClient
        .from('focus_sessions')
        .insert({
          user_id: user.id,
          status: 'active',
          device_type: device_type,
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('Session creation error:', createError)
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      sessionId = newSession.id
      console.log('Created new session:', sessionId)
    }

    return new Response(
      JSON.stringify({ 
        session_id: sessionId,
        is_new: !existingSession,
        message: existingSession ? 'Session reused' : 'Session created'
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

