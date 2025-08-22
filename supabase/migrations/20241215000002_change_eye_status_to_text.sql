-- personalization_data 테이블의 eye_status 컬럼만 numeric에서 text로 변경

-- personalization_data 테이블의 eye_status 컬럼을 text로 변경
DO $$
DECLARE
  current_type text;
BEGIN
  -- 현재 컬럼 타입 확인
  SELECT data_type INTO current_type 
  FROM information_schema.columns 
  WHERE table_name = 'personalization_data' 
  AND column_name = 'eye_status';
  
  RAISE NOTICE '현재 eye_status 타입: %', current_type;
  
  -- numeric 타입인 경우에만 변환
  IF current_type = 'numeric' THEN
    RAISE NOTICE 'numeric에서 text로 변환 중...';
    ALTER TABLE public.personalization_data 
    ALTER COLUMN eye_status TYPE text USING 
      CASE 
        WHEN eye_status >= 0.3 THEN 'OPEN'
        WHEN eye_status < 0.3 THEN 'CLOSED'
        ELSE 'OPEN'
      END;
  ELSIF current_type = 'text' THEN
    RAISE NOTICE '이미 text 타입입니다. 값만 정규화합니다...';
    -- 이미 text 타입인 경우 값만 정규화 (안전한 방법)
    UPDATE public.personalization_data 
    SET eye_status = 
      CASE 
        WHEN eye_status = 'OPEN' THEN 'OPEN'
        WHEN eye_status = 'CLOSED' THEN 'CLOSED'
        WHEN eye_status = 'true' THEN 'OPEN'
        WHEN eye_status = 'false' THEN 'CLOSED'
        WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' THEN
          CASE 
            WHEN eye_status::numeric >= 0.3 THEN 'OPEN'
            ELSE 'CLOSED'
          END
        ELSE 'OPEN'
      END;
  ELSE
    RAISE NOTICE '알 수 없는 타입: %. 기본값으로 설정합니다.', current_type;
    -- 알 수 없는 타입인 경우 기본값으로 설정
    UPDATE public.personalization_data 
    SET eye_status = 'OPEN'
    WHERE eye_status IS NULL OR eye_status = '';
  END IF;
END $$;

-- 기존 numeric 제약조건 제거
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

-- 새로운 text 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'personalization_data' 
    AND constraint_name = 'eye_status_values'
  ) THEN
    ALTER TABLE public.personalization_data 
    ADD CONSTRAINT eye_status_values CHECK (eye_status IN ('OPEN', 'CLOSED'));
  END IF;
END $$;

-- 컬럼 코멘트 업데이트
COMMENT ON COLUMN public.personalization_data.eye_status IS '눈 상태 문자열 (OPEN: 열림, CLOSED: 닫힘)';

-- 마이그레이션 완료 로그
DO $$
BEGIN
  RAISE NOTICE 'personalization_data eye_status 컬럼 마이그레이션 완료!';
END $$;
