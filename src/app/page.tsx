
"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gauge, FileText, Brain, Sparkles } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/AuthProvider"
import ThreeStepProcess from "@/components/three-step-process"
import Link from "next/link"


export default function FocusAILanding() {
  const [activeFeature, setActiveFeature] = useState("realtime")
  const { user, loading } = useAuth()
  const router = useRouter()

  // 로그인된 사용자를 dashboard로 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // 로딩 중이거나 로그인된 사용자인 경우 로딩 표시
  if (loading || user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">FocusAI</span>
          </div>
          <Link href="/login">
            <Button variant="ghost" className="text-slate-600 hover:text-slate-900">
              로그인
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                <Sparkles className="w-3 h-3 mr-1" />
                AI 기반 학습 집중력 분석
              </Badge>
              <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 leading-tight">
                집중력을{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  데이터로
                </span>
                <br />
                증명하라
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                AI 기반 집중력 분석으로 학습 효율을 극대화하고,{" "}
                <span className="font-semibold text-slate-800">실시간 데이터</span>로 당신의 성장을 확인하세요.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                무료로 시작하기
              </Button>
              <div className="flex items-center gap-2 text-slate-500">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white"></div>
                  <div className="w-8 h-8 bg-indigo-500 rounded-full border-2 border-white"></div>
                  <div className="w-8 h-8 bg-purple-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="text-sm font-medium">1000+학습자가 이미 사용 중</span>
              </div>
            </div>
          </div>

          {/* Focus Indicator - Clean Toss Blue Design */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              <div className="w-80 h-80 flex items-center justify-center relative">
                {/* SVG 도넛 차트 */}
                <svg className="w-80 h-80 transform -rotate-90" viewBox="0 0 200 200">
                  <defs>
                    <linearGradient id="tossBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3182F6" />
                      <stop offset="100%" stopColor="#1E40AF" />
                    </linearGradient>
                    <linearGradient id="tossLightBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#DBEAFE" />
                      <stop offset="100%" stopColor="#BFDBFE" />
                    </linearGradient>
                  </defs>

                  {/* 배경 원 */}
                  <circle cx="100" cy="100" r="85" fill="none" stroke="#E5E7EB" strokeWidth="8" opacity="1" />

                  {/* 진행률 원 - 깔끔한 애니메이션 */}
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="url(#tossBlueGradient)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="534.07"
                    strokeDashoffset="0"
                    style={{
                      animation: "drawCircle 2s ease-out forwards",
                    }}
                  />

                  {/* 내부 배경 원 */}
                  <circle cx="100" cy="100" r="70" fill="#F8FAFC" stroke="#F1F5F9" strokeWidth="1" />
                </svg>

                {/* 중앙 텍스트 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-6xl font-bold text-slate-900 mb-2">100%</div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold text-slate-700">집중도</div>
                      <div className="text-sm text-slate-500 flex items-center justify-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        실시간 측정
                      </div>
                    </div>
                  </div>
                </div>

                {/* 깔끔한 장식 요소들 */}
                <div className="absolute inset-0">
                  {/* 미니멀한 플로팅 도트들 */}
                  <div
                    className="absolute top-12 right-16 w-2 h-2 bg-blue-400 rounded-full"
                    style={{
                      animation: "gentleFloat 4s ease-in-out infinite",
                      animationDelay: "0s",
                    }}
                  ></div>
                  <div
                    className="absolute top-24 left-12 w-1.5 h-1.5 bg-blue-300 rounded-full"
                    style={{
                      animation: "gentleFloat 4s ease-in-out infinite",
                      animationDelay: "2s",
                    }}
                  ></div>
                  <div
                    className="absolute bottom-20 right-12 w-2.5 h-2.5 bg-blue-500 rounded-full"
                    style={{
                      animation: "gentleFloat 4s ease-in-out infinite",
                      animationDelay: "1s",
                    }}
                  ></div>
                  <div
                    className="absolute bottom-12 left-20 w-1.5 h-1.5 bg-blue-300 rounded-full"
                    style={{
                      animation: "gentleFloat 4s ease-in-out infinite",
                      animationDelay: "3s",
                    }}
                  ></div>
                </div>

                {/* 깔끔한 데이터 라벨 */}
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2"></div>

                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2"></div>

                {/* 사이드 통계 */}
                <div className="absolute -left-16 top-1/2 transform -translate-y-1/2"></div>

                <div className="absolute -right-16 top-1/2 transform -translate-y-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-Step Process Section */}
      <ThreeStepProcess />

      {/* AI Features Section - Interactive Design */}
      <section className="container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            AI 기반 <span className="text-blue-600">핵심 기능</span>
          </h2>
          <p className="text-xl text-slate-600">과학적 데이터 분석으로 학습 집중력을 체계적으로 관리하세요</p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Interactive Feature Icons */}
          <div className="flex justify-center items-center gap-16 mb-8">
            <button
              onClick={() => setActiveFeature("realtime")}
              className={`group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 ${
                activeFeature === "realtime" ? "bg-blue-100 shadow-lg scale-105" : "hover:bg-slate-50 hover:scale-105"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  activeFeature === "realtime"
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg"
                    : "bg-slate-100 group-hover:bg-blue-100"
                }`}
              >
                <Gauge
                  className={`w-8 h-8 transition-colors duration-300 ${
                    activeFeature === "realtime" ? "text-white" : "text-slate-600 group-hover:text-blue-600"
                  }`}
                />
              </div>
              <div className="text-center">
                <h3
                  className={`font-semibold transition-colors duration-300 ${
                    activeFeature === "realtime" ? "text-blue-700" : "text-slate-700"
                  }`}
                >
                  실시간 집중 게이지
                </h3>
                <p className="text-sm text-slate-500 mt-1">Real-time Focus</p>
              </div>
            </button>

            <button
              onClick={() => setActiveFeature("reports")}
              className={`group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 ${
                activeFeature === "reports" ? "bg-green-100 shadow-lg scale-105" : "hover:bg-slate-50 hover:scale-105"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  activeFeature === "reports"
                    ? "bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg"
                    : "bg-slate-100 group-hover:bg-green-100"
                }`}
              >
                <FileText
                  className={`w-8 h-8 transition-colors duration-300 ${
                    activeFeature === "reports" ? "text-white" : "text-slate-600 group-hover:text-green-600"
                  }`}
                />
              </div>
              <div className="text-center">
                <h3
                  className={`font-semibold transition-colors duration-300 ${
                    activeFeature === "reports" ? "text-green-700" : "text-slate-700"
                  }`}
                >
                  주간 리포트 PDF
                </h3>
                <p className="text-sm text-slate-500 mt-1">Weekly Reports</p>
              </div>
            </button>

            <button
              onClick={() => setActiveFeature("coaching")}
              className={`group flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 ${
                activeFeature === "coaching" ? "bg-purple-100 shadow-lg scale-105" : "hover:bg-slate-50 hover:scale-105"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  activeFeature === "coaching"
                    ? "bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg"
                    : "bg-slate-100 group-hover:bg-purple-100"
                }`}
              >
                <Brain
                  className={`w-8 h-8 transition-colors duration-300 ${
                    activeFeature === "coaching" ? "text-white" : "text-slate-600 group-hover:text-purple-600"
                  }`}
                />
              </div>
              <div className="text-center">
                <h3
                  className={`font-semibold transition-colors duration-300 ${
                    activeFeature === "coaching" ? "text-purple-700" : "text-slate-700"
                  }`}
                >
                  AI 행동 코칭
                </h3>
                <p className="text-sm text-slate-500 mt-1">AI Coaching</p>
              </div>
            </button>
          </div>

          {/* Feature Description */}
          <div className="text-center mb-8">
            {activeFeature === "realtime" && (
              <div className="space-y-2 animate-fade-in">
                <h3 className="text-2xl font-bold text-slate-900">실시간 집중력 모니터링</h3>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  AI가 실시간으로 집중 상태를 측정하고 직관적 인터페이스로 시각화합니다. 학습 중 집중력 변화를 즉시
                  확인하고 최적의 학습 환경을 유지하세요.
                </p>
              </div>
            )}
            {activeFeature === "reports" && (
              <div className="space-y-2 animate-fade-in">
                <h3 className="text-2xl font-bold text-slate-900">상세한 주간 분석 리포트</h3>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  매주 상세한 집중력 분석 리포트를 전문적인 PDF 형태로 제공합니다. 학습 패턴을 분석하고 개선점을 찾아 더
                  효율적인 학습을 계획하세요.
                </p>
              </div>
            )}
            {activeFeature === "coaching" && (
              <div className="space-y-2 animate-fade-in">
                <h3 className="text-2xl font-bold text-slate-900">개인 맞춤형 AI 코칭</h3>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  개인 맞춤형 코칭으로 집중력 향상을 위한 구체적인 가이드를 제공합니다. AI가 분석한 데이터를 바탕으로
                  최적의 학습 전략을 제안받으세요.
                </p>
              </div>
            )}
          </div>

          {/* Dynamic Video Content */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 shadow-inner">
            {activeFeature === "realtime" && (
              <div className="animate-fade-in">
                <div className="aspect-video bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent"></div>
                  <div className="text-center text-white z-10">
                    <Gauge className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                    <h4 className="text-xl font-semibold mb-2">실시간 집중력 측정 데모</h4>
                    <p className="text-blue-100">AI가 실시간으로 집중도를 분석하는 과정을 확인하세요</p>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                    <span className="text-white text-sm">▶ 데모 영상</span>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === "reports" && (
              <div className="animate-fade-in">
                <div className="aspect-video bg-gradient-to-br from-green-900 to-emerald-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-transparent"></div>
                  <div className="text-center text-white z-10">
                    <FileText className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                    <h4 className="text-xl font-semibold mb-2">주간 리포트 생성 과정</h4>
                    <p className="text-green-100">상세한 분석 리포트가 어떻게 생성되는지 확인하세요</p>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                    <span className="text-white text-sm">▶ 데모 영상</span>
                  </div>
                </div>
              </div>
            )}

            {activeFeature === "coaching" && (
              <div className="animate-fade-in">
                <div className="aspect-video bg-gradient-to-br from-purple-900 to-violet-800 rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-transparent"></div>
                  <div className="text-center text-white z-10">
                    <Brain className="w-16 h-16 mx-auto mb-4 animate-pulse" />
                    <h4 className="text-xl font-semibold mb-2">AI 코칭 시스템 작동</h4>
                    <p className="text-purple-100">개인 맞춤형 코칭이 어떻게 제공되는지 확인하세요</p>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                    <span className="text-white text-sm">▶ 데모 영상</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12 mt-16">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-center">
            <p className="text-slate-400">© 2025 FocusAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
      {/* 커스텀 스타일 */}
      <style jsx>{`
        @keyframes drawCircle {
          from {
            stroke-dashoffset: 534.07;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        
        @keyframes gentleFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
