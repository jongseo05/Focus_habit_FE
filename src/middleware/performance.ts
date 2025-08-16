import { NextRequest, NextResponse } from 'next/server'

// 성능 최적화를 위한 미들웨어
export function performanceMiddleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // 캐시 최적화 헤더 추가
  if (request.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  } else if (request.nextUrl.pathname.startsWith('/api/')) {
    // API 라우트는 짧은 캐시
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300')
  } else {
    // 페이지는 중간 캐시
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600')
  }
  
  // 압축 최적화
  response.headers.set('Accept-Encoding', 'gzip, deflate, br')
  
  // 보안 헤더 (성능에 영향 없는 것들만)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  
  return response
}

// 메인 미들웨어 함수
export function middleware(request: NextRequest) {
  // 성능 최적화 미들웨어 적용
  return performanceMiddleware(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
