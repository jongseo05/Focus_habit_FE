'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ArrowLeft,
  Palette,
  Type,
  Package,
  Heart,
  Star,
  Target,
  User,
  Clock,
  Hash,
  Check,
  X,
  Info,
  AlertTriangle,
  Copy,
  Crown,
  Settings,
  Search,
  Plus,
  ChevronRight,
  Brain,
  Sparkles
} from 'lucide-react'

export default function StyleGuidePage() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const colorTokens = [
    {
      name: 'Primary',
      description: '브랜드 메인 컬러',
      colors: [
        { name: 'primary', value: 'oklch(0.208 0.042 265.755)', hex: '#1e293b', usage: '메인 브랜드 컬러' },
        { name: 'primary-foreground', value: 'oklch(0.984 0.003 247.858)', hex: '#f8fafc', usage: 'Primary 텍스트' },
        { name: 'focus-blue', value: '#2563EB', hex: '#2563EB', usage: '포커스 상태 컬러' },
      ]
    },
    {
      name: 'Secondary',
      description: '보조 컬러',
      colors: [
        { name: 'secondary', value: 'oklch(0.968 0.007 247.896)', hex: '#f1f5f9', usage: '보조 배경' },
        { name: 'secondary-foreground', value: 'oklch(0.208 0.042 265.755)', hex: '#1e293b', usage: 'Secondary 텍스트' },
        { name: 'muted', value: 'oklch(0.968 0.007 247.896)', hex: '#f1f5f9', usage: '비활성 배경' },
        { name: 'muted-foreground', value: 'oklch(0.554 0.046 257.417)', hex: '#64748b', usage: '비활성 텍스트' },
      ]
    },
    {
      name: 'Semantic',
      description: '의미적 컬러',
      colors: [
        { name: 'destructive', value: 'oklch(0.577 0.245 27.325)', hex: '#dc2626', usage: '에러/삭제' },
        { name: 'accent', value: 'oklch(0.968 0.007 247.896)', hex: '#f1f5f9', usage: '강조' },
        { name: 'border', value: 'oklch(0.929 0.013 255.508)', hex: '#e2e8f0', usage: '경계선' },
        { name: 'ring', value: 'oklch(0.704 0.04 256.788)', hex: '#94a3b8', usage: '포커스 링' },
      ]
    }
  ]

  const gradients = [
    {
      name: 'Main Background',
      class: 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20',
      description: '메인 페이지 배경 그라데이션'
    },
    {
      name: 'Brand Logo',
      class: 'bg-gradient-to-br from-blue-600 to-blue-700',
      description: '브랜드 로고 배경 그라데이션'
    },
    {
      name: 'Card Hover',
      class: 'bg-gradient-to-r from-blue-50 to-indigo-50',
      description: '카드 호버 상태 그라데이션'
    }
  ]

  const iconExamples = [
    { icon: Brain, name: 'Brain', usage: '브랜드 로고' },
    { icon: Target, name: 'Target', usage: '목표/챌린지' },
    { icon: Heart, name: 'Heart', usage: '좋아요/친구' },
    { icon: Star, name: 'Star', usage: '즐겨찾기/평점' },
    { icon: User, name: 'User', usage: '사용자/프로필' },
    { icon: Clock, name: 'Clock', usage: '시간/타이머' },
    { icon: Hash, name: 'Hash', usage: '룸/채널' },
    { icon: Settings, name: 'Settings', usage: '설정' },
    { icon: Search, name: 'Search', usage: '검색' },
    { icon: Plus, name: 'Plus', usage: '추가/생성' },
    { icon: Crown, name: 'Crown', usage: '방장/리더' },
    { icon: Sparkles, name: 'Sparkles', usage: '특별/프리미엄' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/social" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
                뒤로가기
              </Link>
              <div className="w-px h-6 bg-gray-300"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">FocusAI Style Guide</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Introduction */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              디자인 시스템 가이드
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl">
              FocusAI 프로젝트에서 사용되는 컴포넌트, 색상, 타이포그래피 및 디자인 원칙을 정리한 스타일 가이드입니다.
              일관된 사용자 경험을 위해 모든 개발자와 디자이너가 참고해야 하는 표준 규격입니다.
            </p>
          </div>

          <Tabs defaultValue="colors" className="space-y-8">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="colors" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                색상
              </TabsTrigger>
              <TabsTrigger value="typography" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                타이포그래피
              </TabsTrigger>
              <TabsTrigger value="components" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                컴포넌트
              </TabsTrigger>
              <TabsTrigger value="icons" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                아이콘 & 기타
              </TabsTrigger>
            </TabsList>

            {/* Colors Tab */}
            <TabsContent value="colors" className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-6">색상 시스템</h2>
                
                {/* Color Tokens */}
                {colorTokens.map((category) => (
                  <div key={category.name} className="mb-8">
                    <h3 className="text-xl font-semibold mb-2">{category.name}</h3>
                    <p className="text-gray-600 mb-4">{category.description}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {category.colors.map((color) => (
                        <Card key={color.name}>
                          <CardContent className="p-4">
                            <div 
                              className="w-full h-16 rounded-lg mb-3 border"
                              style={{ backgroundColor: color.hex }}
                            ></div>
                            <h4 className="font-medium text-sm">{color.name}</h4>
                            <p className="text-xs text-gray-500 mb-2">{color.usage}</p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-600">HEX</span>
                                <button 
                                  onClick={() => copyToClipboard(color.hex)}
                                  className="text-xs font-mono hover:bg-gray-100 px-1 rounded flex items-center gap-1"
                                >
                                  {color.hex}
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-600">CSS</span>
                                <button 
                                  onClick={() => copyToClipboard(`var(--${color.name})`)}
                                  className="text-xs font-mono hover:bg-gray-100 px-1 rounded flex items-center gap-1"
                                >
                                  --{color.name}
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Gradients */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">그라데이션</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {gradients.map((gradient) => (
                      <Card key={gradient.name}>
                        <CardContent className="p-4">
                          <div className={`w-full h-16 rounded-lg mb-3 ${gradient.class}`}></div>
                          <h4 className="font-medium text-sm">{gradient.name}</h4>
                          <p className="text-xs text-gray-500 mb-2">{gradient.description}</p>
                          <button 
                            onClick={() => copyToClipboard(gradient.class)}
                            className="text-xs font-mono hover:bg-gray-100 px-2 py-1 rounded flex items-center gap-1"
                          >
                            {gradient.class}
                            <Copy className="w-3 h-3" />
                          </button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-6">타이포그래피</h2>
                
                <div className="space-y-8">
                  {/* Headings */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4">제목 (Headings)</h3>
                    <div className="space-y-4">
                      <div className="border-l-4 border-blue-500 pl-4">
                        <h1 className="text-4xl font-bold text-gray-900">Heading 1 - 4xl/bold</h1>
                        <code className="text-sm text-gray-500">text-4xl font-bold</code>
                      </div>
                      <div className="border-l-4 border-blue-400 pl-4">
                        <h2 className="text-3xl font-bold text-gray-900">Heading 2 - 3xl/bold</h2>
                        <code className="text-sm text-gray-500">text-3xl font-bold</code>
                      </div>
                      <div className="border-l-4 border-blue-300 pl-4">
                        <h3 className="text-2xl font-bold text-gray-900">Heading 3 - 2xl/bold</h3>
                        <code className="text-sm text-gray-500">text-2xl font-bold</code>
                      </div>
                      <div className="border-l-4 border-blue-200 pl-4">
                        <h4 className="text-xl font-semibold text-gray-900">Heading 4 - xl/semibold</h4>
                        <code className="text-sm text-gray-500">text-xl font-semibold</code>
                      </div>
                    </div>
                  </div>

                  {/* Body Text */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4">본문 텍스트 (Body)</h3>
                    <div className="space-y-4">
                      <div className="border-l-4 border-gray-300 pl-4">
                        <p className="text-lg text-gray-900">Large body text - lg/normal</p>
                        <code className="text-sm text-gray-500">text-lg</code>
                      </div>
                      <div className="border-l-4 border-gray-300 pl-4">
                        <p className="text-base text-gray-900">Regular body text - base/normal</p>
                        <code className="text-sm text-gray-500">text-base</code>
                      </div>
                      <div className="border-l-4 border-gray-300 pl-4">
                        <p className="text-sm text-gray-600">Small body text - sm/normal</p>
                        <code className="text-sm text-gray-500">text-sm text-gray-600</code>
                      </div>
                      <div className="border-l-4 border-gray-300 pl-4">
                        <p className="text-xs text-gray-500">Extra small text - xs/normal</p>
                        <code className="text-sm text-gray-500">text-xs text-gray-500</code>
                      </div>
                    </div>
                  </div>

                  {/* Special Text */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4">특수 텍스트</h3>
                    <div className="space-y-4">
                      <div className="border-l-4 border-green-400 pl-4">
                        <p className="font-mono text-sm bg-gray-100 px-2 py-1 rounded inline-block">Code text - font-mono</p>
                        <code className="text-sm text-gray-500 block mt-1">font-mono text-sm</code>
                      </div>
                      <div className="border-l-4 border-purple-400 pl-4">
                        <p className="text-blue-600 hover:underline cursor-pointer">Link text - text-blue-600</p>
                        <code className="text-sm text-gray-500">text-blue-600 hover:underline</code>
                      </div>
                      <div className="border-l-4 border-yellow-400 pl-4">
                        <p className="text-gray-500 italic">Muted italic text</p>
                        <code className="text-sm text-gray-500">text-gray-500 italic</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Components Tab */}
            <TabsContent value="components" className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-6">컴포넌트 라이브러리</h2>
                
                {/* Buttons */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">버튼 (Buttons)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-2">
                      <Button className="w-full">Default</Button>
                      <code className="text-xs">variant="default"</code>
                    </div>
                    <div className="space-y-2">
                      <Button variant="secondary" className="w-full">Secondary</Button>
                      <code className="text-xs">variant="secondary"</code>
                    </div>
                    <div className="space-y-2">
                      <Button variant="outline" className="w-full">Outline</Button>
                      <code className="text-xs">variant="outline"</code>
                    </div>
                    <div className="space-y-2">
                      <Button variant="ghost" className="w-full">Ghost</Button>
                      <code className="text-xs">variant="ghost"</code>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-2">
                      <Button variant="destructive" className="w-full">Destructive</Button>
                      <code className="text-xs">variant="destructive"</code>
                    </div>
                    <div className="space-y-2">
                      <Button variant="link" className="w-full">Link</Button>
                      <code className="text-xs">variant="link"</code>
                    </div>
                    <div className="space-y-2">
                      <Button disabled className="w-full">Disabled</Button>
                      <code className="text-xs">disabled</code>
                    </div>
                    <div className="space-y-2">
                      <Button size="sm" className="w-full">Small</Button>
                      <code className="text-xs">size="sm"</code>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="space-y-2">
                      <Button size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                      <code className="text-xs">size="icon"</code>
                    </div>
                    <div className="space-y-2">
                      <Button className="gap-2">
                        <Star className="h-4 w-4" />
                        With Icon
                      </Button>
                      <code className="text-xs">with icon</code>
                    </div>
                  </div>
                </div>

                {/* Cards */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">카드 (Cards)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>기본 카드</CardTitle>
                        <CardDescription>카드 설명 텍스트입니다.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600">카드 내용이 들어갑니다.</p>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Hash className="h-5 w-5 text-blue-500" />
                          아이콘 카드
                        </CardTitle>
                        <CardDescription>호버 효과가 있는 카드입니다.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge>New</Badge>
                          <Button size="sm">Action</Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <CardHeader>
                        <CardTitle>그라데이션 카드</CardTitle>
                        <CardDescription>특별한 배경이 있는 카드입니다.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              <Crown className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">특별한 사용자</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Badges */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">배지 (Badges)</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                    <Badge variant="outline">Outline</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="gap-1">
                      <Check className="h-3 w-3" />
                      With Icon
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                    <Badge variant="destructive" className="gap-1">
                      <X className="h-3 w-3" />
                      Error
                    </Badge>
                  </div>
                </div>

                {/* Avatars */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">아바타 (Avatars)</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-center">
                      <Avatar>
                        <AvatarFallback>JD</AvatarFallback>
                      </Avatar>
                      <p className="text-xs mt-1">기본</p>
                    </div>
                    <div className="text-center">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                          <Crown className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs mt-1">작은</p>
                    </div>
                    <div className="text-center">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-green-100 text-green-600">
                          <User className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs mt-1">큰</p>
                    </div>
                    <div className="text-center">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                          <Brain className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs mt-1">특대</p>
                    </div>
                  </div>
                </div>

                {/* Inputs */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">입력 요소 (Inputs)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">기본 입력</label>
                      <Input placeholder="텍스트를 입력하세요" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">비밀번호</label>
                      <Input type="password" placeholder="비밀번호" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">검색 입력</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input className="pl-10" placeholder="검색..." />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">비활성 입력</label>
                      <Input disabled placeholder="비활성 상태" />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Icons Tab */}
            <TabsContent value="icons" className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-6">아이콘 & 기타 요소</h2>
                
                {/* Icons */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">아이콘 시스템 (Lucide React)</h3>
                  <p className="text-gray-600 mb-4">
                    일관된 시각적 언어를 위해 Lucide React 아이콘 세트를 사용합니다.
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {iconExamples.map((item) => (
                      <div key={item.name} className="text-center p-4 border rounded-lg hover:bg-gray-50">
                        <item.icon className="h-6 w-6 mx-auto mb-2 text-gray-700" />
                        <p className="text-xs font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.usage}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Layout Patterns */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">레이아웃 패턴</h3>
                  
                  <div className="space-y-6">
                    {/* Glass Effect */}
                    <div>
                      <h4 className="text-lg font-medium mb-2">글래스 효과 (Glass Effect)</h4>
                      <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-8 rounded-lg">
                        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                          <h5 className="font-semibold mb-2">글래스 모피즘 카드</h5>
                          <p className="text-sm text-gray-600">
                            투명도와 블러 효과를 활용한 현대적인 UI 요소입니다.
                          </p>
                          <code className="text-xs bg-black/10 px-2 py-1 rounded mt-2 inline-block">
                            bg-white/80 backdrop-blur-sm border-white/20
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* Shadows */}
                    <div>
                      <h4 className="text-lg font-medium mb-2">그림자 시스템</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white rounded-lg shadow-xs">
                          <p className="text-sm font-medium">Extra Small</p>
                          <code className="text-xs text-gray-500">shadow-xs</code>
                        </div>
                        <div className="p-4 bg-white rounded-lg shadow-sm">
                          <p className="text-sm font-medium">Small</p>
                          <code className="text-xs text-gray-500">shadow-sm</code>
                        </div>
                        <div className="p-4 bg-white rounded-lg shadow-lg">
                          <p className="text-sm font-medium">Large</p>
                          <code className="text-xs text-gray-500">shadow-lg</code>
                        </div>
                      </div>
                    </div>

                    {/* Spacing */}
                    <div>
                      <h4 className="text-lg font-medium mb-2">간격 시스템</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <div className="w-4 h-4 bg-blue-500"></div>
                          <span className="text-sm">4px - gap-1, p-1, m-1</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-6 h-6 bg-blue-500"></div>
                          <span className="text-sm">6px - gap-1.5, p-1.5, m-1.5</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-blue-500"></div>
                          <span className="text-sm">8px - gap-2, p-2, m-2</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-500"></div>
                          <span className="text-sm">12px - gap-3, p-3, m-3</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-blue-500"></div>
                          <span className="text-sm">16px - gap-4, p-4, m-4</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-24 bg-blue-500"></div>
                          <span className="text-sm">24px - gap-6, p-6, m-6</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Border Radius */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">둥근 모서리 (Border Radius)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-100 rounded-md text-center">
                      <p className="text-sm font-medium">Medium</p>
                      <code className="text-xs">rounded-md</code>
                    </div>
                    <div className="p-4 bg-blue-100 rounded-lg text-center">
                      <p className="text-sm font-medium">Large</p>
                      <code className="text-xs">rounded-lg</code>
                    </div>
                    <div className="p-4 bg-blue-100 rounded-xl text-center">
                      <p className="text-sm font-medium">Extra Large</p>
                      <code className="text-xs">rounded-xl</code>
                    </div>
                    <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center">
                      <code className="text-xs">rounded-full</code>
                    </div>
                  </div>
                </div>

                {/* States */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">상태 표시</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <Check className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-800">성공 상태</p>
                        <p className="text-xs text-green-600">작업이 성공적으로 완료되었습니다.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <X className="h-5 w-5 text-red-600" />
                      <div>
                        <p className="text-sm font-medium text-red-800">오류 상태</p>
                        <p className="text-xs text-red-600">문제가 발생했습니다. 다시 시도해주세요.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">경고 상태</p>
                        <p className="text-xs text-yellow-600">주의가 필요한 상황입니다.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Info className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">정보 상태</p>
                        <p className="text-xs text-blue-600">참고할 정보가 있습니다.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}