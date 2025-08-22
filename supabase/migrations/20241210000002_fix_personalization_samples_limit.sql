-- 개인화 데이터 수집 한도를 100개에서 1000개로 증가 (수정 버전)
-- 더 정확한 개인화 모델 학습을 위한 샘플 수 증가

-- 1. user_personalization_models 테이블의 total_samples_needed 기본값 변경
ALTER TABLE public.user_personalization_models 
ALTER COLUMN total_samples_needed SET DEFAULT 1000;

-- 2. 기존 사용자들의 total_samples_needed 값을 1000으로 업데이트
UPDATE public.user_personalization_models 
SET total_samples_needed = 1000, 
    completion_percentage = LEAST(100, ROUND((focus_samples_collected + non_focus_samples_collected) * 100.0 / 1000, 0)),
    updated_at = now()
WHERE total_samples_needed = 100;

-- 3. 마이그레이션 로그 추가
INSERT INTO public.migration_log (version, description, executed_at, success) 
VALUES ('010c', '개인화 데이터 수집 한도를 100개에서 1000개로 증가 (수정 버전)', now(), true);

-- 4. 변경사항 확인을 위한 로그
DO $$
BEGIN
    RAISE NOTICE '개인화 데이터 수집 한도가 1000개로 증가되었습니다.';
    RAISE NOTICE '기존 사용자들의 total_samples_needed 값이 업데이트되었습니다.';
END $$;
