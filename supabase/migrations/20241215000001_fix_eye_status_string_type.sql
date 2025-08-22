-- eye_status 컬럼을 문자열 타입으로 변경하여 JSON 출력 형식에 맞게 수정
-- 개인화 모델의 JSON 출력 형식 통일을 위한 마이그레이션

-- 1. personalization_data 테이블의 eye_status 컬럼을 text로 변경
-- 먼저 현재 컬럼 타입을 확인하고 적절히 변환
DO $$
DECLARE
  current_type text;
BEGIN
  -- 현재 컬럼 타입 확인
  SELECT data_type INTO current_type 
  FROM information_schema.columns 
  WHERE table_name = 'personalization_data' 
  AND column_name = 'eye_status';
  
  -- numeric 타입인 경우에만 변환
  IF current_type = 'numeric' THEN
    ALTER TABLE public.personalization_data 
    ALTER COLUMN eye_status TYPE text USING 
      CASE 
        WHEN eye_status >= 0.3 THEN 'OPEN'
        WHEN eye_status < 0.3 THEN 'CLOSED'
        ELSE 'OPEN'
      END;
  ELSIF current_type = 'text' THEN
    -- 이미 text 타입인 경우 값만 정규화
    UPDATE public.personalization_data 
    SET eye_status = 
      CASE 
        WHEN eye_status = 'OPEN' THEN 'OPEN'
        WHEN eye_status = 'CLOSED' THEN 'CLOSED'
        WHEN eye_status = 'true' THEN 'OPEN'
        WHEN eye_status = 'false' THEN 'CLOSED'
        WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' AND eye_status::numeric >= 0.3 THEN 'OPEN'
        WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' AND eye_status::numeric < 0.3 THEN 'CLOSED'
        ELSE 'OPEN'
      END;
  END IF;
END $$;

-- 2. ml_features 테이블의 eye_status 컬럼도 text로 변경 (존재하는 경우)
DO $$ 
DECLARE
  current_type text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ml_features' 
    AND column_name = 'eye_status'
  ) THEN
    -- 현재 컬럼 타입 확인
    SELECT data_type INTO current_type 
    FROM information_schema.columns 
    WHERE table_name = 'ml_features' 
    AND column_name = 'eye_status';
    
    -- numeric 타입인 경우에만 변환
    IF current_type = 'numeric' THEN
      ALTER TABLE public.ml_features 
      ALTER COLUMN eye_status TYPE text USING 
        CASE 
          WHEN eye_status >= 0.3 THEN 'OPEN'
          WHEN eye_status < 0.3 THEN 'CLOSED'
          ELSE 'OPEN'
        END;
    ELSIF current_type = 'text' THEN
      -- 이미 text 타입인 경우 값만 정규화
      UPDATE public.ml_features 
      SET eye_status = 
        CASE 
          WHEN eye_status = 'OPEN' THEN 'OPEN'
          WHEN eye_status = 'CLOSED' THEN 'CLOSED'
          WHEN eye_status = 'true' THEN 'OPEN'
          WHEN eye_status = 'false' THEN 'CLOSED'
          WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' AND eye_status::numeric >= 0.3 THEN 'OPEN'
          WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' AND eye_status::numeric < 0.3 THEN 'CLOSED'
          ELSE 'OPEN'
        END;
    END IF;
  END IF;
END $$;

-- 3. focus_sample 테이블의 eye_status 컬럼도 text로 변경 (존재하는 경우)
DO $$ 
DECLARE
  current_type text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'focus_sample' 
    AND column_name = 'eye_status'
  ) THEN
    -- 현재 컬럼 타입 확인
    SELECT data_type INTO current_type 
    FROM information_schema.columns 
    WHERE table_name = 'focus_sample' 
    AND column_name = 'eye_status';
    
    -- numeric 타입인 경우에만 변환
    IF current_type = 'numeric' THEN
      ALTER TABLE public.focus_sample 
      ALTER COLUMN eye_status TYPE text USING 
        CASE 
          WHEN eye_status >= 0.3 THEN 'OPEN'
          WHEN eye_status < 0.3 THEN 'CLOSED'
          ELSE 'OPEN'
        END;
    ELSIF current_type = 'text' THEN
      -- 이미 text 타입인 경우 값만 정규화
      UPDATE public.focus_sample 
      SET eye_status = 
        CASE 
          WHEN eye_status = 'OPEN' THEN 'OPEN'
          WHEN eye_status = 'CLOSED' THEN 'CLOSED'
          WHEN eye_status = 'true' THEN 'OPEN'
          WHEN eye_status = 'false' THEN 'CLOSED'
          WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' AND eye_status::numeric >= 0.3 THEN 'OPEN'
          WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' AND eye_status::numeric < 0.3 THEN 'CLOSED'
          ELSE 'OPEN'
        END;
    END IF;
  END IF;
END $$;

-- 4. 기존 제약조건 제거 (numeric 범위 제약조건)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'personalization_data' 
    AND constraint_name = 'eye_status_range'
  ) THEN
    ALTER TABLE public.personalization_data DROP CONSTRAINT eye_status_range;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'ml_features' 
    AND constraint_name = 'eye_status_range'
  ) THEN
    ALTER TABLE public.ml_features DROP CONSTRAINT eye_status_range;
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'focus_sample' 
    AND constraint_name = 'eye_status_range'
  ) THEN
    ALTER TABLE public.focus_sample DROP CONSTRAINT eye_status_range;
  END IF;
END $$;

-- 5. 새로운 제약조건 추가 (문자열 값 제한)
ALTER TABLE public.personalization_data 
ADD CONSTRAINT eye_status_values CHECK (eye_status IN ('OPEN', 'CLOSED'));

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ml_features' 
    AND column_name = 'eye_status'
  ) THEN
    ALTER TABLE public.ml_features 
    ADD CONSTRAINT eye_status_values CHECK (eye_status IN ('OPEN', 'CLOSED'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'focus_sample' 
    AND column_name = 'eye_status'
  ) THEN
    ALTER TABLE public.focus_sample 
    ADD CONSTRAINT eye_status_values CHECK (eye_status IN ('OPEN', 'CLOSED'));
  END IF;
END $$;

-- 6. 컬럼 코멘트 업데이트
COMMENT ON COLUMN public.personalization_data.eye_status IS '눈 상태 문자열 (OPEN: 열림, CLOSED: 닫힘)';
COMMENT ON COLUMN public.ml_features.eye_status IS '눈 상태 문자열 (OPEN: 열림, CLOSED: 닫힘)';
COMMENT ON COLUMN public.focus_sample.eye_status IS '눈 상태 문자열 (OPEN: 열림, CLOSED: 닫힘)';

-- 7. 마이그레이션 로그 추가
INSERT INTO public.migration_log (version, description, executed_at, success) 
VALUES ('011a', 'eye_status 컬럼을 문자열 타입으로 변경하여 JSON 출력 형식 통일', now(), true);

-- 8. 변경사항 확인을 위한 통계 출력
DO $$
DECLARE
  total_count INTEGER;
  open_count INTEGER;
  closed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.personalization_data;
  SELECT COUNT(*) INTO open_count FROM public.personalization_data WHERE eye_status = 'OPEN';
  SELECT COUNT(*) INTO closed_count FROM public.personalization_data WHERE eye_status = 'CLOSED';
  
  RAISE NOTICE '마이그레이션 완료 - 총 데이터: %, OPEN: %, CLOSED: %', total_count, open_count, closed_count;
END $$;
