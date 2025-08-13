-- 소셜 기능을 위한 데이터베이스 스키마
-- 기존 스키마에 추가되는 테이블들

-- =====================================================
-- 1. 실시간 스터디룸 관련 테이블
-- =====================================================

-- 스터디룸 테이블
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

-- 룸 참가자 테이블
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

-- =====================================================
-- 2. 집중도 대결 관련 테이블
-- =====================================================

-- 집중도 대결 테이블
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

-- 대결 참가자 테이블
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

-- 대결 결과 테이블
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

-- =====================================================
-- 3. 친구 시스템 관련 테이블
-- =====================================================

-- 친구 관계 테이블
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

-- 친구 요청 테이블
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

-- =====================================================
-- 4. 그룹 챌린지 관련 테이블
-- =====================================================

-- 그룹 챌린지 테이블
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

-- 챌린지 참가자 테이블
CREATE TABLE challenge_participants (
  participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES group_challenges(challenge_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_progress DECIMAL(10,2) NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(challenge_id, user_id)
);

-- =====================================================
-- 5. 격려 메시지 관련 테이블
-- =====================================================

-- 격려 메시지 테이블
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

-- =====================================================
-- 6. 업적/배지 시스템 테이블
-- =====================================================

-- 사용자 업적 테이블
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

-- =====================================================
-- 7. 소셜 통계 테이블
-- =====================================================

-- 소셜 통계 테이블
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

-- =====================================================
-- 8. 인덱스 생성
-- =====================================================

-- 스터디룸 인덱스
CREATE INDEX idx_study_rooms_host_id ON study_rooms(host_id);
CREATE INDEX idx_study_rooms_is_active ON study_rooms(is_active);
CREATE INDEX idx_study_rooms_session_type ON study_rooms(session_type);

-- 룸 참가자 인덱스
CREATE INDEX idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX idx_room_participants_is_connected ON room_participants(is_connected);

-- 대결 인덱스
CREATE INDEX idx_focus_competitions_room_id ON focus_competitions(room_id);
CREATE INDEX idx_focus_competitions_is_active ON focus_competitions(is_active);
CREATE INDEX idx_competition_participants_competition_id ON competition_participants(competition_id);
CREATE INDEX idx_competition_participants_user_id ON competition_participants(user_id);

-- 친구 시스템 인덱스
CREATE INDEX idx_user_friends_user_id ON user_friends(user_id);
CREATE INDEX idx_user_friends_friend_id ON user_friends(friend_id);
CREATE INDEX idx_user_friends_status ON user_friends(status);
CREATE INDEX idx_friend_requests_from_user_id ON friend_requests(from_user_id);
CREATE INDEX idx_friend_requests_to_user_id ON friend_requests(to_user_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

-- 챌린지 인덱스
CREATE INDEX idx_group_challenges_is_active ON group_challenges(is_active);
CREATE INDEX idx_group_challenges_created_by ON group_challenges(created_by);
CREATE INDEX idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user_id ON challenge_participants(user_id);

-- 격려 메시지 인덱스
CREATE INDEX idx_encouragement_messages_to_user_id ON encouragement_messages(to_user_id);
CREATE INDEX idx_encouragement_messages_room_id ON encouragement_messages(room_id);
CREATE INDEX idx_encouragement_messages_is_read ON encouragement_messages(is_read);

-- 업적 인덱스
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_type ON user_achievements(achievement_type);

-- =====================================================
-- 9. RLS (Row Level Security) 정책
-- =====================================================

-- 스터디룸 RLS
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view active study rooms" ON study_rooms
  FOR SELECT USING (is_active = true);
CREATE POLICY "Users can create study rooms" ON study_rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host can update their study rooms" ON study_rooms
  FOR UPDATE USING (auth.uid() = host_id);

-- 룸 참가자 RLS
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view room participants" ON room_participants
  FOR SELECT USING (true);
CREATE POLICY "Users can join rooms" ON room_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON room_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- 친구 시스템 RLS
ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own friendships" ON user_friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can create friend relationships" ON user_friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own friendships" ON user_friends
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 격려 메시지 RLS
ALTER TABLE encouragement_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages sent to them" ON encouragement_messages
  FOR SELECT USING (auth.uid() = to_user_id);
CREATE POLICY "Users can send encouragement messages" ON encouragement_messages
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can mark their messages as read" ON encouragement_messages
  FOR UPDATE USING (auth.uid() = to_user_id);

-- =====================================================
-- 10. 함수 및 트리거
-- =====================================================

-- 룸 참가자 수 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE study_rooms 
    SET current_participants = current_participants + 1,
        updated_at = NOW()
    WHERE room_id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE study_rooms 
    SET current_participants = current_participants - 1,
        updated_at = NOW()
    WHERE room_id = OLD.room_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 룸 참가자 수 업데이트 트리거
CREATE TRIGGER trigger_update_room_participant_count
  AFTER INSERT OR DELETE ON room_participants
  FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();

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
CREATE TRIGGER trigger_create_social_stats
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_social_stats_for_user();
