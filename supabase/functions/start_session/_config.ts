export const config = {
  cors: {
    origin: "*",
    methods: ["POST", "OPTIONS", "GET", "PUT", "DELETE"],
    allowedHeaders: ["*"],
    credentials: false,
    maxAge: 86400,
  },
  auth: {
    // 인증을 완전히 비활성화
    enabled: false,
    required: false,
    verify: false,
  },
  // 추가 보안 설정 비활성화
  security: {
    enabled: false,
    headers: false,
  },
  // 함수 레벨 설정
  function: {
    public: true,
    noAuth: true,
  }
}
