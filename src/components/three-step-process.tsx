"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Camera, BrainCircuit, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"

const steps = [
  {
    id: 1,
    icon: Camera,
    title: "2초마다 한 장만, 자원은 최소로",
    subtitle: "웹캠 한 프레임으로 집중 흐름을 추적합니다.",
    mockup: "capture",
  },
  {
    id: 2,
    icon: BrainCircuit,
    title: "AI가 자세·시선·휴대폰을 실시간 감지",
    subtitle: "딥러닝 모델이 집중 지수를 계산해요.",
    mockup: "analyze",
  },
  {
    id: 3,
    icon: ClipboardList,
    title: "주간 리포트 & 챌린지로 습관 만들기",
    subtitle: "집중 지속 시간이 얼마나 늘었는지 확인하세요.",
    mockup: "report",
  },
]

function StepPanel({ step, index }: { step: (typeof steps)[0]; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-20%" })

  return (
    <section
      ref={ref}
      className="min-h-[80vh] lg:h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, #F6F8FB 0%, #FFFFFF 100%)`,
      }}
    >
      <div className="container mx-auto px-6 py-24 md:py-32">
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : { y: 40, opacity: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: index * 0.1,
          }}
          className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto"
        >
          {/* Content */}
          <div className={`space-y-8 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <step.icon className="w-8 h-8 text-white" />
              </div>
              <div className="w-8 h-1 bg-gradient-to-r from-blue-500 to-blue-300 rounded-full"></div>
              <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                STEP {step.id}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl lg:text-4xl font-semibold text-slate-900 leading-tight">{step.title}</h2>
              <p className="text-xl text-slate-600 leading-relaxed">{step.subtitle}</p>
            </div>

            {step.id === 3 && (
              <div className="pt-4">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 rounded-2xl"
                >
                  베타 알림 받기
                </Button>
              </div>
            )}
          </div>

          {/* Mockup */}
          <div className={`${index % 2 === 1 ? "lg:order-1" : ""}`}>
            <div className="relative">
              {step.mockup === "capture" && <CaptureMockup />}
              {step.mockup === "analyze" && <AnalyzeMockup />}
              {step.mockup === "report" && <ReportMockup />}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Progress Indicator */}
      <div className="fixed left-8 top-1/2 transform -translate-y-1/2 z-10 hidden lg:block"></div>
    </section>
  )
}

function CaptureMockup() {
  return (
    <div className="relative">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
        <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl mb-4 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
              <Camera className="w-12 h-12 text-blue-500" />
            </div>
          </div>
          <div className="absolute top-3 right-3 bg-red-500 w-3 h-3 rounded-full animate-pulse"></div>
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1">
            <span className="text-xs font-medium text-slate-700">Live</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-600">웹캠 프레임 캡처 중...</p>
          <div className="mt-2 bg-slate-100 rounded-full h-1">
            <div className="bg-blue-500 h-1 rounded-full w-3/4 transition-all duration-1000"></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyzeMockup() {
  return (
    <div className="relative">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
        <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl mb-4 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-28 bg-blue-100 rounded-lg relative">
              {/* Bounding box animation */}
              <motion.div
                className="absolute inset-0 border-2 border-blue-500 rounded-lg"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, repeatType: "reverse" }}
              />
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-4 whitespace-nowrap rounded-full py-1">
                집중도 85%
              </div>
            </div>
          </div>
          <div className="absolute top-3 left-3 bg-green-500 w-3 h-3 rounded-full animate-pulse"></div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">자세 분석</span>
            <span className="text-sm font-semibold text-green-600">양호</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">시선 추적</span>
            <span className="text-sm font-semibold text-blue-600">화면 집중</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">휴대폰 감지</span>
            <span className="text-sm font-semibold text-slate-600">미감지</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportMockup() {
  return (
    <div className="relative">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">이번 주 집중력 리포트</h3>
          <div className="text-3xl font-bold text-blue-600 mb-1">4.2시간</div>
          <div className="text-sm text-green-600 flex items-center gap-1">
            <span>↗</span>
            지난주 대비 +37% 향상
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">일일 평균</span>
              <span className="text-sm font-semibold">36분</span>
            </div>
            <div className="bg-slate-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full w-3/5"></div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">최고 기록</span>
              <span className="text-sm font-semibold">1시간 24분</span>
            </div>
            <div className="bg-slate-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full w-4/5"></div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="text-center">
              <ClipboardList className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-blue-700 font-medium">7일 연속 목표 달성!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ThreeStepProcess() {
  return (
    <div className="relative">
      {steps.map((step, index) => (
        <StepPanel key={step.id} step={step} index={index} />
      ))}
    </div>
  )
}
