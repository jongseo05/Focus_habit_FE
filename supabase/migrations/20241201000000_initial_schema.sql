-- =====================================================
-- Focus Habit 데이터베이스 초기 스키마 설정
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. 사용자 프로필 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    school TEXT,
    major TEXT,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'away')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 프로필 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. 집중 세션 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.focus_session (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    room_id UUID, -- 스터디룸 참여 시에만 설정
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    goal_min INTEGER DEFAULT 25,
    context_tag TEXT,
    session_type TEXT DEFAULT 'study' CHECK (session_type IN ('study', 'work', 'reading', 'other', 'study_room')),
    focus_score REAL CHECK (focus_score >= 0 AND focus_score <= 100),
    distractions INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_focus_session_updated_at 
    BEFORE UPDATE ON public.focus_session 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. 집중도 샘플 데이터 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.focus_sample (
    session_id UUID NOT NULL REFERENCES public.focus_session(session_id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    raw_score REAL,
    score_conf REAL,
    score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
    p_eye REAL,
    pose_dev REAL,
    topic_tag TEXT,
    rms_db REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (session_id, ts)
);

-- =====================================================
-- 4. 집중 이벤트 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.focus_event (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.focus_session(session_id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('phone', 'distraction', 'break', 'focus', 'posture', 'audio_analysis')),
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. ML 피처 데이터 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ml_features (
    feature_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.focus_session(session_id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    head_pose_pitch REAL,
    head_pose_yaw REAL,
    head_pose_roll REAL,
    eye_status TEXT,
    ear_value REAL,
    frame_number INTEGER,
    focus_status TEXT CHECK (focus_status IN ('focused', 'normal', 'distracted')),
    focus_confidence REAL CHECK (focus_confidence >= 0 AND focus_confidence <= 1),
    focus_score REAL CHECK (focus_score >= 0 AND focus_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. 스냅샷 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.snapshot (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.focus_session(session_id) ON DELETE CASCADE,
    ts TIMESTAMP WITH TIME ZONE NOT NULL,
    s3_url TEXT,
    thumb_url TEXT,
    focus_score REAL CHECK (focus_score >= 0 AND focus_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. 노트 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.note (
    note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.focus_session(session_id) ON DELETE CASCADE,
    ts_ref TIMESTAMP WITH TIME ZONE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. 일일 요약 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.daily_summary (
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    focus_min INTEGER DEFAULT 0,
    avg_score REAL DEFAULT 0 CHECK (avg_score >= 0 AND avg_score <= 100),
    peak_ts TIMESTAMP WITH TIME ZONE,
    peak REAL,
    drop_ts TIMESTAMP WITH TIME ZONE,
    drop REAL,
    phone_min INTEGER DEFAULT 0,
    quiet_ratio REAL DEFAULT 0 CHECK (quiet_ratio >= 0 AND quiet_ratio <= 1),
    longest_streak INTEGER DEFAULT 0,
    sessions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

CREATE TRIGGER update_daily_summary_updated_at 
    BEFORE UPDATE ON public.daily_summary 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. 주간 요약 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.weekly_summary (
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    iso_year INTEGER NOT NULL,
    iso_week INTEGER NOT NULL CHECK (iso_week >= 1 AND iso_week <= 53),
    avg_score REAL DEFAULT 0 CHECK (avg_score >= 0 AND avg_score <= 100),
    quiet_ratio REAL DEFAULT 0 CHECK (quiet_ratio >= 0 AND quiet_ratio <= 1),
    habit_idx REAL DEFAULT 0,
    total_focus_min INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, iso_year, iso_week)
);

CREATE TRIGGER update_weekly_summary_updated_at 
    BEFORE UPDATE ON public.weekly_summary 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. 보상 클레임 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.reward_claim (
    claim_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    exp INTEGER DEFAULT 0,
    sticker_id TEXT,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. 루틴 토글 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.routine_toggle (
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    routine_id TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, routine_id)
);

CREATE TRIGGER update_routine_toggle_updated_at 
    BEFORE UPDATE ON public.routine_toggle 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 12. 습관 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_habits_updated_at 
    BEFORE UPDATE ON public.habits 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 13. 습관 기록 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.habit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed_count INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 인덱스 생성
-- =====================================================

-- 프로필 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 집중 세션 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_focus_session_user_id ON public.focus_session(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_session_started_at ON public.focus_session(started_at);
CREATE INDEX IF NOT EXISTS idx_focus_session_user_started ON public.focus_session(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_session_room_id ON public.focus_session(room_id) WHERE room_id IS NOT NULL;

-- 집중 샘플 인덱스
CREATE INDEX IF NOT EXISTS idx_focus_sample_session_ts ON public.focus_sample(session_id, ts);

-- 집중 이벤트 인덱스
CREATE INDEX IF NOT EXISTS idx_focus_event_session_id ON public.focus_event(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_event_ts ON public.focus_event(ts);

-- ML 피처 인덱스
CREATE INDEX IF NOT EXISTS idx_ml_features_session_id ON public.ml_features(session_id);
CREATE INDEX IF NOT EXISTS idx_ml_features_ts ON public.ml_features(ts);

-- 요약 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON public.daily_summary(date);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_year_week ON public.weekly_summary(iso_year, iso_week);

-- 보상 및 습관 인덱스
CREATE INDEX IF NOT EXISTS idx_reward_claim_user_date ON public.reward_claim(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON public.habits(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_habit_records_habit_date ON public.habit_records(habit_id, date);

-- =====================================================
-- RLS (Row Level Security) 설정
-- =====================================================

-- 프로필 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 프로필만 조회 가능" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "사용자는 자신의 프로필만 업데이트 가능" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- 집중 세션 RLS
ALTER TABLE public.focus_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 세션만 접근 가능" ON public.focus_session FOR ALL USING (auth.uid() = user_id);

-- 집중 샘플 RLS
ALTER TABLE public.focus_sample ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 세션 샘플만 접근 가능" ON public.focus_sample FOR ALL 
USING (EXISTS (SELECT 1 FROM public.focus_session WHERE focus_session.session_id = focus_sample.session_id AND focus_session.user_id = auth.uid()));

-- 집중 이벤트 RLS
ALTER TABLE public.focus_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 세션 이벤트만 접근 가능" ON public.focus_event FOR ALL 
USING (EXISTS (SELECT 1 FROM public.focus_session WHERE focus_session.session_id = focus_event.session_id AND focus_session.user_id = auth.uid()));

-- ML 피처 RLS
ALTER TABLE public.ml_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 세션 ML 피처만 접근 가능" ON public.ml_features FOR ALL 
USING (EXISTS (SELECT 1 FROM public.focus_session WHERE focus_session.session_id = ml_features.session_id AND focus_session.user_id = auth.uid()));

-- 스냅샷 RLS
ALTER TABLE public.snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 세션 스냅샷만 접근 가능" ON public.snapshot FOR ALL 
USING (EXISTS (SELECT 1 FROM public.focus_session WHERE focus_session.session_id = snapshot.session_id AND focus_session.user_id = auth.uid()));

-- 노트 RLS
ALTER TABLE public.note ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 세션 노트만 접근 가능" ON public.note FOR ALL 
USING (EXISTS (SELECT 1 FROM public.focus_session WHERE focus_session.session_id = note.session_id AND focus_session.user_id = auth.uid()));

-- 요약 테이블 RLS
ALTER TABLE public.daily_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 일일 요약만 접근 가능" ON public.daily_summary FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.weekly_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 주간 요약만 접근 가능" ON public.weekly_summary FOR ALL USING (auth.uid() = user_id);

-- 보상 및 습관 RLS
ALTER TABLE public.reward_claim ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 보상만 접근 가능" ON public.reward_claim FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.routine_toggle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 루틴만 접근 가능" ON public.routine_toggle FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 습관만 접근 가능" ON public.habits FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.habit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 습관 기록만 접근 가능" ON public.habit_records FOR ALL 
USING (EXISTS (SELECT 1 FROM public.habits WHERE habits.id = habit_records.habit_id AND habits.user_id = auth.uid()));

-- =====================================================
-- 유용한 뷰 생성
-- =====================================================

-- 오늘 집중 요약 뷰
CREATE OR REPLACE VIEW public.today_focus_summary AS
SELECT 
    fs.user_id,
    COUNT(*) as sessions_count,
    COALESCE(SUM(EXTRACT(EPOCH FROM (fs.ended_at - fs.started_at)) / 60), 0)::INTEGER as total_minutes,
    COALESCE(AVG(fs.focus_score), 0)::REAL as avg_score,
    COALESCE(MAX(fs.focus_score), 0)::REAL as max_score
FROM public.focus_session fs
WHERE DATE(fs.started_at) = CURRENT_DATE
  AND fs.ended_at IS NOT NULL
GROUP BY fs.user_id;

-- 주간 집중 통계 뷰
CREATE OR REPLACE VIEW public.weekly_focus_stats AS
SELECT 
    fs.user_id,
    DATE_TRUNC('week', fs.started_at) as week_start,
    COUNT(*) as sessions_count,
    COALESCE(SUM(EXTRACT(EPOCH FROM (fs.ended_at - fs.started_at)) / 60), 0)::INTEGER as total_minutes,
    COALESCE(AVG(fs.focus_score), 0)::REAL as avg_score
FROM public.focus_session fs
WHERE fs.started_at >= DATE_TRUNC('week', CURRENT_DATE)
  AND fs.ended_at IS NOT NULL
GROUP BY fs.user_id, DATE_TRUNC('week', fs.started_at);

-- =====================================================
-- 스토리지 버킷 설정
-- =====================================================

-- 프로필 이미지 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- 스냅샷 이미지 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-snapshots', 'session-snapshots', false)
ON CONFLICT (id) DO NOTHING;

-- 스토리지 RLS 정책
CREATE POLICY "프로필 이미지 업로드 정책" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "프로필 이미지 조회 정책" ON storage.objects FOR SELECT 
USING (bucket_id = 'profile-images');

CREATE POLICY "프로필 이미지 삭제 정책" ON storage.objects FOR DELETE 
USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "세션 스냅샷 업로드 정책" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'session-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "세션 스냅샷 조회 정책" ON storage.objects FOR SELECT 
USING (bucket_id = 'session-snapshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- 완료 메시지
-- =====================================================

-- 초기 스키마 설정 완료
SELECT 'Focus Habit 데이터베이스 초기 스키마 설정이 완료되었습니다.' as message;
