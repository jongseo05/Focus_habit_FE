-- =====================================================
-- 세션 데이터 디버깅 SQL 스크립트
-- Supabase SQL 에디터에서 실행하세요
-- =====================================================

-- 1. 최근 세션 데이터 확인
SELECT 
    'focus_session' as table_name,
    COUNT(*) as record_count,
    MAX(fs.created_at) as latest_record
FROM focus_session fs
WHERE fs.user_id = '585b1b78-6796-4807-8798-ff82f1f49754' -- 실제 사용자 ID로 변경

UNION ALL

SELECT 
    'focus_sample' as table_name,
    COUNT(*) as record_count,
    MAX(fsamp.created_at) as latest_record
FROM focus_sample fsamp
JOIN focus_session fses ON fsamp.session_id = fses.session_id
WHERE fses.user_id = '585b1b78-6796-4807-8798-ff82f1f49754' -- 실제 사용자 ID로 변경

UNION ALL

SELECT 
    'focus_event' as table_name,
    COUNT(*) as record_count,
    MAX(fevt.created_at) as latest_record
FROM focus_event fevt
JOIN focus_session fses ON fevt.session_id = fses.session_id
WHERE fses.user_id = '585b1b78-6796-4807-8798-ff82f1f49754'; -- 실제 사용자 ID로 변경

-- 2. 최근 7일간 세션 상세 정보
SELECT 
    session_id,
    started_at,
    ended_at,
    focus_score,
    context_tag,
    session_type,
    CASE 
        WHEN ended_at IS NULL THEN '진행 중'
        ELSE '완료'
    END as status,
    CASE 
        WHEN ended_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
        ELSE NULL
    END as duration_minutes
FROM focus_session 
WHERE user_id = '585b1b78-6796-4807-8798-ff82f1f49754' -- 실제 사용자 ID로 변경
    AND started_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY started_at DESC;

-- 3. 세션별 샘플 데이터 수
SELECT 
    fs.session_id,
    fs.started_at,
    fs.ended_at,
    COUNT(fsamp.ts) as sample_count,
    COUNT(fevt.ts) as event_count,
    AVG(fsamp.score) as avg_score
FROM focus_session fs
LEFT JOIN focus_sample fsamp ON fs.session_id = fsamp.session_id
LEFT JOIN focus_event fevt ON fs.session_id = fevt.session_id
WHERE fs.user_id = '585b1b78-6796-4807-8798-ff82f1f49754' -- 실제 사용자 ID로 변경
    AND fs.started_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY fs.session_id, fs.started_at, fs.ended_at
ORDER BY fs.started_at DESC;

-- 4. 일일 요약 데이터 확인
SELECT 
    date,
    focus_min,
    avg_score,
    sessions_count,
    created_at,
    updated_at
FROM daily_summary 
WHERE user_id = '585b1b78-6796-4807-8798-ff82f1f49754' -- 실제 사용자 ID로 변경
ORDER BY date DESC
LIMIT 10;

-- 5. RLS 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('focus_session', 'focus_sample', 'focus_event', 'daily_summary');
