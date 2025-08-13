-- 소셜 기능 스키마 자동 적용 스크립트
-- 기존에 없는 테이블, 인덱스, 함수, 트리거만 생성합니다.

-- =====================================================
-- 1. 테이블 존재 여부 확인 및 생성
-- =====================================================

-- 스터디룸 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'study_rooms') THEN
        CREATE TABLE study_rooms (
          room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          max_participants INTEGER NOT NULL DEFAULT 10 CHECK (max_participants BETWEEN 2 AND 50),
          current_participants INTEGER NOT NULL DEFAULT 1 CHECK (current_participants >= 0),
          is_active BOOLEAN NOT NULL DEFAULT true,
          session_type VARCHAR(20) NOT NULL DEFAULT 'study' CHECK (session_type IN ('study', 'work', 'reading', 'other')),
          goal_minutes INTEGER CHECK (goal_minutes > 0),
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'study_rooms 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'study_rooms 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 룸 참가자 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'room_participants') THEN
        CREATE TABLE room_participants (
          participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID NOT NULL REFERENCES study_rooms(room_id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          left_at TIMESTAMPTZ,
          current_focus_score DECIMAL(5,2) CHECK (current_focus_score >= 0 AND current_focus_score <= 100),
          is_host BOOLEAN NOT NULL DEFAULT false,
          is_connected BOOLEAN NOT NULL DEFAULT true,
          last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(room_id, user_id)
        );
        RAISE NOTICE 'room_participants 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'room_participants 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 집중도 대결 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'focus_competitions') THEN
        CREATE TABLE focus_competitions (
          competition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID NOT NULL REFERENCES study_rooms(room_id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at TIMESTAMPTZ,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'focus_competitions 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'focus_competitions 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 대결 참가자 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'competition_participants') THEN
        CREATE TABLE competition_participants (
          participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          competition_id UUID NOT NULL REFERENCES focus_competitions(competition_id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          total_focus_score DECIMAL(8,2) NOT NULL DEFAULT 0,
          average_focus_score DECIMAL(5,2) NOT NULL DEFAULT 0,
          focus_time_minutes INTEGER NOT NULL DEFAULT 0,
          rank INTEGER,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(competition_id, user_id)
        );
        RAISE NOTICE 'competition_participants 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'competition_participants 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 대결 결과 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'competition_results') THEN
        CREATE TABLE competition_results (
          result_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          competition_id UUID NOT NULL REFERENCES focus_competitions(competition_id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          rank INTEGER NOT NULL,
          total_score DECIMAL(8,2) NOT NULL,
          average_score DECIMAL(5,2) NOT NULL,
          focus_time INTEGER NOT NULL,
          reward_coins INTEGER DEFAULT 0,
          reward_badges TEXT[],
          completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(competition_id, user_id)
        );
        RAISE NOTICE 'competition_results 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'competition_results 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 친구 관계 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_friends') THEN
        CREATE TABLE user_friends (
          friendship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, friend_id),
          CHECK (user_id != friend_id)
        );
        RAISE NOTICE 'user_friends 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'user_friends 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 친구 요청 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friend_requests') THEN
        CREATE TABLE friend_requests (
          request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          message TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(from_user_id, to_user_id),
          CHECK (from_user_id != to_user_id)
        );
        RAISE NOTICE 'friend_requests 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'friend_requests 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 그룹 챌린지 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_challenges') THEN
        CREATE TABLE group_challenges (
          challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          description TEXT,
          goal_type VARCHAR(30) NOT NULL CHECK (goal_type IN ('total_hours', 'total_sessions', 'average_focus_score')),
          goal_value DECIMAL(10,2) NOT NULL CHECK (goal_value > 0),
          duration_days INTEGER NOT NULL CHECK (duration_days > 0),
          reward_coins INTEGER NOT NULL DEFAULT 0,
          reward_badges TEXT[],
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ends_at TIMESTAMPTZ NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'group_challenges 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'group_challenges 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 챌린지 참가자 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_participants') THEN
        CREATE TABLE challenge_participants (
          participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          challenge_id UUID NOT NULL REFERENCES group_challenges(challenge_id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          current_progress DECIMAL(10,2) NOT NULL DEFAULT 0,
          joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          completed_at TIMESTAMPTZ,
          UNIQUE(challenge_id, user_id)
        );
        RAISE NOTICE 'challenge_participants 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'challenge_participants 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 격려 메시지 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'encouragement_messages') THEN
        CREATE TABLE encouragement_messages (
          message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          room_id UUID REFERENCES study_rooms(room_id) ON DELETE CASCADE,
          message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'emoji', 'sticker', 'ai_generated')),
          content TEXT NOT NULL,
          is_read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (from_user_id != to_user_id)
        );
        RAISE NOTICE 'encouragement_messages 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'encouragement_messages 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 사용자 업적 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_achievements') THEN
        CREATE TABLE user_achievements (
          achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          achievement_type VARCHAR(50) NOT NULL,
          title VARCHAR(100) NOT NULL,
          description TEXT,
          icon_url TEXT,
          earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          progress DECIMAL(5,2) CHECK (progress >= 0 AND progress <= 100),
          max_progress DECIMAL(5,2) CHECK (max_progress > 0)
        );
        RAISE NOTICE 'user_achievements 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'user_achievements 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 소셜 통계 테이블
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'social_stats') THEN
        CREATE TABLE social_stats (
          user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          total_friends INTEGER NOT NULL DEFAULT 0,
          total_rooms_joined INTEGER NOT NULL DEFAULT 0,
          total_competitions_won INTEGER NOT NULL DEFAULT 0,
          total_challenges_completed INTEGER NOT NULL DEFAULT 0,
          total_encouragements_sent INTEGER NOT NULL DEFAULT 0,
          total_encouragements_received INTEGER NOT NULL DEFAULT 0,
          current_streak INTEGER NOT NULL DEFAULT 0,
          longest_streak INTEGER NOT NULL DEFAULT 0,
          total_coins INTEGER NOT NULL DEFAULT 0,
          total_badges INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        RAISE NOTICE 'social_stats 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'social_stats 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- =====================================================
-- 2. 인덱스 존재 여부 확인 및 생성
-- =====================================================

-- 스터디룸 인덱스
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_study_rooms_host_id') THEN
        CREATE INDEX idx_study_rooms_host_id ON study_rooms(host_id);
        RAISE NOTICE 'idx_study_rooms_host_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_study_rooms_host_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_study_rooms_is_active') THEN
        CREATE INDEX idx_study_rooms_is_active ON study_rooms(is_active);
        RAISE NOTICE 'idx_study_rooms_is_active 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_study_rooms_is_active 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_study_rooms_session_type') THEN
        CREATE INDEX idx_study_rooms_session_type ON study_rooms(session_type);
        RAISE NOTICE 'idx_study_rooms_session_type 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_study_rooms_session_type 인덱스가 이미 존재합니다.';
    END IF;
END $$;

-- 룸 참가자 인덱스
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_room_participants_room_id') THEN
        CREATE INDEX idx_room_participants_room_id ON room_participants(room_id);
        RAISE NOTICE 'idx_room_participants_room_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_room_participants_room_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_room_participants_user_id') THEN
        CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
        RAISE NOTICE 'idx_room_participants_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_room_participants_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_room_participants_is_connected') THEN
        CREATE INDEX idx_room_participants_is_connected ON room_participants(is_connected);
        RAISE NOTICE 'idx_room_participants_is_connected 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_room_participants_is_connected 인덱스가 이미 존재합니다.';
    END IF;
END $$;

-- 대결 인덱스
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_focus_competitions_room_id') THEN
        CREATE INDEX idx_focus_competitions_room_id ON focus_competitions(room_id);
        RAISE NOTICE 'idx_focus_competitions_room_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_focus_competitions_room_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_focus_competitions_is_active') THEN
        CREATE INDEX idx_focus_competitions_is_active ON focus_competitions(is_active);
        RAISE NOTICE 'idx_focus_competitions_is_active 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_focus_competitions_is_active 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_competition_participants_competition_id') THEN
        CREATE INDEX idx_competition_participants_competition_id ON competition_participants(competition_id);
        RAISE NOTICE 'idx_competition_participants_competition_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_competition_participants_competition_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_competition_participants_user_id') THEN
        CREATE INDEX idx_competition_participants_user_id ON competition_participants(user_id);
        RAISE NOTICE 'idx_competition_participants_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_competition_participants_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

-- 친구 시스템 인덱스
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_user_friends_user_id') THEN
        CREATE INDEX idx_user_friends_user_id ON user_friends(user_id);
        RAISE NOTICE 'idx_user_friends_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_user_friends_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_user_friends_friend_id') THEN
        CREATE INDEX idx_user_friends_friend_id ON user_friends(friend_id);
        RAISE NOTICE 'idx_user_friends_friend_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_user_friends_friend_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_user_friends_status') THEN
        CREATE INDEX idx_user_friends_status ON user_friends(status);
        RAISE NOTICE 'idx_user_friends_status 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_user_friends_status 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_friend_requests_from_user_id') THEN
        CREATE INDEX idx_friend_requests_from_user_id ON friend_requests(from_user_id);
        RAISE NOTICE 'idx_friend_requests_from_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_friend_requests_from_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_friend_requests_to_user_id') THEN
        CREATE INDEX idx_friend_requests_to_user_id ON friend_requests(to_user_id);
        RAISE NOTICE 'idx_friend_requests_to_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_friend_requests_to_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_friend_requests_status') THEN
        CREATE INDEX idx_friend_requests_status ON friend_requests(status);
        RAISE NOTICE 'idx_friend_requests_status 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_friend_requests_status 인덱스가 이미 존재합니다.';
    END IF;
END $$;

-- 챌린지 인덱스
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_group_challenges_is_active') THEN
        CREATE INDEX idx_group_challenges_is_active ON group_challenges(is_active);
        RAISE NOTICE 'idx_group_challenges_is_active 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_group_challenges_is_active 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_group_challenges_created_by') THEN
        CREATE INDEX idx_group_challenges_created_by ON group_challenges(created_by);
        RAISE NOTICE 'idx_group_challenges_created_by 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_group_challenges_created_by 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_challenge_participants_challenge_id') THEN
        CREATE INDEX idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
        RAISE NOTICE 'idx_challenge_participants_challenge_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_challenge_participants_challenge_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_challenge_participants_user_id') THEN
        CREATE INDEX idx_challenge_participants_user_id ON challenge_participants(user_id);
        RAISE NOTICE 'idx_challenge_participants_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_challenge_participants_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

-- 격려 메시지 인덱스
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_encouragement_messages_to_user_id') THEN
        CREATE INDEX idx_encouragement_messages_to_user_id ON encouragement_messages(to_user_id);
        RAISE NOTICE 'idx_encouragement_messages_to_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_encouragement_messages_to_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_encouragement_messages_room_id') THEN
        CREATE INDEX idx_encouragement_messages_room_id ON encouragement_messages(room_id);
        RAISE NOTICE 'idx_encouragement_messages_room_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_encouragement_messages_room_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_encouragement_messages_is_read') THEN
        CREATE INDEX idx_encouragement_messages_is_read ON encouragement_messages(is_read);
        RAISE NOTICE 'idx_encouragement_messages_is_read 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_encouragement_messages_is_read 인덱스가 이미 존재합니다.';
    END IF;
END $$;

-- 업적 인덱스
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_user_achievements_user_id') THEN
        CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
        RAISE NOTICE 'idx_user_achievements_user_id 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_user_achievements_user_id 인덱스가 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_user_achievements_type') THEN
        CREATE INDEX idx_user_achievements_type ON user_achievements(achievement_type);
        RAISE NOTICE 'idx_user_achievements_type 인덱스가 생성되었습니다.';
    ELSE
        RAISE NOTICE 'idx_user_achievements_type 인덱스가 이미 존재합니다.';
    END IF;
END $$;

-- =====================================================
-- 3. RLS (Row Level Security) 정책
-- =====================================================

-- 스터디룸 RLS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'study_rooms' AND policyname = 'Users can view active study rooms') THEN
        ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view active study rooms" ON study_rooms
          FOR SELECT USING (is_active = true);
        RAISE NOTICE 'study_rooms RLS 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'study_rooms RLS 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'study_rooms' AND policyname = 'Users can create study rooms') THEN
        CREATE POLICY "Users can create study rooms" ON study_rooms
          FOR INSERT WITH CHECK (auth.uid() = host_id);
        RAISE NOTICE 'study_rooms 생성 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'study_rooms 생성 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'study_rooms' AND policyname = 'Host can update their study rooms') THEN
        CREATE POLICY "Host can update their study rooms" ON study_rooms
          FOR UPDATE USING (auth.uid() = host_id);
        RAISE NOTICE 'study_rooms 업데이트 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'study_rooms 업데이트 정책이 이미 존재합니다.';
    END IF;
END $$;

-- 룸 참가자 RLS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'room_participants' AND policyname = 'Users can view room participants') THEN
        ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view room participants" ON room_participants
          FOR SELECT USING (true);
        RAISE NOTICE 'room_participants RLS 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'room_participants RLS 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'room_participants' AND policyname = 'Users can join rooms') THEN
        CREATE POLICY "Users can join rooms" ON room_participants
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'room_participants 참가 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'room_participants 참가 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'room_participants' AND policyname = 'Users can update their own participation') THEN
        CREATE POLICY "Users can update their own participation" ON room_participants
          FOR UPDATE USING (auth.uid() = user_id);
        RAISE NOTICE 'room_participants 업데이트 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'room_participants 업데이트 정책이 이미 존재합니다.';
    END IF;
END $$;

-- 친구 시스템 RLS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_friends' AND policyname = 'Users can view their own friendships') THEN
        ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view their own friendships" ON user_friends
          FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
        RAISE NOTICE 'user_friends RLS 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'user_friends RLS 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_friends' AND policyname = 'Users can create friend relationships') THEN
        CREATE POLICY "Users can create friend relationships" ON user_friends
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        RAISE NOTICE 'user_friends 생성 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'user_friends 생성 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'user_friends' AND policyname = 'Users can update their own friendships') THEN
        CREATE POLICY "Users can update their own friendships" ON user_friends
          FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
        RAISE NOTICE 'user_friends 업데이트 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'user_friends 업데이트 정책이 이미 존재합니다.';
    END IF;
END $$;

-- 격려 메시지 RLS
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'encouragement_messages' AND policyname = 'Users can view messages sent to them') THEN
        ALTER TABLE encouragement_messages ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view messages sent to them" ON encouragement_messages
          FOR SELECT USING (auth.uid() = to_user_id);
        RAISE NOTICE 'encouragement_messages RLS 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'encouragement_messages RLS 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'encouragement_messages' AND policyname = 'Users can send encouragement messages') THEN
        CREATE POLICY "Users can send encouragement messages" ON encouragement_messages
          FOR INSERT WITH CHECK (auth.uid() = from_user_id);
        RAISE NOTICE 'encouragement_messages 생성 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'encouragement_messages 생성 정책이 이미 존재합니다.';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'encouragement_messages' AND policyname = 'Users can mark their messages as read') THEN
        CREATE POLICY "Users can mark their messages as read" ON encouragement_messages
          FOR UPDATE USING (auth.uid() = to_user_id);
        RAISE NOTICE 'encouragement_messages 업데이트 정책이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'encouragement_messages 업데이트 정책이 이미 존재합니다.';
    END IF;
END $$;

-- =====================================================
-- 4. 함수 및 트리거
-- =====================================================

-- 룸 참가자 수 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 새 참가자 추가
    UPDATE study_rooms 
    SET current_participants = current_participants + 1,
        updated_at = NOW()
    WHERE room_id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- 참가자 삭제
    UPDATE study_rooms 
    SET current_participants = current_participants - 1,
        updated_at = NOW()
    WHERE room_id = OLD.room_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- 참가자 상태 변경 (재참가 또는 퇴장)
    IF OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
      -- 퇴장
      UPDATE study_rooms 
      SET current_participants = current_participants - 1,
          updated_at = NOW()
      WHERE room_id = NEW.room_id;
    ELSIF OLD.left_at IS NOT NULL AND NEW.left_at IS NULL THEN
      -- 재참가
      UPDATE study_rooms 
      SET current_participants = current_participants + 1,
          updated_at = NOW()
      WHERE room_id = NEW.room_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 룸 참가자 수 업데이트 트리거
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trigger_update_room_participant_count') THEN
        CREATE TRIGGER trigger_update_room_participant_count
          AFTER INSERT OR DELETE OR UPDATE ON room_participants
          FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();
        RAISE NOTICE '룸 참가자 수 업데이트 트리거가 생성되었습니다.';
    ELSE
        RAISE NOTICE '룸 참가자 수 업데이트 트리거가 이미 존재합니다.';
    END IF;
END $$;

-- 소셜 통계 자동 생성 함수
CREATE OR REPLACE FUNCTION create_social_stats_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO social_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 새 사용자 생성 시 소셜 통계 생성 트리거
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_trigger WHERE tgname = 'trigger_create_social_stats') THEN
        CREATE TRIGGER trigger_create_social_stats
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION create_social_stats_for_user();
        RAISE NOTICE '소셜 통계 생성 트리거가 생성되었습니다.';
    ELSE
        RAISE NOTICE '소셜 통계 생성 트리거가 이미 존재합니다.';
    END IF;
END $$;

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '=== 소셜 기능 스키마 적용 완료 ===';
    RAISE NOTICE '기존에 없는 테이블, 인덱스, 정책, 트리거만 생성되었습니다.';
    RAISE NOTICE '이미 존재하는 스키마는 건너뛰었습니다.';
END $$;
