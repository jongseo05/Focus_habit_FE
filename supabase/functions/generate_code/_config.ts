export const config = {
  cors: {
    origin: "*",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["authorization", "x-client-info", "apikey", "content-type"],
  },
  auth: {
    // 인증을 완전히 비활성화
    enabled: false,
  },
}
