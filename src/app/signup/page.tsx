"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { motion } from "framer-motion"
import { Brain, Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signUp } from "@/lib/auth/auth"
import { validateSignUpForm } from "@/lib/auth/validation"
import type { SignUpFormData } from "@/types/user"
import LoadingPage from "../loading/page"

function SignUpForm() {
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})
    setSuccessMessage("")

    // 폼 유효성 검사
    const validation = validateSignUpForm(formData)
    
    if (!validation.isValid) {
      setErrors(validation.errors)
      setIsLoading(false)
      return
    }

    try {
      console.log('🚀 회원가입 시작:', {
        name: formData.name,
        email: formData.email,
        hasPassword: !!formData.password,
        confirmPasswordMatch: formData.password === formData.confirmPassword
      })

      // Supabase 회원가입 실행
      const result = await signUp(formData as SignUpFormData)

      if (result.success) {
        console.log('🎉 회원가입 성공:', result)
        const isProduction = process.env.NODE_ENV === 'production'
        const successMsg = isProduction
          ? `✅ 회원가입이 완료되었습니다!

📧 실제 이메일로 확인 메일이 발송되었습니다.
📬 스팸함과 정크 메일함도 확인해주세요.
⏰ 이메일이 5분 내로 도착하지 않으면 고객지원팀에 문의해주세요.

💡 이메일이 도착하지 않으면 다음을 확인하세요:
• 스팸/정크 메일함
• 이메일 주소 오타
• 메일 서버 문제 (잠시 후 다시 시도)`

          : `✅ 회원가입이 완료되었습니다!

📧 확인 이메일이 발송되었습니다.
🔍 http://127.0.0.1:54324/ 에서 이메일을 확인하세요.

💡 이메일이 보이지 않으면 새로고침해보세요.`

        setSuccessMessage(result.message || successMsg)

        // warning 메시지가 있으면 함께 표시
        if (result.warning) {
          setSuccessMessage(prev => prev + "\n\n⚠️ " + result.warning)
        }

        setTimeout(() => {
          // redirect 파라미터를 유지하면서 로그인 페이지로 이동
          const loginUrl = redirectTo !== '/dashboard' 
            ? `/login?redirect=${encodeURIComponent(redirectTo)}`
            : '/login'
          router.push(loginUrl)
        }, 3000)
      } else {
        setErrors({ general: result.error || "회원가입 중 오류가 발생했습니다." })
      }
    } catch (error) {
      setErrors({ general: "네트워크 오류가 발생했습니다. 다시 시도해주세요." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 right-20 w-32 h-32 bg-green-100 rounded-full opacity-20"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "0s",
          }}
        ></div>
        <div
          className="absolute bottom-20 left-20 w-24 h-24 bg-emerald-100 rounded-full opacity-30"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "2s",
          }}
        ></div>
        <div
          className="absolute top-1/2 right-10 w-16 h-16 bg-teal-100 rounded-full opacity-25"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "4s",
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
              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                회원가입
              </Badge>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  계정 만들기
                </span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">집중력 향상 여정을 시작하세요</p>
            </div>
          </motion.div>

          {/* Sign Up Form */}
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
                    <p className="text-green-700 text-sm">{successMessage}</p>
                  </motion.div>
                )}

                {/* General Error Message */}
                {errors.general && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-red-700 text-sm">{errors.general}</p>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name Field */}
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                      이름
                    </Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="홍길동"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        autoComplete="name"
                        className={`pl-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base ${
                          errors.name ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : ""
                        }`}
                        required
                      />
                    </div>
                    {errors.name && (
                      <p className="text-red-600 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.name}
                      </p>
                    )}
                  </div>

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
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        autoComplete="email"
                        className={`pl-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base ${
                          errors.email ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : ""
                        }`}
                        required
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-600 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                      비밀번호
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
                        className={`pl-12 pr-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base ${
                          errors.password ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : ""
                        }`}
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
                    {errors.password && (
                      <p className="text-red-600 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700">
                      비밀번호 확인
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
                        className={`pl-12 pr-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base ${
                          errors.confirmPassword ? "border-red-300 focus:border-red-500 focus:ring-red-500/20" : ""
                        }`}
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
                    {errors.confirmPassword && (
                      <p className="text-red-600 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  {/* Terms Agreement */}
                  <div className="space-y-2">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={formData.agreeTerms}
                        onChange={(e) => handleInputChange("agreeTerms", e.target.checked)}
                        className="w-4 h-4 text-green-600 bg-white border-slate-300 rounded focus:ring-green-500 focus:ring-2 mt-1"
                      />
                      <Label htmlFor="terms" className="text-sm text-slate-600 leading-relaxed">
                        <Link href="/terms" className="text-green-600 hover:text-green-700 transition-colors">
                          이용약관
                        </Link>{" "}
                        및{" "}
                        <Link href="/privacy" className="text-green-600 hover:text-green-700 transition-colors">
                          개인정보처리방침
                        </Link>
                        에 동의합니다.
                      </Label>
                    </div>
                    {errors.agreeTerms && (
                      <p className="text-red-600 text-sm flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.agreeTerms}
                      </p>
                    )}
                  </div>

                  {/* Sign Up Button */}
                  <Button
                    type="submit"
                    disabled={isLoading || !formData.agreeTerms || !!successMessage}
                    className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  >
                    {successMessage ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5" />
                        완료! 로그인 페이지로 이동중...
                      </div>
                    ) : isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        계정 생성 중...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        계정 만들기
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    )}
                  </Button>
                </form>

                {/* Login Link */}
                <div className="text-center mt-8 pt-6 border-t border-slate-100">
                  <p className="text-slate-600">
                    이미 계정이 있으신가요?{" "}
                    <Link href="/login" className="text-green-600 hover:text-green-700 font-semibold transition-colors">
                      로그인
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
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

export default function SignUpPage() {
  return (
    <Suspense fallback={<LoadingPage />}> 
      <SignUpForm />
    </Suspense>
  )
}
