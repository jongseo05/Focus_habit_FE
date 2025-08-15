'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Palette, 
  Eye, 
  Copy, 
  CheckCircle,
  AlertCircle,
  Info,
  Crown,
  Brain,
  Target,
  Heart,
  Hash,
  Clock,
  Users,
  Plus,
  Search,
  Bell,
  Settings,
  Trophy,
  TrendingUp,
  Sparkles
} from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'

interface ColorItem {
  name: string
  value: string
  description: string
  usage: string
}

interface ColorSection {
  title: string
  colors: ColorItem[]
}

export default function StyleGuidePage() {
  const [copiedColor, setCopiedColor] = useState<string | null>(null)

  // 소셜 페이지에서 사용된 색상 정리
  const colorSections: ColorSection[] = [
    {
      title: "브랜드 색상 (Brand Colors)",
      colors: [
        {
          name: "Primary Blue",
          value: "#2563eb", // blue-600
          description: "메인 브랜드 컬러",
          usage: "로고, 기본 버튼, 강조 요소"
        },
        {
          name: "Primary Blue Dark",
          value: "#1d4ed8", // blue-700
          description: "Primary Blue의 어두운 버전",
          usage: "버튼 hover 상태, 그라데이션"
        },
        {
          name: "Primary Blue Light",
          value: "#3b82f6", // blue-500
          description: "Primary Blue의 밝은 버전",
          usage: "아이콘, 링크, 보조 강조"
        }
      ]
    },
    {
      title: "배경 색상 (Background Colors)",
      colors: [
        {
          name: "Background Gradient Start",
          value: "#f8fafc", // slate-50
          description: "페이지 배경 그라데이션 시작점",
          usage: "메인 페이지 배경"
        },
        {
          name: "Background Gradient Mid",
          value: "#eff6ff4d", // blue-50/30
          description: "페이지 배경 그라데이션 중간점",
          usage: "메인 페이지 배경"
        },
        {
          name: "Background Gradient End",
          value: "#eef2ff33", // indigo-50/20
          description: "페이지 배경 그라데이션 끝점",
          usage: "메인 페이지 배경"
        },
        {
          name: "Header Background",
          value: "#ffffffcc", // white/80
          description: "헤더 배경색 (투명도 포함)",
          usage: "상단 네비게이션 헤더"
        }
      ]
    },
    {
      title: "텍스트 색상 (Text Colors)",
      colors: [
        {
          name: "Text Primary",
          value: "#0f172a", // slate-900
          description: "주요 텍스트 색상",
          usage: "제목, 중요한 텍스트"
        },
        {
          name: "Text Secondary",
          value: "#4b5563", // gray-600
          description: "보조 텍스트 색상",
          usage: "설명글, 부가 정보"
        },
        {
          name: "Text Muted",
          value: "#9ca3af", // gray-400
          description: "비활성/보조 텍스트",
          usage: "플레이스홀더, 비활성 상태"
        },
        {
          name: "Text Dark",
          value: "#374151", // slate-700
          description: "중간 톤 텍스트",
          usage: "일반 텍스트, 설명"
        }
      ]
    },
    {
      title: "상태 색상 (Status Colors)",
      colors: [
        {
          name: "Success",
          value: "#16a34a", // green-600
          description: "성공 상태 표시",
          usage: "성공 메시지, 완료 상태"
        },
        {
          name: "Success Light",
          value: "#22c55e", // green-500
          description: "성공 상태 아이콘",
          usage: "성공 아이콘, 긍정적 요소"
        },
        {
          name: "Error",
          value: "#dc2626", // red-600
          description: "오류 상태 표시",
          usage: "에러 메시지, 경고"
        },
        {
          name: "Error Background",
          value: "#fef2f2", // red-50
          description: "오류 상태 배경",
          usage: "에러 요소의 배경색"
        },
        {
          name: "Warning",
          value: "#a855f7", // purple-500
          description: "주의/특별 상태",
          usage: "특별한 기능, 프리미엄 요소"
        }
      ]
    },
    {
      title: "보조 색상 (Utility Colors)",
      colors: [
        {
          name: "Border",
          value: "#d1d5db", // gray-300
          description: "기본 테두리 색상",
          usage: "입력 필드, 카드 테두리"
        },
        {
          name: "Skeleton",
          value: "#e5e7eb", // gray-200
          description: "로딩 스켈레톤",
          usage: "로딩 상태 표시"
        },
        {
          name: "Focus Ring",
          value: "#3b82f6", // blue-500
          description: "포커스 링 색상",
          usage: "키보드 네비게이션 표시"
        },
        {
          name: "Notification Badge",
          value: "#ef4444", // red-500
          description: "알림 배지",
          usage: "새 알림 표시"
        }
      ]
    }
  ]

  const copyToClipboard = async (color: string) => {
    try {
      await navigator.clipboard.writeText(color)
      setCopiedColor(color)
      setTimeout(() => setCopiedColor(null), 2000)
    } catch (err) {
      console.error('색상 복사 실패:', err)
    }
  }

  const ColorCard = ({ color }: { color: ColorItem }) => (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div 
          className="w-full h-20 rounded-lg mb-3 border border-gray-200 shadow-sm"
          style={{ backgroundColor: color.value }}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{color.name}</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(color.value)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copiedColor === color.value ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {color.value}
          </code>
          <p className="text-sm text-gray-600">{color.description}</p>
          <Badge variant="secondary" className="text-xs">
            {color.usage}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-200">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">FocusAI Style Guide</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link href="/social">
                <Button variant="ghost" size="sm" title="소셜 페이지로 돌아가기">
                  <Eye className="w-5 h-5 mr-2" />
                  라이브 예제 보기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Palette className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                FocusAI 스타일 가이드
              </h1>
            </div>
            <p className="text-gray-600 text-lg">
              소셜 페이지에서 사용된 색상 시스템과 디자인 토큰들을 정리한 가이드입니다.
            </p>
          </div>

          {/* 색상 개요 */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                색상 시스템 개요
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">브랜드 아이덴티티</h4>
                  <p className="text-gray-600 text-sm">
                    파란색을 중심으로 한 신뢰감 있고 전문적인 느낌의 색상 팔레트를 사용합니다. 
                    집중과 학습이라는 앱의 목적에 맞는 차분하면서도 에너지 있는 톤을 추구합니다.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">접근성 고려사항</h4>
                  <p className="text-gray-600 text-sm">
                    모든 텍스트는 WCAG 2.1 AA 기준을 만족하는 대비율을 유지하며, 
                    색상만으로 정보를 전달하지 않도록 아이콘과 텍스트를 함께 사용합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 색상 섹션들 */}
          {colorSections.map((section) => (
            <div key={section.title} className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{section.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {section.colors.map((color) => (
                  <ColorCard key={color.name} color={color} />
                ))}
              </div>
            </div>
          ))}

          {/* 실제 사용 예제 */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">실제 사용 예제</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 버튼 예제 */}
              <Card>
                <CardHeader>
                  <CardTitle>버튼 스타일</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Primary Button
                  </Button>
                  <Button variant="outline">
                    <Search className="h-4 w-4 mr-2" />
                    Secondary Button
                  </Button>
                  <Button variant="ghost">
                    <Settings className="h-4 w-4 mr-2" />
                    Ghost Button
                  </Button>
                </CardContent>
              </Card>

              {/* 카드 예제 */}
              <Card>
                <CardHeader>
                  <CardTitle>카드 스타일</CardTitle>
                </CardHeader>
                <CardContent>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2 group-hover:text-blue-600 transition-colors">
                            <Hash className="h-5 w-5 text-blue-500" />
                            예제 스터디룸
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            이것은 카드 컴포넌트의 예제입니다.
                          </p>
                        </div>
                        <Badge variant="secondary">
                          공부
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          3/5
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          60분
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>

              {/* 상태 표시 예제 */}
              <Card>
                <CardHeader>
                  <CardTitle>상태 표시</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">성공 상태</span>
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">오류 상태</span>
                  </div>
                  <div className="flex items-center gap-2 text-purple-500">
                    <Trophy className="h-4 w-4" />
                    <span className="text-sm">특별 상태</span>
                  </div>
                </CardContent>
              </Card>

              {/* 아바타와 아이콘 */}
              <Card>
                <CardHeader>
                  <CardTitle>아바타와 아이콘</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        <Crown className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-600">방장</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm text-gray-600">브랜드 아이콘</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 사용 가이드라인 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                사용 가이드라인
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-green-600">✅ 권장사항</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• 주요 액션에는 Primary Blue 사용</li>
                    <li>• 텍스트 계층에 맞는 Gray 톤 사용</li>
                    <li>• 상태별로 적절한 색상 활용</li>
                    <li>• 일관된 그림자와 호버 효과 적용</li>
                    <li>• 포커스 상태를 명확히 표시</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-red-600">❌ 주의사항</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• 너무 많은 색상을 한 번에 사용 금지</li>
                    <li>• 브랜드 색상을 임의로 변경 금지</li>
                    <li>• 충분하지 않은 대비율 사용 금지</li>
                    <li>• 색상만으로 정보 전달 금지</li>
                    <li>• 일관성 없는 색상 조합 사용 금지</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}