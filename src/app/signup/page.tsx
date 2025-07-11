"use client"

import type React from "react"

import { useState } from "react"
import { motion } from "framer-motion"
import { Brain, Eye, EyeOff, Mail, Lock, User, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function SignUpPage() {
  
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
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    
    setTimeout(() => {
      setIsLoading(false)
      alert("회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.")
      router.push("/login")
    }, 2000)
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
                        className="pl-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base"
                        required
                      />
                    </div>
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
                        className="pl-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base"
                        required
                      />
                    </div>
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
                        placeholder="8자 이상 입력하세요"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className="pl-12 pr-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base"
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
                        className="pl-12 pr-12 h-14 bg-white border-slate-200 rounded-xl focus:border-green-500 focus:ring-green-500/20 transition-all duration-200 text-base"
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

                  {/* Terms Agreement */}
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

                  {/* Sign Up Button */}
                  <Button
                    type="submit"
                    disabled={isLoading || !formData.agreeTerms}
                    className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  >
                    {isLoading ? (
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
