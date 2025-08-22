-- 개인화 데이터 정리를 위한 마이그레이션
-- 불완전한 세션 데이터의 자동 정리를 위한 인덱스 및 정책 추가

-- 1. created_at 컬럼에 대한 인덱스 추가 (정리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_personalization_data_created_at 
ON public.personalization_data(created_at);

-- 2. session_id와 created_at 복합 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_personalization_data_session_created 
ON public.personalization_data(session_id, created_at);

-- 3. 사용자별 세션 통계를 위한 함수 생성
CREATE OR REPLACE FUNCTION get_personalization_session_stats(user_uuid UUID)
RETURNS TABLE (
  session_id TEXT,
  focus_count BIGINT,
  nonfocus_count BIGINT,
  total_count BIGINT,
  created_at TIMESTAMPTZ,
  is_incomplete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pd.session_id,
    COUNT(CASE WHEN pd.data_type = 'focus' THEN 1 END) as focus_count,
    COUNT(CASE WHEN pd.data_type = 'nonfocus' THEN 1 END) as nonfocus_count,
    COUNT(*) as total_count,
    MIN(pd.created_at) as created_at,
    pd.session_id LIKE '%_incomplete_%' as is_incomplete
  FROM public.personalization_data pd
  WHERE pd.user_id = user_uuid
  GROUP BY pd.session_id
  ORDER BY MIN(pd.created_at) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 오래된 불완전한 세션을 자동으로 정리하는 함수
CREATE OR REPLACE FUNCTION cleanup_old_incomplete_sessions(
  older_than_hours INTEGER DEFAULT 24,
  min_data_count INTEGER DEFAULT 10
)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  cutoff_time TIMESTAMPTZ;
BEGIN
  cutoff_time := NOW() - INTERVAL '1 hour' * older_than_hours;
  
  -- 불완전한 세션 찾기 (데이터가 적고 오래된 세션)
  WITH sessions_to_delete AS (
    SELECT session_id
    FROM public.personalization_data
    WHERE created_at < cutoff_time
    GROUP BY session_id
    HAVING COUNT(*) < min_data_count
  )
  DELETE FROM public.personalization_data
  WHERE session_id IN (SELECT session_id FROM sessions_to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4-1. 5분을 초과한 데이터를 필터링하는 함수
CREATE OR REPLACE FUNCTION filter_personalization_data_by_time(
  session_id_param TEXT,
  max_duration_minutes INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  session_id TEXT,
  data_type TEXT,
  timestamp TIMESTAMPTZ,
  eye_status TEXT,
  ear_value NUMERIC,
  head_pose_pitch NUMERIC,
  head_pose_yaw NUMERIC,
  head_pose_roll NUMERIC,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  session_start_time TIMESTAMPTZ;
  max_duration_ms BIGINT;
BEGIN
  -- 세션 시작 시간 찾기
  SELECT MIN(timestamp) INTO session_start_time
  FROM public.personalization_data
  WHERE session_id = session_id_param;
  
  -- 최대 지속 시간을 밀리초로 변환
  max_duration_ms := max_duration_minutes * 60 * 1000;
  
  -- 5분 이내의 데이터만 반환
  RETURN QUERY
  SELECT 
    pd.id,
    pd.user_id,
    pd.session_id,
    pd.data_type,
    pd.timestamp,
    pd.eye_status,
    pd.ear_value,
    pd.head_pose_pitch,
    pd.head_pose_yaw,
    pd.head_pose_roll,
    pd.created_at
  FROM public.personalization_data pd
  WHERE pd.session_id = session_id_param
    AND EXTRACT(EPOCH FROM (pd.timestamp - session_start_time)) * 1000 <= max_duration_ms
  ORDER BY pd.timestamp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 세션 완료 상태를 추적하는 뷰 생성 (시간 기반)
CREATE OR REPLACE VIEW personalization_session_status AS
SELECT 
  user_id,
  session_id,
  COUNT(*) as total_samples,
  COUNT(CASE WHEN data_type = 'focus' THEN 1 END) as focus_samples,
  COUNT(CASE WHEN data_type = 'nonfocus' THEN 1 END) as nonfocus_samples,
  MIN(created_at) as session_start,
  MAX(created_at) as session_end,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 as duration_minutes,
  CASE 
    WHEN EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 >= 4.5 AND
         COUNT(*) >= 80 AND
         COUNT(CASE WHEN data_type = 'focus' THEN 1 END) >= 25 AND
         COUNT(CASE WHEN data_type = 'nonfocus' THEN 1 END) >= 25
    THEN 'completed'
    WHEN session_id LIKE '%_incomplete_%'
    THEN 'incomplete'
    ELSE 'in_progress'
  END as status
FROM public.personalization_data
GROUP BY user_id, session_id;

-- 6. RLS 정책에 정리 권한 추가
DO $$
BEGIN
  -- 기존 정책이 있는지 확인하고 없으면 생성
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'personalization_data' 
    AND policyname = 'Users can cleanup own incomplete sessions'
  ) THEN
    CREATE POLICY "Users can cleanup own incomplete sessions" ON public.personalization_data
      FOR DELETE USING (
        auth.uid() = user_id AND 
        session_id LIKE '%_incomplete_%'
      );
  END IF;
END $$;

-- 7. 정리 통계를 위한 뷰 생성
CREATE OR REPLACE VIEW personalization_cleanup_stats AS
SELECT 
  COUNT(DISTINCT session_id) as total_sessions,
  COUNT(DISTINCT CASE WHEN status = 'completed' THEN session_id END) as completed_sessions,
  COUNT(DISTINCT CASE WHEN status = 'incomplete' THEN session_id END) as incomplete_sessions,
  COUNT(DISTINCT CASE WHEN status = 'in_progress' THEN session_id END) as in_progress_sessions,
  AVG(total_samples) as avg_samples_per_session,
  MIN(session_start) as oldest_session,
  MAX(session_end) as newest_session
FROM personalization_session_status;

-- 8. 코멘트 추가
COMMENT ON FUNCTION get_personalization_session_stats(UUID) IS '사용자의 개인화 세션 통계를 반환합니다';
COMMENT ON FUNCTION cleanup_old_incomplete_sessions(INTEGER, INTEGER) IS '오래된 불완전한 세션을 정리합니다';
COMMENT ON FUNCTION filter_personalization_data_by_time(TEXT, INTEGER) IS '5분을 초과한 데이터를 필터링합니다';
COMMENT ON VIEW personalization_session_status IS '개인화 세션의 완료 상태를 추적합니다 (시간 기반)';
COMMENT ON VIEW personalization_cleanup_stats IS '개인화 데이터 정리 통계를 제공합니다';
