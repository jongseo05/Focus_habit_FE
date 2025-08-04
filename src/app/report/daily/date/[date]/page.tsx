"use client"

import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function DailyDateReportPage() {
  const params = useParams()
  const date = params.date as string

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/report/daily" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-slate-600">일일 리포트 목록</span>
                </Link>
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {new Date(date).toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long'
                  })} 리포트
                </h1>
                <p className="text-slate-600">오늘의 집중 패턴과 성취를 확인해보세요</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>날짜별 리포트</CardTitle>
          </CardHeader>
          <CardContent>
            <p>선택된 날짜: {date}</p>
            <p>이 페이지는 {date} 날짜의 상세 리포트를 보여줍니다.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 