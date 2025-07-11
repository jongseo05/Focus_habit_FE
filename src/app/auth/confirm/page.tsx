"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Brain, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase/client"

function ConfirmContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token_hash = searchParams.get('token_hash')
        const type = searchParams.get('type')

        if (!token_hash || type !== 'email') {
          setStatus('error')
          setMessage('잘못된 인증 링크입니다.')
          return
        }

        const supabase = supabaseBrowser()
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash,
          type: 'email'
        })

        if (error) {
          setStatus('error')
          setMessage(error.message || '이메일 인증에 실패했습니다.')
          return
        }

        if (data.user) {
          setStatus('success')
          setMessage('이메일 인증이 완료되었습니다!')
          
          // 3초 후 대시보드로 리다이렉트
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        }
      } catch (err) {
        setStatus('error')
        setMessage('인증 처리 중 오류가 발생했습니다.')
      }
    }

    confirmEmail()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <Link href="/" className="inline-flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-slate-900">FocusAI</span>
              </Link>
            </div>

            {status === 'loading' && (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">이메일 인증 중...</h2>
                  <p className="text-slate-600">잠시만 기다려주세요.</p>
                </div>
              </div>
            )}

            {status === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">인증 완료!</h2>
                  <p className="text-slate-600 mb-4">{message}</p>
                  <p className="text-sm text-slate-500">3초 후 자동으로 대시보드로 이동합니다.</p>
                </div>
                <Button
                  onClick={() => router.push('/dashboard')}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  대시보드로 이동
                </Button>
              </motion.div>
            )}

            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">인증 실패</h2>
                  <p className="text-slate-600 mb-4">{message}</p>
                </div>
                <div className="space-y-2">
                  <Link href="/signup">
                    <Button variant="outline" className="w-full">
                      다시 회원가입
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                      로그인 페이지로
                    </Button>
                  </Link>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// Loading fallback component
function ConfirmFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <Link href="/" className="inline-flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-slate-900">FocusAI</span>
              </Link>
            </div>

            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">로딩 중...</h2>
                <p className="text-slate-600">잠시만 기다려주세요.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<ConfirmFallback />}>
      <ConfirmContent />
    </Suspense>
  )
}
