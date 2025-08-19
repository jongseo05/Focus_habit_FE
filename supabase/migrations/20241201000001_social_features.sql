-- =====================================================
-- Focus Habit 소셜 기능 스키마
-- =====================================================

-- =====================================================
-- 1. 스터디룸 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.study_rooms (
    room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    max_participants INTEGER DEFAULT 4 CHECK (max_participants > 0 AND max_participants <= 20),
    current_participants INTEGER DEFAULT 0,
    session_type TEXT DEFAULT 'study' CHECK (session_type IN ('study', 'work', 'reading', 'other')),
    goal_minutes INTEGER DEFAULT 25,
    is_active BOOLEAN DEFAULT true,
    is_private BOOLEAN DEFAULT false,
    password_hash TEXT, -- 비공개 방의 경우 패스워드 해시
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER update_study_rooms_updated_at 
    BEFORE UPDATE ON public.study_rooms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. 스터디룸 참가자 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.room_participants (
    room_id UUID NOT NULL REFERENCES public.study_rooms(room_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    is_host BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    focus_score REAL CHECK (focus_score >= 0 AND focus_score <= 100),
    session_id UUID REFERENCES public.focus_session(session_id) ON DELETE SET NULL,
    PRIMARY KEY (room_id, user_id)
);

-- =====================================================
-- 3. 친구 관계 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_friends (
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- =====================================================
-- 4. 친구 요청 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.friend_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    requested_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, requested_id),
    CHECK (requester_id != requested_id)
);

CREATE TRIGGER update_friend_requests_updated_at 
    BEFORE UPDATE ON public.friend_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. 그룹 챌린지 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.group_challenges (
    challenge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES public.study_rooms(room_id) ON DELETE SET NULL,
    host_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('focus_time', 'study_sessions', 'streak_days', 'focus_score', 'custom')),
    target_value REAL NOT NULL CHECK (target_value > 0),
    unit TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 10 CHECK (max_participants > 0),
    current_participants INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (end_date > start_date)
);

CREATE TRIGGER update_group_challenges_updated_at 
    BEFORE UPDATE ON public.group_challenges 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. 챌린지 참가자 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.challenge_participants (
    challenge_id UUID NOT NULL REFERENCES public.group_challenges(challenge_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    current_progress REAL DEFAULT 0 CHECK (current_progress >= 0),
    is_completed BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (challenge_id, user_id)
);

-- =====================================================
-- 7. 개인 챌린지 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.personal_challenges (
    challenge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('focus_time', 'study_sessions', 'streak_days', 'focus_score', 'custom')),
    target_value REAL NOT NULL CHECK (target_value > 0),
    current_progress REAL DEFAULT 0 CHECK (current_progress >= 0),
    unit TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (end_date > start_date)
);

CREATE TRIGGER update_personal_challenges_updated_at 
    BEFORE UPDATE ON public.personal_challenges 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. 챌린지 초대 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.challenge_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES public.group_challenges(challenge_id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    invited_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    UNIQUE(challenge_id, invited_id),
    CHECK (inviter_id != invited_id)
);

CREATE TRIGGER update_challenge_invitations_updated_at 
    BEFORE UPDATE ON public.challenge_invitations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. 격려 메시지 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.encouragement_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.study_rooms(room_id) ON DELETE SET NULL,
    challenge_id UUID REFERENCES public.group_challenges(challenge_id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'encouragement' CHECK (message_type IN ('encouragement', 'celebration', 'reminder', 'support')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (sender_id != receiver_id)
);

-- =====================================================
-- 10. 사용자 성취 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_achievements (
    achievement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL CHECK (achievement_type IN ('streak', 'focus_master', 'social_butterfly', 'challenger', 'mentor', 'consistency', 'milestone')),
    title TEXT NOT NULL,
    description TEXT,
    badge_url TEXT,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB, -- 성취와 관련된 추가 데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. 집중 경쟁 테이블 (실시간 스터디룸 내 경쟁)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.focus_competitions (
    competition_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.study_rooms(room_id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    competition_type TEXT DEFAULT 'focus_score' CHECK (competition_type IN ('focus_score', 'consistency', 'endurance')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    winner_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 12. 경쟁 참가자 테이블
-- =====================================================

CREATE TABLE IF NOT EXISTS public.competition_participants (
    competition_id UUID NOT NULL REFERENCES public.focus_competitions(competition_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.focus_session(session_id) ON DELETE SET NULL,
    final_score REAL CHECK (final_score >= 0 AND final_score <= 100),
    rank INTEGER,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (competition_id, user_id)
);

-- =====================================================
-- 인덱스 생성
-- =====================================================

-- 스터디룸 인덱스
CREATE INDEX IF NOT EXISTS idx_study_rooms_host_id ON public.study_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_study_rooms_active ON public.study_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_rooms_created_at ON public.study_rooms(created_at DESC);

-- 참가자 인덱스
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_joined_at ON public.room_participants(joined_at);

-- 친구 관계 인덱스
CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON public.user_friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requested_id ON public.friend_requests(requested_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

-- 챌린지 인덱스
CREATE INDEX IF NOT EXISTS idx_group_challenges_host_id ON public.group_challenges(host_id);
CREATE INDEX IF NOT EXISTS idx_group_challenges_active ON public.group_challenges(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_group_challenges_end_date ON public.group_challenges(end_date);
CREATE INDEX IF NOT EXISTS idx_personal_challenges_user_id ON public.personal_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id ON public.challenge_participants(user_id);

-- 초대 및 메시지 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_invited_id ON public.challenge_invitations(invited_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitations_status ON public.challenge_invitations(status);
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_receiver_id ON public.encouragement_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_unread ON public.encouragement_messages(receiver_id, is_read) WHERE is_read = false;

-- 성취 인덱스
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_type ON public.user_achievements(achievement_type);

-- 경쟁 인덱스
CREATE INDEX IF NOT EXISTS idx_focus_competitions_room_id ON public.focus_competitions(room_id);
CREATE INDEX IF NOT EXISTS idx_focus_competitions_active ON public.focus_competitions(is_active) WHERE is_active = true;

-- =====================================================
-- RLS (Row Level Security) 설정
-- =====================================================

-- 스터디룸 RLS
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "모든 사용자는 활성 스터디룸 조회 가능" ON public.study_rooms FOR SELECT USING (is_active = true);
CREATE POLICY "호스트는 자신의 스터디룸 관리 가능" ON public.study_rooms FOR ALL USING (auth.uid() = host_id);

-- 스터디룸 참가자 RLS
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "참가자는 자신이 속한 방의 참가자 목록 조회 가능" ON public.room_participants FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.room_id = room_participants.room_id AND rp.user_id = auth.uid()));
CREATE POLICY "사용자는 자신의 참가 기록 관리 가능" ON public.room_participants FOR ALL USING (auth.uid() = user_id);

-- 친구 관계 RLS
ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 친구 관계만 접근 가능" ON public.user_friends FOR ALL 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 친구 요청 RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신과 관련된 친구 요청만 접근 가능" ON public.friend_requests FOR ALL 
USING (auth.uid() = requester_id OR auth.uid() = requested_id);

-- 그룹 챌린지 RLS
ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "모든 사용자는 활성 챌린지 조회 가능" ON public.group_challenges FOR SELECT USING (is_active = true);
CREATE POLICY "호스트는 자신의 챌린지 관리 가능" ON public.group_challenges FOR ALL USING (auth.uid() = host_id);

-- 챌린지 참가자 RLS
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신이 참가한 챌린지 정보 접근 가능" ON public.challenge_participants FOR ALL 
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.challenge_participants cp WHERE cp.challenge_id = challenge_participants.challenge_id AND cp.user_id = auth.uid()));

-- 개인 챌린지 RLS
ALTER TABLE public.personal_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신의 개인 챌린지만 접근 가능" ON public.personal_challenges FOR ALL USING (auth.uid() = user_id);

-- 챌린지 초대 RLS
ALTER TABLE public.challenge_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신과 관련된 초대만 접근 가능" ON public.challenge_invitations FOR ALL 
USING (auth.uid() = inviter_id OR auth.uid() = invited_id);

-- 격려 메시지 RLS
ALTER TABLE public.encouragement_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신과 관련된 메시지만 접근 가능" ON public.encouragement_messages FOR ALL 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 사용자 성취 RLS
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "모든 사용자는 성취 조회 가능" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "사용자는 자신의 성취만 관리 가능" ON public.user_achievements FOR INSERT USING (auth.uid() = user_id);
CREATE POLICY "사용자는 자신의 성취만 업데이트 가능" ON public.user_achievements FOR UPDATE USING (auth.uid() = user_id);

-- 집중 경쟁 RLS
ALTER TABLE public.focus_competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "참가자는 자신이 속한 방의 경쟁 조회 가능" ON public.focus_competitions FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.room_id = focus_competitions.room_id AND rp.user_id = auth.uid()));
CREATE POLICY "호스트는 자신의 경쟁 관리 가능" ON public.focus_competitions FOR ALL USING (auth.uid() = host_id);

-- 경쟁 참가자 RLS
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "사용자는 자신이 참가한 경쟁 정보 접근 가능" ON public.competition_participants FOR ALL 
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.competition_participants cp WHERE cp.competition_id = competition_participants.competition_id AND cp.user_id = auth.uid()));

-- =====================================================
-- 유용한 뷰 생성
-- =====================================================

-- 친구 목록 뷰 (상호 친구 관계)
CREATE OR REPLACE VIEW public.mutual_friends AS
SELECT 
    uf1.user_id,
    uf1.friend_id,
    p.display_name as friend_name,
    p.avatar_url as friend_avatar,
    p.status as friend_status,
    uf1.created_at as friendship_date
FROM public.user_friends uf1
JOIN public.user_friends uf2 ON uf1.user_id = uf2.friend_id AND uf1.friend_id = uf2.user_id
JOIN public.profiles p ON uf1.friend_id = p.user_id
WHERE uf1.status = 'active' AND uf2.status = 'active';

-- 활성 스터디룸 상세 뷰
CREATE OR REPLACE VIEW public.active_study_rooms_detail AS
SELECT 
    sr.*,
    p.display_name as host_name,
    p.avatar_url as host_avatar,
    COUNT(rp.user_id) as actual_participants
FROM public.study_rooms sr
JOIN public.profiles p ON sr.host_id = p.user_id
LEFT JOIN public.room_participants rp ON sr.room_id = rp.room_id AND rp.left_at IS NULL
WHERE sr.is_active = true
GROUP BY sr.room_id, p.display_name, p.avatar_url;

-- 챌린지 리더보드 뷰
CREATE OR REPLACE VIEW public.challenge_leaderboard AS
SELECT 
    cp.challenge_id,
    cp.user_id,
    p.display_name,
    p.avatar_url,
    cp.current_progress,
    cp.is_completed,
    RANK() OVER (PARTITION BY cp.challenge_id ORDER BY cp.current_progress DESC) as rank
FROM public.challenge_participants cp
JOIN public.profiles p ON cp.user_id = p.user_id
JOIN public.group_challenges gc ON cp.challenge_id = gc.challenge_id
WHERE gc.is_active = true;

-- =====================================================
-- 트리거 함수들
-- =====================================================

-- 스터디룸 참가자 수 업데이트 트리거
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.study_rooms 
        SET current_participants = current_participants + 1 
        WHERE room_id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
        UPDATE public.study_rooms 
        SET current_participants = current_participants - 1 
        WHERE room_id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.study_rooms 
        SET current_participants = current_participants - 1 
        WHERE room_id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_room_participant_count
    AFTER INSERT OR UPDATE OR DELETE ON public.room_participants
    FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();

-- 챌린지 참가자 수 업데이트 트리거
CREATE OR REPLACE FUNCTION update_challenge_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.group_challenges 
        SET current_participants = current_participants + 1 
        WHERE challenge_id = NEW.challenge_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.group_challenges 
        SET current_participants = current_participants - 1 
        WHERE challenge_id = OLD.challenge_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_challenge_participant_count
    AFTER INSERT OR DELETE ON public.challenge_participants
    FOR EACH ROW EXECUTE FUNCTION update_challenge_participant_count();

-- 만료된 초대 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
    UPDATE public.challenge_invitations 
    SET status = 'expired' 
    WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 완료 메시지
-- =====================================================

SELECT 'Focus Habit 소셜 기능 스키마 설정이 완료되었습니다.' as message;
