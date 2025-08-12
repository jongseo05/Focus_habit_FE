-- Focus Habit Frontend Database Schema
-- Supabase SQL Editor에서 실행할 스크립트

-- =====================================================
-- 1. 사용자 테이블 확장 (auth.users 기반)
-- =====================================================

-- 사용자 프로필 정보를 위한 뷰 생성
CREATE OR REPLACE VIEW user_profile AS
SELECT 
  id as user_id,
  email,
  created_at,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'avatar_url' as avatar_url,
  raw_user_meta_data->>'bio' as bio,
  raw_user_meta_data->>'time_zone' as time_zone,
  raw_user_meta_data->>'prefs' as prefs
FROM auth.users;

-- =====================================================
-- 2. 집중 세션 테이블 (기존 focus_session 활용)
-- =====================================================

-- 집중 세션 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS focus_session (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  goal_min INTEGER,
  context_tag TEXT,
  session_type TEXT DEFAULT 'study',
  focus_score NUMERIC,
  distractions INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. 집중 샘플 데이터 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS focus_sample (
  session_id UUID REFERENCES focus_session(session_id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMP WITH TIME ZONE NOT NULL,
  raw_score SMALLINT,
  score_conf NUMERIC,
  score SMALLINT,
  p_eye REAL,
  pose_dev REAL,
  topic_tag TEXT,
  rms_db REAL,
  ear_value NUMERIC, -- EAR 값 추가
  eye_status VARCHAR(10), -- 눈 상태 추가
  head_pose_pitch NUMERIC, -- 머리 자세 추가
  head_pose_yaw NUMERIC,
  head_pose_roll NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (session_id, ts)
);

-- =====================================================
-- 3.1. ML 피쳐값 테이블 (웹소켓으로 받은 실시간 데이터)
-- =====================================================

CREATE TABLE IF NOT EXISTS ml_features (
  feature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES focus_session(session_id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMP WITH TIME ZONE NOT NULL,
  head_pose_pitch NUMERIC,
  head_pose_yaw NUMERIC,
  head_pose_roll NUMERIC,
  eye_status VARCHAR(10), -- 'OPEN', 'CLOSED', 'PARTIAL'
  ear_value NUMERIC,
  frame_number INTEGER,
  focus_status VARCHAR(20) DEFAULT 'normal', -- 'focused', 'normal', 'distracted'
  focus_confidence NUMERIC DEFAULT 0.5, -- 0.0 ~ 1.0
  focus_score INTEGER DEFAULT 50, -- 0 ~ 100
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ML 피쳐값 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ml_features_session ON ml_features(session_id);
CREATE INDEX IF NOT EXISTS idx_ml_features_timestamp ON ml_features(ts);
CREATE INDEX IF NOT EXISTS idx_ml_features_frame ON ml_features(frame_number);

-- =====================================================
-- 4. 집중 이벤트 테이블
-- =====================================================

-- 이벤트 타입 열거형 생성
DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('phone', 'distraction', 'break', 'focus', 'posture', 'audio_analysis');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS focus_event (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES focus_session(session_id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type event_type NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. 스냅샷 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS snapshot (
  snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES focus_session(session_id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMP WITH TIME ZONE NOT NULL,
  s3_url TEXT,
  thumb_url TEXT,
  focus_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. 노트 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS note (
  note_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES focus_session(session_id) ON DELETE CASCADE NOT NULL,
  ts_ref TIMESTAMP WITH TIME ZONE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. 일일 요약 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS daily_summary (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  focus_min INTEGER DEFAULT 0,
  avg_score NUMERIC DEFAULT 0,
  peak_ts TIMESTAMP WITH TIME ZONE,
  peak SMALLINT,
  drop_ts TIMESTAMP WITH TIME ZONE,
  drop SMALLINT,
  phone_min INTEGER DEFAULT 0,
  quiet_ratio NUMERIC DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- =====================================================
-- 8. 주간 요약 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS weekly_summary (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  iso_year INTEGER NOT NULL,
  iso_week INTEGER NOT NULL,
  avg_score NUMERIC DEFAULT 0,
  quiet_ratio NUMERIC DEFAULT 0,
  habit_idx NUMERIC DEFAULT 0,
  total_focus_min INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, iso_year, iso_week)
);

-- =====================================================
-- 9. 보상 클레임 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS reward_claim (
  claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  exp INTEGER DEFAULT 0,
  sticker_id TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. 루틴 토글 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS routine_toggle (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  routine_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, routine_id)
);

-- =====================================================
-- 11. 습관 관리 테이블 (기존 코드 호환성)
-- =====================================================

CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  completed_count INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. 워치 연동 관련 테이블들
-- =====================================================

-- 워치 연결 코드 테이블
CREATE TABLE IF NOT EXISTS watch_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(4) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 워치 연결 정보 테이블
CREATE TABLE IF NOT EXISTS watch_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  watch_id VARCHAR(255) NOT NULL,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  disconnected_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 집중 세션 테이블 업데이트 (device_type 추가)
ALTER TABLE focus_session 
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'web',
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- 집중 샘플 테이블 업데이트 (센서 데이터 추가)
ALTER TABLE focus_sample 
ADD COLUMN IF NOT EXISTS heart_rate INTEGER,
ADD COLUMN IF NOT EXISTS steps INTEGER,
ADD COLUMN IF NOT EXISTS activity_level VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50) DEFAULT 'web',
ADD COLUMN IF NOT EXISTS sample_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ear_value NUMERIC, -- EAR 값 추가
ADD COLUMN IF NOT EXISTS eye_status VARCHAR(10), -- 눈 상태 추가
ADD COLUMN IF NOT EXISTS head_pose_pitch NUMERIC, -- 머리 자세 추가
ADD COLUMN IF NOT EXISTS head_pose_yaw NUMERIC,
ADD COLUMN IF NOT EXISTS head_pose_roll NUMERIC;

-- ML 피쳐 테이블 업데이트 (집중 상태 컬럼 추가)
ALTER TABLE ml_features 
ADD COLUMN IF NOT EXISTS focus_status VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS focus_confidence NUMERIC DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS focus_score INTEGER DEFAULT 50;

-- 집계 데이터 테이블 (3초 단위 집계)
CREATE TABLE IF NOT EXISTS focus_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES focus_session(session_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  aggregate_start TIMESTAMP WITH TIME ZONE NOT NULL,
  aggregate_end TIMESTAMP WITH TIME ZONE NOT NULL,
  avg_heart_rate NUMERIC,
  dominant_activity VARCHAR(50),
  sample_count INTEGER DEFAULT 0,
  device_type VARCHAR(50) DEFAULT 'watch',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (조건부)
DO $$ 
BEGIN
  -- watch_connections 테이블이 존재하고 watch_id 컬럼이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'watch_connections' 
    AND column_name = 'watch_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_watch_connections_watch_id ON watch_connections(watch_id);
  END IF;
  
  -- focus_sample 테이블이 존재하고 sample_timestamp 컬럼이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'focus_sample' 
    AND column_name = 'sample_timestamp'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_focus_sample_timestamp ON focus_sample(sample_timestamp);
  END IF;
  
  -- focus_sample 테이블이 존재하고 device_type 컬럼이 있는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'focus_sample' 
    AND column_name = 'device_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_focus_sample_session_device ON focus_sample(session_id, device_type);
  END IF;
END $$;

-- 기본 인덱스들 (안전하게 생성)
CREATE INDEX IF NOT EXISTS idx_watch_codes_user_id ON watch_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_codes_code ON watch_codes(code);
CREATE INDEX IF NOT EXISTS idx_watch_codes_expires_at ON watch_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_watch_connections_user_id ON watch_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_aggregates_session ON focus_aggregates(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_aggregates_timestamp ON focus_aggregates(aggregate_start, aggregate_end);

-- 만료된 코드 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM watch_codes 
  WHERE expires_at < NOW() AND is_used = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 자동 정리 스케줄 (매일 자정) - 조건부 실행
DO $$
BEGIN
  -- pg_cron 확장이 설치되어 있는지 확인
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-expired-codes',
      '0 0 * * *',
      'SELECT cleanup_expired_codes();'
    );
  END IF;
END $$;

-- =====================================================
-- 12. 인덱스 생성
-- =====================================================

-- 성능 최적화를 위한 인덱스들
CREATE INDEX IF NOT EXISTS idx_focus_session_user_started ON focus_session(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_focus_sample_session_ts ON focus_sample(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_focus_event_session_ts ON focus_event(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_focus_event_type ON focus_event(event_type);
CREATE INDEX IF NOT EXISTS idx_snapshot_session_ts ON snapshot(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_note_session_ts ON note(session_id, ts_ref);
CREATE INDEX IF NOT EXISTS idx_daily_summary_user_date ON daily_summary(user_id, date);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_user_year_week ON weekly_summary(user_id, iso_year, iso_week);
CREATE INDEX IF NOT EXISTS idx_reward_claim_user_date ON reward_claim(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_records_habit_date ON habit_records(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_ml_features_focus_status ON ml_features(focus_status);
CREATE INDEX IF NOT EXISTS idx_ml_features_focus_score ON ml_features(focus_score);

-- =====================================================
-- 완료 메시지
-- =====================================================

-- 스키마 생성 완료
SELECT 'Focus Habit Database Schema created successfully!' as status; 