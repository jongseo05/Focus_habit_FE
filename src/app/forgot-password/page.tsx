"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Brain, Mail, ArrowLeft, Sparkles, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { resetPassword } from "@/lib/auth/auth"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await resetPassword(email)

      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error || "비밀번호 재설정 이메일 전송에 실패했습니다.")
      }
    } catch (err) {
      setError("오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 left-20 w-32 h-32 bg-blue-100 rounded-full opacity-20"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "0s",
          }}
        ></div>
        <div
          className="absolute bottom-20 right-20 w-24 h-24 bg-indigo-100 rounded-full opacity-30"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "2s",
          }}
        ></div>
        <div
          className="absolute top-1/2 left-10 w-16 h-16 bg-purple-100 rounded-full opacity-25"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "4s",
          }}
        ></div>
        <div
          className="absolute top-1/3 right-16 w-20 h-20 bg-blue-50 rounded-full opacity-40"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "1s",
          }}
        ></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center mb-8"
          >
            <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">FocusAI</span>
            </Link>

            <div className="space-y-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                비밀번호 재설정
              </Badge>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                비밀번호를{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  잊으셨나요?
                </span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">
                이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.
              </p>
            </div>
          </motion.div>

          {/* Reset Password Form */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                {/* Success Message */}
                {success ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-6"
                  >
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-slate-900">이메일을 확인해주세요</h3>
                      <p className="text-slate-600">
                        {email}로 비밀번호 재설정 링크를 보내드렸습니다.
                        <br />
                        이메일함을 확인해주세요.
                      </p>
                    </div>
                    <div className="pt-4">
                      <Link href="/login">
                        <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl">
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          로그인으로 돌아가기
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <>
                    {/* Error Message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"
                      >
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                      </motion.div>
                    )}

                    <form onSubmit={handleResetPassword} className="space-y-6">
                      {/* Email Field */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                          이메일 주소
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-12 h-14 bg-white border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 text-base"
                            required
                          />
                        </div>
                      </div>

                      {/* Reset Button */}
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            이메일 전송 중...
                          </div>
                        ) : (
                          "비밀번호 재설정 이메일 받기"
                        )}
                      </Button>
                    </form>

                    {/* Back to Login */}
                    <div className="text-center mt-6 pt-6 border-t border-slate-100">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        로그인으로 돌아가기
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-slate-500">
              문제가 계속 발생하시나요?{" "}
              <Link href="/contact" className="text-blue-600 hover:text-blue-700 transition-colors">
                고객지원
              </Link>
              에 문의해주세요.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes gentleFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  )
}
