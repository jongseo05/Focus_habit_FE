// 이메일 유효성 검사
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// 비밀번호 유효성 검사
export const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 8) {
    return { isValid: false, message: '비밀번호는 8자 이상이어야 합니다.' }
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, message: '비밀번호에 소문자가 포함되어야 합니다.' }
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, message: '비밀번호에 대문자가 포함되어야 합니다.' }
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: '비밀번호에 숫자가 포함되어야 합니다.' }
  }
  
  return { isValid: true, message: '유효한 비밀번호입니다.' }
}

// 이름 유효성 검사
export const validateName = (name: string): { isValid: boolean; message: string } => {
  if (name.trim().length < 2) {
    return { isValid: false, message: '이름은 2자 이상이어야 합니다.' }
  }
  
  if (name.trim().length > 50) {
    return { isValid: false, message: '이름은 50자 이하여야 합니다.' }
  }
  
  return { isValid: true, message: '유효한 이름입니다.' }
}

// 비밀번호 확인 검사
export const validatePasswordMatch = (password: string, confirmPassword: string): { isValid: boolean; message: string } => {
  if (password !== confirmPassword) {
    return { isValid: false, message: '비밀번호가 일치하지 않습니다.' }
  }
  
  return { isValid: true, message: '비밀번호가 일치합니다.' }
}

// 회원가입 폼 전체 유효성 검사
export const validateSignUpForm = (formData: {
  name: string
  email: string
  password: string
  confirmPassword: string
  agreeTerms: boolean
}): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {}
  
  // 이름 검사
  const nameValidation = validateName(formData.name)
  if (!nameValidation.isValid) {
    errors.name = nameValidation.message
  }
  
  // 이메일 검사
  if (!validateEmail(formData.email)) {
    errors.email = '유효한 이메일 주소를 입력해주세요.'
  }
  
  // 비밀번호 검사
  const passwordValidation = validatePassword(formData.password)
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.message
  }
  
  // 비밀번호 확인 검사
  const passwordMatchValidation = validatePasswordMatch(formData.password, formData.confirmPassword)
  if (!passwordMatchValidation.isValid) {
    errors.confirmPassword = passwordMatchValidation.message
  }
  
  // 약관 동의 검사
  if (!formData.agreeTerms) {
    errors.agreeTerms = '이용약관에 동의해주세요.'
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

// 로그인 폼 유효성 검사
export const validateLoginForm = (formData: {
  email: string
  password: string
}): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {}
  
  // 이메일 검사
  if (!validateEmail(formData.email)) {
    errors.email = '유효한 이메일 주소를 입력해주세요.'
  }
  
  // 비밀번호 빈값 검사
  if (!formData.password.trim()) {
    errors.password = '비밀번호를 입력해주세요.'
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
