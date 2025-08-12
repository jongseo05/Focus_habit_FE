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
    const { 
      session_id, 
      heart_rate, 
      steps, 
      activity_level, 
      timestamp,
      device_type = 'watch'
    } = await req.json()
    
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Session ID is required' }),
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

    // 세션 유효성 확인
    const { data: session, error: sessionError } = await supabaseClient
      .from('focus_session')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive session' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 센서 데이터 저장
    const { error: insertError } = await supabaseClient
      .from('focus_samples')
      .insert({
        session_id: session_id,
        user_id: user.id,
        heart_rate: heart_rate || null,
        steps: steps || null,
        activity_level: activity_level || null,
        device_type: device_type,
        sample_timestamp: timestamp || new Date().toISOString(),
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Sensor data insertion error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to save sensor data' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // 집계 데이터 업데이트 (10초마다, 중복 방지)
    const sampleTime = new Date(timestamp || Date.now())
    const tenSecondsAgo = new Date(sampleTime.getTime() - 10000) // 10초로 변경
    
    // 최근 집계가 이미 있는지 확인
    const { data: existingAggregate } = await supabaseClient
      .from('focus_aggregates')
      .select('id')
      .eq('session_id', session_id)
      .gte('aggregate_start', tenSecondsAgo.toISOString())
      .lte('aggregate_end', sampleTime.toISOString())
      .limit(1)
      .single()

    // 집계가 없을 때만 새로 생성
    if (!existingAggregate) {
      try {
        // 최근 10초간의 데이터 집계
        const { data: recentSamples, error: aggregateError } = await supabaseClient
          .from('focus_samples')
          .select('heart_rate, activity_level')
          .eq('session_id', session_id)
          .gte('sample_timestamp', tenSecondsAgo.toISOString())
          .lte('sample_timestamp', sampleTime.toISOString())

        if (!aggregateError && recentSamples && recentSamples.length > 0) {
          // 평균 심박수 계산
          const validHeartRates = recentSamples
            .map(s => s.heart_rate)
            .filter(hr => hr !== null && hr > 0)
          
          const avgHeartRate = validHeartRates.length > 0 
            ? Math.round(validHeartRates.reduce((a, b) => a + b, 0) / validHeartRates.length)
            : null

          // 활동 수준 집계
          const activityCounts = recentSamples
            .map(s => s.activity_level)
            .filter(level => level !== null)
            .reduce((acc, level) => {
              acc[level] = (acc[level] || 0) + 1
              return acc
            }, {} as Record<string, number>)

          const dominantActivity = Object.keys(activityCounts).length > 0
            ? Object.entries(activityCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]
            : null

          // 집계 데이터 저장
          const { error: aggregateInsertError } = await supabaseClient
            .from('focus_aggregates')
            .insert({
              session_id: session_id,
              user_id: user.id,
              aggregate_start: tenSecondsAgo.toISOString(),
              aggregate_end: sampleTime.toISOString(),
              avg_heart_rate: avgHeartRate,
              dominant_activity: dominantActivity,
              sample_count: recentSamples.length,
              device_type: device_type
            })

          if (aggregateInsertError) {
            console.warn('Failed to insert aggregate data:', aggregateInsertError)
          }
        }
      } catch (aggregateError) {
        console.warn('Aggregate calculation failed:', aggregateError)
        // 집계 실패는 센서 데이터 저장에 영향을 주지 않음
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Sensor data ingested successfully',
        sample_count: 1,
        aggregated: !existingAggregate
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

