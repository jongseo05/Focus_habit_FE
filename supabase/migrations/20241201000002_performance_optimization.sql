-- =====================================================
-- Focus Habit 데이터베이스 성능 최적화
-- =====================================================

-- =====================================================
-- 추가 인덱스 생성 (성능 최적화)
-- =====================================================

-- 복합 인덱스 (자주 함께 사용되는 컬럼들)
CREATE INDEX IF NOT EXISTS idx_focus_session_user_type_date ON public.focus_session(user_id, session_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_session_room_active ON public.focus_session(room_id, ended_at) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_focus_sample_session_score ON public.focus_sample(session_id, score DESC);

-- 소셜 기능 관련 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_room_participants_room_active ON public.room_participants(room_id, left_at) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_progress ON public.challenge_participants(challenge_id, current_progress DESC);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requested_status ON public.friend_requests(requested_id, status, created_at DESC);

-- 부분 인덱스 (조건부 인덱스로 크기 최적화)
CREATE INDEX IF NOT EXISTS idx_study_rooms_active_public ON public.study_rooms(created_at DESC) WHERE is_active = true AND is_private = false;
CREATE INDEX IF NOT EXISTS idx_group_challenges_active_end_date ON public.group_challenges(end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_personal_challenges_user_active ON public.personal_challenges(user_id, end_date) WHERE is_completed = false;

-- 텍스트 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_search ON public.profiles USING gin(to_tsvector('korean', display_name));
CREATE INDEX IF NOT EXISTS idx_study_rooms_name_search ON public.study_rooms USING gin(to_tsvector('korean', name));
CREATE INDEX IF NOT EXISTS idx_group_challenges_title_search ON public.group_challenges USING gin(to_tsvector('korean', title));

-- =====================================================
-- 파티셔닝 테이블 생성 (대용량 데이터 처리)
-- =====================================================

-- 집중 샘플 데이터를 월별로 파티셔닝 (데이터가 많아질 경우)
-- 기존 테이블을 파티션 테이블로 변환하는 것은 복잡하므로 새로운 구조 제안

-- 월별 파티션을 위한 함수
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I 
                    FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 집계 테이블 (Materialized Views)
-- =====================================================

-- 일별 사용자 통계 집계 뷰
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_user_stats AS
SELECT 
    fs.user_id,
    DATE(fs.started_at) as stat_date,
    COUNT(*) as session_count,
    COALESCE(AVG(fs.focus_score), 0)::REAL as avg_focus_score,
    COALESCE(MAX(fs.focus_score), 0)::REAL as max_focus_score,
    COALESCE(SUM(EXTRACT(EPOCH FROM (fs.ended_at - fs.started_at)) / 60), 0)::INTEGER as total_minutes,
    COALESCE(SUM(fs.distractions), 0)::INTEGER as total_distractions
FROM public.focus_session fs
WHERE fs.ended_at IS NOT NULL
GROUP BY fs.user_id, DATE(fs.started_at);

-- 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_user_stats_user_date ON public.daily_user_stats(user_id, stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_user_stats_date ON public.daily_user_stats(stat_date DESC);

-- 주간 사용자 통계 집계 뷰
CREATE MATERIALIZED VIEW IF NOT EXISTS public.weekly_user_stats AS
SELECT 
    user_id,
    DATE_TRUNC('week', stat_date) as week_start,
    SUM(session_count) as total_sessions,
    AVG(avg_focus_score)::REAL as avg_focus_score,
    MAX(max_focus_score)::REAL as best_focus_score,
    SUM(total_minutes) as total_minutes,
    SUM(total_distractions) as total_distractions,
    COUNT(DISTINCT stat_date) as active_days
FROM public.daily_user_stats
GROUP BY user_id, DATE_TRUNC('week', stat_date);

-- 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_user_stats_user_week ON public.weekly_user_stats(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_user_stats_week ON public.weekly_user_stats(week_start DESC);

-- 스터디룸 통계 집계 뷰
CREATE MATERIALIZED VIEW IF NOT EXISTS public.study_room_stats AS
SELECT 
    sr.room_id,
    sr.name as room_name,
    sr.host_id,
    COUNT(DISTINCT rp.user_id) as total_participants,
    COUNT(DISTINCT CASE WHEN rp.left_at IS NULL THEN rp.user_id END) as current_participants,
    AVG(rp.focus_score) as avg_focus_score,
    MAX(rp.focus_score) as best_focus_score,
    sr.created_at,
    sr.is_active
FROM public.study_rooms sr
LEFT JOIN public.room_participants rp ON sr.room_id = rp.room_id
GROUP BY sr.room_id, sr.name, sr.host_id, sr.created_at, sr.is_active;

-- 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_room_stats_room_id ON public.study_room_stats(room_id);
CREATE INDEX IF NOT EXISTS idx_study_room_stats_active ON public.study_room_stats(is_active, avg_focus_score DESC) WHERE is_active = true;

-- =====================================================
-- 자동 집계 업데이트 함수
-- =====================================================

-- 집계 뷰 새로고침 함수
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_user_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.weekly_user_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.study_room_stats;
END;
$$ LANGUAGE plpgsql;

-- 매시간 집계 뷰 업데이트 (cron 확장이 있다면)
-- SELECT cron.schedule('refresh-stats', '0 * * * *', 'SELECT refresh_materialized_views();');

-- =====================================================
-- 데이터 아카이빙 및 정리 함수
-- =====================================================

-- 오래된 집중 샘플 데이터 정리 (90일 이상)
CREATE OR REPLACE FUNCTION cleanup_old_focus_samples()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.focus_sample 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 완료된 챌린지 아카이빙 (30일 후)
CREATE OR REPLACE FUNCTION archive_completed_challenges()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- 개인 챌린지 비활성화
    UPDATE public.personal_challenges 
    SET updated_at = NOW()
    WHERE is_completed = true 
      AND completed_at < NOW() - INTERVAL '30 days';
    
    -- 그룹 챌린지 비활성화
    UPDATE public.group_challenges 
    SET is_active = false, updated_at = NOW()
    WHERE end_date < NOW() - INTERVAL '30 days'
      AND is_active = true;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- 만료된 초대 정리 (7일 후)
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE public.challenge_invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' 
      AND expires_at < NOW();
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 성능 모니터링 뷰
-- =====================================================

-- 느린 쿼리 감지를 위한 뷰
CREATE OR REPLACE VIEW public.performance_stats AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY schemaname, tablename, attname;

-- 테이블 크기 모니터링 뷰
CREATE OR REPLACE VIEW public.table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 인덱스 사용률 모니터링 뷰
CREATE OR REPLACE VIEW public.index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    CASE WHEN idx_tup_read > 0 
         THEN (idx_tup_fetch::float / idx_tup_read::float * 100)::numeric(5,2)
         ELSE 0 
    END as hit_ratio
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY hit_ratio DESC;

-- =====================================================
-- 데이터 검증 함수
-- =====================================================

-- 데이터 무결성 검증 함수
CREATE OR REPLACE FUNCTION validate_data_integrity()
RETURNS TABLE(
    check_name text,
    status text,
    issue_count bigint,
    description text
) AS $$
BEGIN
    -- 고아 레코드 검사
    RETURN QUERY
    SELECT 
        'orphaned_focus_samples'::text,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::text,
        COUNT(*),
        '집중 세션이 없는 샘플 데이터'::text
    FROM public.focus_sample fs
    LEFT JOIN public.focus_session fsess ON fs.session_id = fsess.session_id
    WHERE fsess.session_id IS NULL;

    RETURN QUERY
    SELECT 
        'orphaned_room_participants'::text,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::text,
        COUNT(*),
        '존재하지 않는 스터디룸의 참가자'::text
    FROM public.room_participants rp
    LEFT JOIN public.study_rooms sr ON rp.room_id = sr.room_id
    WHERE sr.room_id IS NULL;

    -- 데이터 범위 검사
    RETURN QUERY
    SELECT 
        'invalid_focus_scores'::text,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::text,
        COUNT(*),
        '잘못된 집중도 점수 (0-100 범위 외)'::text
    FROM public.focus_session
    WHERE focus_score IS NOT NULL 
      AND (focus_score < 0 OR focus_score > 100);

    -- 시간 일관성 검사
    RETURN QUERY
    SELECT 
        'invalid_session_times'::text,
        CASE WHEN COUNT(*) > 0 THEN 'FAIL' ELSE 'PASS' END::text,
        COUNT(*),
        '종료 시간이 시작 시간보다 이른 세션'::text
    FROM public.focus_session
    WHERE ended_at IS NOT NULL 
      AND ended_at < started_at;

END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 자동 백업 및 유지보수 스케줄
-- =====================================================

-- 매일 자정에 정리 작업 실행
-- SELECT cron.schedule('daily-cleanup', '0 0 * * *', 'SELECT cleanup_old_focus_samples(), cleanup_expired_invitations();');

-- 매주 일요일 새벽에 아카이빙 작업 실행  
-- SELECT cron.schedule('weekly-archive', '0 2 * * 0', 'SELECT archive_completed_challenges();');

-- 매시간 집계 뷰 새로고침
-- SELECT cron.schedule('hourly-refresh', '0 * * * *', 'SELECT refresh_materialized_views();');

-- =====================================================
-- 완료 메시지
-- =====================================================

SELECT 'Focus Habit 데이터베이스 성능 최적화가 완료되었습니다.' as message;
