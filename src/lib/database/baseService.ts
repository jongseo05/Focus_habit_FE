// =====================================================
// 데이터베이스 서비스 베이스 클래스
// =====================================================

import { supabaseBrowser } from '@/lib/supabase/client'
import { supabaseServer } from '@/lib/supabase/server'
import type { APIResponse, UUID, DatabaseError } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 데이터베이스 서비스의 베이스 클래스
 * 공통 기능과 에러 처리를 제공합니다.
 */
export abstract class BaseService {
  /**
   * 클라이언트 사이드용 Supabase 인스턴스 반환
   */
  protected static getClient(): SupabaseClient {
    return supabaseBrowser()
  }

  /**
   * 서버 사이드용 Supabase 인스턴스 반환
   */
  protected static async getServerClient(): Promise<SupabaseClient> {
    return await supabaseServer()
  }

  /**
   * 표준 성공 응답 생성
   */
  protected static createSuccessResponse<T>(
    data: T, 
    message?: string
  ): APIResponse<T> {
    return {
      success: true,
      data,
      message
    }
  }

  /**
   * 표준 에러 응답 생성
   */
  protected static createErrorResponse(
    error: string | Error | DatabaseError,
    details?: any
  ): APIResponse<never> {
    const errorMessage = typeof error === 'string' 
      ? error 
      : error instanceof Error 
        ? error.message 
        : error.message

    return {
      success: false,
      error: errorMessage,
      ...(details && { details })
    }
  }

  /**
   * Supabase 에러를 표준 에러 응답으로 변환
   */
  protected static handleSupabaseError(
    error: any, 
    context: string = '데이터베이스 작업'
  ): APIResponse<never> {
    console.error(`데이터베이스 ${context} 실패:`, error)

    // Supabase 특정 에러 코드 처리
    if (error?.code) {
      switch (error.code) {
        case '23505': // unique_violation
          return this.createErrorResponse('이미 존재하는 데이터입니다.', { code: error.code })
        case '23503': // foreign_key_violation
          return this.createErrorResponse('참조하는 데이터가 존재하지 않습니다.', { code: error.code })
        case '23514': // check_violation
          return this.createErrorResponse('데이터 형식이 올바르지 않습니다.', { code: error.code })
        case 'PGRST116': // no rows returned
          return this.createErrorResponse('데이터를 찾을 수 없습니다.', { code: error.code })
        default:
          return this.createErrorResponse(`데이터베이스 오류: ${error.message}`, { code: error.code })
      }
    }

    return this.createErrorResponse(error?.message || '알 수 없는 데이터베이스 오류가 발생했습니다.')
  }

  /**
   * 사용자 인증 확인
   */
  protected static async getCurrentUser(client?: SupabaseClient): Promise<APIResponse<{ id: UUID }>> {
    try {
      const supabase = client || this.getClient()
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        return this.createErrorResponse('인증이 필요합니다.')
      }

      return this.createSuccessResponse({ id: user.id })
    } catch (error) {
      return this.handleSupabaseError(error, '사용자 인증 확인')
    }
  }

  /**
   * 페이지네이션 파라미터 검증 및 기본값 설정
   */
  protected static validatePagination(
    limit?: number, 
    offset?: number
  ): { limit: number; offset: number } {
    return {
      limit: Math.min(1000, Math.max(1, limit || 20)),
      offset: Math.max(0, offset || 0)
    }
  }

  /**
   * 날짜 범위 검증
   */
  protected static validateDateRange(
    startDate?: string, 
    endDate?: string
  ): { isValid: boolean; error?: string } {
    if (!startDate && !endDate) {
      return { isValid: true }
    }

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { isValid: false, error: '유효하지 않은 날짜 형식입니다.' }
      }

      if (start > end) {
        return { isValid: false, error: '시작 날짜는 종료 날짜보다 이전이어야 합니다.' }
      }
    }

    return { isValid: true }
  }

  /**
   * UUID 형식 검증
   */
  protected static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  /**
   * 필수 필드 검증
   */
  protected static validateRequiredFields(
    data: Record<string, any>, 
    requiredFields: string[]
  ): { isValid: boolean; missingFields?: string[] } {
    const missingFields = requiredFields.filter(field => 
      data[field] === undefined || data[field] === null || data[field] === ''
    )

    return {
      isValid: missingFields.length === 0,
      missingFields: missingFields.length > 0 ? missingFields : undefined
    }
  }

  /**
   * 트랜잭션 실행 헬퍼
   */
  protected static async executeTransaction<T>(
    operations: (client: SupabaseClient) => Promise<T>,
    isServerSide: boolean = false
  ): Promise<APIResponse<T>> {
    try {
      const client = isServerSide ? await this.getServerClient() : this.getClient()
      const result = await operations(client)
      return this.createSuccessResponse(result)
    } catch (error) {
      return this.handleSupabaseError(error, '트랜잭션 실행')
    }
  }

  /**
   * 배치 작업 실행 (여러 개의 작업을 순차적으로 실행)
   */
  protected static async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    stopOnError: boolean = true
  ): Promise<APIResponse<T[]>> {
    const results: T[] = []
    const errors: any[] = []

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]()
        results.push(result)
      } catch (error) {
        errors.push({ index: i, error })
        if (stopOnError) {
          return this.createErrorResponse(
            `배치 작업 실패 (${i + 1}/${operations.length}): ${error}`,
            { completedCount: results.length, errors }
          )
        }
      }
    }

    if (errors.length > 0 && !stopOnError) {
      return this.createErrorResponse(
        `배치 작업 일부 실패: ${errors.length}개 실패, ${results.length}개 성공`,
        { results, errors }
      )
    }

    return this.createSuccessResponse(results, `배치 작업 완료: ${results.length}개 성공`)
  }

  /**
   * 캐시 키 생성 헬퍼
   */
  protected static generateCacheKey(
    prefix: string, 
    params: Record<string, any>
  ): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|')
    
    return `${prefix}:${sortedParams}`
  }

  /**
   * 데이터 검증 헬퍼
   */
  protected static validateData<T>(
    data: T,
    validators: Array<(data: T) => { isValid: boolean; error?: string }>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const validator of validators) {
      const result = validator(data)
      if (!result.isValid && result.error) {
        errors.push(result.error)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}
