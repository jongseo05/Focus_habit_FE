-- 개인화 모델을 위한 테이블 수정 (기존 테이블에 컬럼 추가)

-- user_personalization_models 테이블에 model_version 컬럼 추가 (없는 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_personalization_models' 
    AND column_name = 'model_version'
  ) THEN
    ALTER TABLE public.user_personalization_models 
    ADD COLUMN model_version text DEFAULT '1.0.0';
  END IF;
END $$;

-- model_version 컬럼에 대한 인덱스 추가 (없는 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'user_personalization_models' 
    AND indexname = 'idx_user_personalization_models_version'
  ) THEN
    CREATE INDEX idx_user_personalization_models_version ON public.user_personalization_models(model_version);
  END IF;
END $$;

-- 트리거 함수: 완료율 자동 계산 (없는 경우에만 생성)
CREATE OR REPLACE FUNCTION update_personalization_completion_percentage()
RETURNS TRIGGER AS $$
BEGIN
  NEW.completion_percentage = LEAST(100, 
    ((NEW.focus_samples_collected + NEW.non_focus_samples_collected) * 100) / NEW.total_samples_needed
  );
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (없는 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_update_personalization_completion'
  ) THEN
    CREATE TRIGGER trigger_update_personalization_completion
      BEFORE UPDATE ON public.user_personalization_models
      FOR EACH ROW
      EXECUTE FUNCTION update_personalization_completion_percentage();
  END IF;
END $$;

-- 초기 모델 정보 자동 생성 함수 (없는 경우에만 생성)
CREATE OR REPLACE FUNCTION create_initial_personalization_model()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_personalization_models (user_id, model_version)
  VALUES (NEW.id, '1.0.0')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 새 사용자 등록 시 개인화 모델 정보 자동 생성 트리거 (없는 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_create_initial_personalization_model'
  ) THEN
    CREATE TRIGGER trigger_create_initial_personalization_model
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_initial_personalization_model();
  END IF;
END $$;

-- RLS 정책이 없는 경우에만 생성
DO $$ 
BEGIN
  -- personalization_data 테이블에 대한 RLS 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'personalization_data' 
    AND policyname = 'Users can view own personalization data'
  ) THEN
    CREATE POLICY "Users can view own personalization data" ON public.personalization_data
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'personalization_data' 
    AND policyname = 'Users can insert own personalization data'
  ) THEN
    CREATE POLICY "Users can insert own personalization data" ON public.personalization_data
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'personalization_data' 
    AND policyname = 'Users can update own personalization data'
  ) THEN
    CREATE POLICY "Users can update own personalization data" ON public.personalization_data
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'personalization_data' 
    AND policyname = 'Users can delete own personalization data'
  ) THEN
    CREATE POLICY "Users can delete own personalization data" ON public.personalization_data
      FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- user_personalization_models 테이블에 대한 RLS 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_personalization_models' 
    AND policyname = 'Users can view own model info'
  ) THEN
    CREATE POLICY "Users can view own model info" ON public.user_personalization_models
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_personalization_models' 
    AND policyname = 'Users can insert own model info'
  ) THEN
    CREATE POLICY "Users can insert own model info" ON public.user_personalization_models
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_personalization_models' 
    AND policyname = 'Users can update own model info'
  ) THEN
    CREATE POLICY "Users can update own model info" ON public.user_personalization_models
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_personalization_models' 
    AND policyname = 'Users can delete own model info'
  ) THEN
    CREATE POLICY "Users can delete own model info" ON public.user_personalization_models
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 코멘트 추가 (없는 경우에만)
COMMENT ON COLUMN public.user_personalization_models.model_version IS '개인화 모델 버전 (예: 1.0.0)';
