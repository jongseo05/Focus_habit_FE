"use client"

import { Brain, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import ComprehensiveReport from "@/components/ui/comprehensive-report"

export default function ReportPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-slate-900">FocusAI</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <span className="text-slate-600">종합 리포트</span>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/report/daily/${new Date().toISOString().split('T')[0]}`}>
                  오늘의 리포트
                </Link>
              </Button>
            </div>

            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                대시보드로 돌아가기
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <ComprehensiveReport />
      </main>
    </div>
  )
}
