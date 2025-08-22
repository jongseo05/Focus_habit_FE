// =====================================================
// API 표준 응답 및 에러 처리 유틸리티
// =====================================================

import { NextResponse } from 'next/server'
import type { APIResponse } from '@/types/base'

// 확장된 표준 API 응답 인터페이스 (타임스탬프와 버전 추가)
export interface StandardAPIResponse<T = any> extends APIResponse<T> {
  timestamp: string
  version: string
}

// 에러 응답 인터페이스
export interface ErrorDetails {
  code?: string
  details?: string
  stack?: string
}

// 성공 응답 생성 (확장 버전 - 타임스탬프와 버전 포함)
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response: StandardAPIResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    version: 'v1'
  }
  
  return NextResponse.json(response, { status })
}

// 간단한 성공 응답 생성 (기본 APIResponse 형식)
export function createSimpleSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response: APIResponse<T> = {
    success: true,
    data,
    message
  }
  
  return NextResponse.json(response, { status })
}

// 에러 응답 생성 (확장 버전 - 타임스탬프와 버전 포함)
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: ErrorDetails
): NextResponse {
  const response: StandardAPIResponse = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
    version: 'v1',
    ...(details && { details })
  }
  
  return NextResponse.json(response, { status })
}

// 간단한 에러 응답 생성 (기본 APIResponse 형식)
export function createSimpleErrorResponse(
  error: string,
  status: number = 500
): NextResponse {
  const response: APIResponse = {
    success: false,
    error
  }
  
  return NextResponse.json(response, { status })
}

// 데이터 검증 에러
export function createValidationError(message: string, field?: string): NextResponse {
  return createErrorResponse(
    message,
    400,
    { code: 'VALIDATION_ERROR', details: field }
  )
}

// 인증 에러
export function createAuthError(message: string = '인증이 필요합니다.'): NextResponse {
  return createErrorResponse(
    message,
    401,
    { code: 'AUTH_ERROR' }
  )
}

// 권한 에러
export function createPermissionError(message: string = '권한이 없습니다.'): NextResponse {
  return createErrorResponse(
    message,
    403,
    { code: 'PERMISSION_ERROR' }
  )
}

// 리소스 없음 에러
export function createNotFoundError(message: string = '리소스를 찾을 수 없습니다.'): NextResponse {
  return createErrorResponse(
    message,
    404,
    { code: 'NOT_FOUND' }
  )
}

// 충돌 에러 (중복 등)
export function createConflictError(message: string): NextResponse {
  return createErrorResponse(
    message,
    409,
    { code: 'CONFLICT_ERROR' }
  )
}

// 서버 에러
export function createServerError(
  message: string = '서버 오류가 발생했습니다.',
  originalError?: unknown
): NextResponse {
  const details: ErrorDetails = { code: 'SERVER_ERROR' }
  
  if (originalError instanceof Error) {
    details.details = originalError.message
    if (process.env.NODE_ENV === 'development') {
      details.stack = originalError.stack
    }
  }
  
  return createErrorResponse(message, 500, details)
}

// 통합 에러 핸들러
export function handleAPIError(error: unknown, context: string): NextResponse {
  console.error(`❌ ${context}:`, error)
  
  // Supabase 에러 처리
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as any
    
    switch (supabaseError.code) {
      case '23505': // unique_violation
        return createConflictError('이미 존재하는 데이터입니다.')
      case '23503': // foreign_key_violation
        return createValidationError('참조하는 데이터가 존재하지 않습니다.')
      case '23514': // check_violation
        return createValidationError('데이터 형식이 올바르지 않습니다.')
      case '42883': // function does not exist
        return createServerError('서버 기능을 사용할 수 없습니다.')
      case 'PGRST116': // no rows returned
        return createNotFoundError('데이터를 찾을 수 없습니다.')
      default:
        return createServerError(
          '데이터베이스 오류가 발생했습니다.',
          supabaseError
        )
    }
  }
  
  // 일반 에러 처리
  if (error instanceof Error) {
    return createServerError(error.message, error)
  }
  
  return createServerError('알 수 없는 오류가 발생했습니다.', error)
}

// API 래퍼 - 공통 에러 처리 적용
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse>,
  context: string
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleAPIError(error, context)
    }
  }
}

// 인증 확인 헬퍼
export async function requireAuth(supabase: any): Promise<{ user: any } | NextResponse> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return createAuthError()
  }
  
  return { user }
}

// 페이지네이션 헬퍼
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export function parsePaginationParams(searchParams: URLSearchParams): {
  limit: number
  offset: number
  page: number
} {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const offset = parseInt(searchParams.get('offset') || String((page - 1) * limit))
  
  return { limit, offset, page }
}

// 페이지네이션 응답 생성
export function createPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  pagination: { limit: number; offset: number; page: number },
  message?: string
): NextResponse {
  const { limit, offset, page } = pagination
  const totalPages = Math.ceil(totalCount / limit)
  const hasNext = page < totalPages
  const hasPrev = page > 1
  
  return createSuccessResponse({
    items: data,
    pagination: {
      page,
      limit,
      offset,
      totalCount,
      totalPages,
      hasNext,
      hasPrev
    }
  }, message)
}

// Rate Limiting 헬퍼 (간단한 메모리 기반)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  limit: number = 1000,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const key = identifier
  const current = rateLimitStore.get(key)
  
  // 윈도우가 지났으면 리셋
  if (!current || now > current.resetTime) {
    const resetTime = now + windowMs
    rateLimitStore.set(key, { count: 1, resetTime })
    return { allowed: true, remaining: limit - 1, resetTime }
  }
  
  // 제한 초과
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: current.resetTime }
  }
  
  // 카운트 증가
  current.count++
  rateLimitStore.set(key, current)
  
  return { allowed: true, remaining: limit - current.count, resetTime: current.resetTime }
}

// 주기적으로 만료된 rate limit 정리
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of Array.from(rateLimitStore.entries())) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 300000) // 5분마다 정리
