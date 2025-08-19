"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { motion } from "framer-motion"
import { Brain, Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/client"
import LoadingPage from "../../loading/page"

function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccessMessage("")

    // 비밀번호 유효성 검사
    if (formData.password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.")
      setIsLoading(false)
      return
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      setError("비밀번호는 대소문자와 숫자를 포함해야 합니다.")
      setIsLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      setIsLoading(false)
      return
    }

    try {
      // Supabase 비밀번호 재설정
      const supabase = supabaseBrowser()
      const { error: resetError } = await supabase.auth.updateUser({
        password: formData.password
      })

      if (resetError) {
        setError(resetError.message || "비밀번호 재설정에 실패했습니다.")
      } else {
        setSuccessMessage("비밀번호가 성공적으로 변경되었습니다!")
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err) {
      setError("비밀번호 재설정 중 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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
                새로운{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  비밀번호
                </span>
                를 설정하세요
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">안전한 계정을 위한 새로운 비밀번호를 입력해주세요</p>
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
                {successMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-700 text-sm">{successMessage}</span>
                  </motion.div>
                )}

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

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* New Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                      새 비밀번호
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="8자 이상, 대소문자, 숫자 포함"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        autoComplete="new-password"
                        className="pl-12 pr-12 h-14 bg-white border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 text-base"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      비밀번호는 8자 이상이며, 대소문자와 숫자를 포함해야 합니다.
                    </p>
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                      새 비밀번호 확인
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="비밀번호를 다시 입력하세요"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        autoComplete="new-password"
                        className="pl-12 pr-12 h-14 bg-white border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 text-base"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Reset Password Button */}
                  <Button
                    type="submit"
                    disabled={isLoading || !!successMessage}
                    className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  >
                    {successMessage ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5" />
                        로그인 페이지로 이동중...
                      </div>
                    ) : isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        비밀번호 변경 중...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        비밀번호 변경
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    )}
                  </Button>
                </form>

                {/* Back to Login */}
                <div className="text-center mt-8 pt-6 border-t border-slate-100">
                  <Link 
                    href="/login" 
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    로그인 페이지로 돌아가기
                  </Link>
                </div>
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
              비밀번호 재설정에 문제가 있으시면{" "}
              <Link href="/support" className="text-blue-600 hover:text-blue-700 transition-colors">
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingPage />}> 
      <ResetPasswordForm />
    </Suspense>
  )
}