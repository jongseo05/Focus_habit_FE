-- 1. 현재 eye_status 컬럼 타입 확인
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('personalization_data', 'ml_features', 'focus_sample')
  AND column_name = 'eye_status';

-- 2. personalization_data 테이블의 eye_status 데이터 샘플 확인
SELECT 
  'personalization_data' as table_name,
  eye_status,
  COUNT(*) as count
FROM personalization_data 
GROUP BY eye_status
ORDER BY count DESC;

-- 3. 실제 데이터 몇 개 확인
SELECT 
  id,
  user_id,
  data_type,
  eye_status,
  ear_value,
  created_at
FROM personalization_data 
ORDER BY created_at DESC
LIMIT 5;

-- 4. eye_status 값의 타입 분포 확인
SELECT 
  CASE 
    WHEN eye_status ~ '^[0-9]*\.?[0-9]+$' THEN 'numeric_string'
    WHEN eye_status IN ('OPEN', 'CLOSED') THEN 'status_string'
    WHEN eye_status IN ('true', 'false') THEN 'boolean_string'
    ELSE 'other'
  END as value_type,
  COUNT(*) as count
FROM personalization_data 
GROUP BY value_type;

