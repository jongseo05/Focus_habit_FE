import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// 완전 공개 함수 설정 - 모든 요청 허용
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "false",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0"
}

// 인증 체크 완전 비활성화
const isPublicFunction = true

// 모든 HTTP 메서드 허용
const allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"]

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Received request body:", body)
    
    const { code, device_id, device_type = "watch" } = body
    console.log("Extracted values:", { code, device_id, device_type })
    
    if (!code) {
      console.log("No code provided")
      return new Response(
        JSON.stringify({ error: "code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    if (code === "" || code.trim() === "") {
      console.log("Empty code provided")
      return new Response(
        JSON.stringify({ error: "code cannot be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Missing environment variables")
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 서비스 롤 클라이언트로 RLS 우회하여 데이터 접근
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const nowIso = new Date().toISOString()
    
    // 1) 코드 조회(미사용 + 미만료)
    const trimmedCode = String(code).trim()
    console.log("Searching for code:", trimmedCode)
    
    const { data: codeRow, error: codeErr } = await admin
      .from("watch_codes")
      .select("id, user_id, is_used, expires_at")
      .eq("code", trimmedCode)
      .eq("is_used", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    console.log("Code search result:", { codeRow, codeErr })

    if (codeErr?.code === "PGRST116" || !codeRow) {
      console.log("Code not found or expired")
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    if (codeErr) {
      console.error("code fetch error:", codeErr)
      return new Response(
        JSON.stringify({ error: "Failed to verify code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2) 코드 소진 처리
    console.log("Updating code to used:", codeRow.id)
    const { error: useErr } = await admin
      .from("watch_codes")
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq("id", codeRow.id)

    if (useErr) {
      console.error("code consume error:", useErr)
      return new Response(
        JSON.stringify({ error: "Failed to consume code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    console.log("Code successfully marked as used")

    // 3) (선택) 연결 등록/갱신
    if (device_id) {
      try {
        const { error: connErr } = await admin
          .from("watch_connections")
          .upsert({
            user_id: codeRow.user_id,
            device_id,
            device_type,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,device_id" })

        if (connErr) {
          console.warn("watch_connections upsert warn:", connErr)
        }
      } catch (connError) {
        console.warn("Connection registration failed:", connError)
        // 연결 실패는 치명적이지 않으므로 계속 진행
      }
    }

    // 4) JWT 없이 간단한 응답 반환
    return new Response(
      JSON.stringify({
        success: true,
        user_id: codeRow.user_id,
        message: "Code verified successfully",
        device_id: device_id,
        device_type: device_type
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    console.error("verify_code error:", e)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})