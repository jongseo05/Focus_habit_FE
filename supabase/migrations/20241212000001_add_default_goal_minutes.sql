-- user_personalization_models 테이블에 default_goal_minutes 컬럼 추가

-- default_goal_minutes 컬럼 추가 (없는 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_personalization_models' 
    AND column_name = 'default_goal_minutes'
  ) THEN
    ALTER TABLE public.user_personalization_models 
    ADD COLUMN default_goal_minutes integer DEFAULT 30;
  END IF;
END $$;

-- 기존 데이터에 기본값 설정
UPDATE public.user_personalization_models 
SET default_goal_minutes = 30 
WHERE default_goal_minutes IS NULL;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN public.user_personalization_models.default_goal_minutes IS '사용자의 기본 목표 시간 (분). 새로운 집중 세션 시작 시 기본값으로 사용됨';
