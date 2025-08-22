-- 현재 eye_status 컬럼 타입 확인
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('personalization_data', 'ml_features', 'focus_sample')
  AND column_name = 'eye_status';

-- 현재 데이터 샘플 확인
SELECT 
  'personalization_data' as table_name,
  eye_status,
  COUNT(*) as count
FROM personalization_data 
GROUP BY eye_status
LIMIT 10;

