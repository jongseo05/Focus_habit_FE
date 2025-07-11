
// 리다이렉트 경로
export const AUTH_ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  CONFIRM: '/auth/confirm',
  RESET_PASSWORD: '/auth/reset-password',
} as const

// 에러 메시지
export const AUTH_ERRORS = {
  INVALID_EMAIL: '유효한 이메일 주소를 입력해주세요.',
  INVALID_PASSWORD: '비밀번호가 올바르지 않습니다.',
  PASSWORD_TOO_SHORT: '비밀번호는 8자 이상이어야 합니다.',
  PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다.',
  EMAIL_ALREADY_EXISTS: '이미 존재하는 이메일입니다.',
  USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
  WEAK_PASSWORD: '비밀번호가 너무 약합니다.',
  TOO_MANY_REQUESTS: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
} as const

// 성공 메시지
export const AUTH_SUCCESS = {
  SIGNUP: '회원가입이 완료되었습니다.',
  LOGIN: '로그인이 완료되었습니다.',
  LOGOUT: '로그아웃이 완료되었습니다.',
  PASSWORD_RESET: '비밀번호 재설정 이메일이 전송되었습니다.',
  EMAIL_CONFIRMED: '이메일 인증이 완료되었습니다.',
} as const

// 폼 필드 설정
export const FORM_CONSTRAINTS = {
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 50,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  },
  EMAIL: {
    MAX_LENGTH: 254,
  },
} as const

// 로컬 스토리지 키
export const STORAGE_KEYS = {
  REMEMBER_ME: 'remember_me',
  LAST_EMAIL: 'last_email',
} as const

// 세션 관련 설정
export const SESSION_CONFIG = {
  REFRESH_THRESHOLD: 60 * 5, // 5분 (초 단위)
  MAX_AGE: 60 * 60 * 24 * 7, // 7일 (초 단위)
} as const
