-- eye_status 컬럼을 numeric 타입으로 변경하여 원본 수치값 그대로 저장
-- 개인화 모델의 정확도 향상을 위한 데이터 원본성 보존

-- 1. personalization_data 테이블의 eye_status 컬럼을 numeric으로 변경
ALTER TABLE public.personalization_data 
ALTER COLUMN eye_status TYPE numeric(3,2) USING 
  CASE 
    WHEN eye_status::text = 'OPEN' THEN 0.8
    WHEN eye_status::text = 'CLOSED' THEN 0.2
    WHEN eye_status::text = 'true' THEN 0.8
    WHEN eye_status::text = 'false' THEN 0.2
    WHEN eye_status::text ~ '^[0-9]*\.?[0-9]+$' THEN COALESCE(eye_status::text::numeric, 0.5)
    ELSE 0.5
  END;

-- 2. ml_features 테이블의 eye_status 컬럼도 numeric으로 변경
ALTER TABLE public.ml_features 
ALTER COLUMN eye_status TYPE numeric(3,2) USING 
  CASE 
    WHEN eye_status::text = 'OPEN' THEN 0.8
    WHEN eye_status::text = 'CLOSED' THEN 0.2
    WHEN eye_status::text = 'true' THEN 0.8
    WHEN eye_status::text = 'false' THEN 0.2
    WHEN eye_status::text ~ '^[0-9]*\.?[0-9]+$' THEN COALESCE(eye_status::text::numeric, 0.5)
    ELSE 0.5
  END;

-- 3. focus_sample 테이블의 eye_status 컬럼도 numeric으로 변경
ALTER TABLE public.focus_sample 
ALTER COLUMN eye_status TYPE numeric(3,2) USING 
  CASE 
    WHEN eye_status::text = 'OPEN' THEN 0.8
    WHEN eye_status::text = 'CLOSED' THEN 0.2
    WHEN eye_status::text = 'true' THEN 0.8
    WHEN eye_status::text = 'false' THEN 0.2
    WHEN eye_status::text ~ '^[0-9]*\.?[0-9]+$' THEN COALESCE(eye_status::text::numeric, 0.5)
    ELSE 0.5
  END;

-- 4. 컬럼 제약조건 추가 (0.0 ~ 1.0 범위)
ALTER TABLE public.personalization_data 
ADD CONSTRAINT eye_status_range CHECK (eye_status >= 0.0 AND eye_status <= 1.0);

ALTER TABLE public.ml_features 
ADD CONSTRAINT eye_status_range CHECK (eye_status >= 0.0 AND eye_status <= 1.0);

ALTER TABLE public.focus_sample 
ADD CONSTRAINT eye_status_range CHECK (eye_status >= 0.0 AND eye_status <= 1.0);

-- 5. 컬럼 코멘트 업데이트
COMMENT ON COLUMN public.personalization_data.eye_status IS '눈 상태 수치값 (0.0: 완전히 닫힘, 1.0: 완전히 열림, 0.5: 중간값)';
COMMENT ON COLUMN public.ml_features.eye_status IS '눈 상태 수치값 (0.0: 완전히 닫힘, 1.0: 완전히 열림, 0.5: 중간값)';
COMMENT ON COLUMN public.focus_sample.eye_status IS '눈 상태 수치값 (0.0: 완전히 닫힘, 1.0: 완전히 열림, 0.5: 중간값)';

-- 6. 마이그레이션 로그 추가
INSERT INTO public.migration_log (version, description, executed_at, success) 
VALUES ('010b', 'eye_status 컬럼을 numeric 타입으로 변경하여 원본 수치값 보존', now(), true);

-- 7. 변경사항 확인을 위한 코멘트
COMMENT ON COLUMN public.personalization_data.eye_status IS '눈 상태 수치값 (0.0~1.0 범위, 원본 분석 데이터 그대로 저장)';

-- 사용자 개인화 설정 테이블 생성
CREATE TABLE IF NOT EXISTS user_personalization (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  daily_goal_minutes INTEGER DEFAULT 240 NOT NULL, -- 일일 목표 시간 (분)
  preferred_session_length INTEGER DEFAULT 30 NOT NULL, -- 선호 세션 길이 (분)
  break_interval INTEGER DEFAULT 5 NOT NULL, -- 휴식 간격 (분)
  focus_reminder_enabled BOOLEAN DEFAULT true NOT NULL, -- 집중 알림 활성화
  notification_enabled BOOLEAN DEFAULT true NOT NULL, -- 알림 활성화
  theme_preference TEXT DEFAULT 'light' NOT NULL, -- 테마 설정
  language TEXT DEFAULT 'ko' NOT NULL, -- 언어 설정
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id)
);

-- RLS 정책 설정
ALTER TABLE user_personalization ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 개인화 설정만 조회/수정 가능
CREATE POLICY "Users can view own personalization" ON user_personalization
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personalization" ON user_personalization
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personalization" ON user_personalization
  FOR UPDATE USING (auth.uid() = user_id);

-- updated_at 자동 업데이트를 위한 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_personalization_updated_at
  BEFORE UPDATE ON user_personalization
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
