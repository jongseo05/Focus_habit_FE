'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  redirectTo?: string
  loadingComponent?: React.ReactNode
}

export default function ProtectedRoute({ 
  children, 
  redirectTo = '/login',
  loadingComponent 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      // 현재 경로를 redirect 파라미터로 저장하여 로그인 후 다시 돌아올 수 있도록 함
      const currentPath = window.location.pathname
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
      router.push(redirectUrl)
    }
  }, [user, loading, router, redirectTo])

  // 로딩 중일 때 표시할 컴포넌트
  if (loading) {
    return loadingComponent || (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 인증되지 않은 경우 null 반환 (리디렉션 중)
  if (!user) {
    return null
  }

  // 인증된 경우 자식 컴포넌트 렌더링
  return <>{children}</>
}
