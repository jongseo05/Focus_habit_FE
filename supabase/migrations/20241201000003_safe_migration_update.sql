-- =====================================================
-- Focus Habit 안전한 마이그레이션 업데이트
-- 기존 구조를 안전하게 업데이트하고 누락된 부분을 추가
-- =====================================================

-- 확장 기능 안전하게 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. 기존 테이블 구조 검증 및 누락된 컬럼 추가
-- =====================================================

-- profiles 테이블 컬럼 추가 (없으면)
DO $$
BEGIN
    -- status 컬럼이 없으면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'status') THEN
        ALTER TABLE public.profiles 
        ADD COLUMN status TEXT DEFAULT 'offline' 
        CHECK (status IN ('online', 'offline', 'busy', 'away'));
    END IF;
    
    -- school, major 컬럼 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'school') THEN
        ALTER TABLE public.profiles ADD COLUMN school TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'major') THEN
        ALTER TABLE public.profiles ADD COLUMN major TEXT;
    END IF;
END $$;

-- focus_session 테이블 컬럼 추가
DO $$
BEGIN
    -- room_id 컬럼이 없으면 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'focus_session' AND column_name = 'room_id') THEN
        ALTER TABLE public.focus_session ADD COLUMN room_id UUID;
    END IF;
    
    -- session_type 컬럼 체크 제약조건 업데이트
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'focus_session' AND column_name = 'session_type') THEN
        -- 기존 제약조건 제거 후 새로 추가
        ALTER TABLE public.focus_session DROP CONSTRAINT IF EXISTS focus_session_session_type_check;
        ALTER TABLE public.focus_session 
        ADD CONSTRAINT focus_session_session_type_check 
        CHECK (session_type IN ('study', 'work', 'reading', 'other', 'study_room'));
    END IF;
END $$;

-- =====================================================
-- 2. 소셜 기능 테이블들 안전하게 생성
-- =====================================================

-- 스터디룸 테이블
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
    password_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- 스터디룸 참가자 테이블
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

-- 친구 관계 테이블
CREATE TABLE IF NOT EXISTS public.user_friends (
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- 친구 요청 테이블
CREATE TABLE IF NOT EXISTS public.friend_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    requested_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (requester_id != requested_id)
);

-- 그룹 챌린지 테이블
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

-- 챌린지 참가자 테이블
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    challenge_id UUID NOT NULL REFERENCES public.group_challenges(challenge_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    current_progress REAL DEFAULT 0 CHECK (current_progress >= 0),
    is_completed BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (challenge_id, user_id)
);

-- 개인 챌린지 테이블
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

-- 챌린지 초대 테이블
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
    CHECK (inviter_id != invited_id)
);

-- 격려 메시지 테이블
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

-- 사용자 성취 테이블
CREATE TABLE IF NOT EXISTS public.user_achievements (
    achievement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    achievement_type TEXT NOT NULL CHECK (achievement_type IN ('streak', 'focus_master', 'social_butterfly', 'challenger', 'mentor', 'consistency', 'milestone')),
    title TEXT NOT NULL,
    description TEXT,
    badge_url TEXT,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 집중 경쟁 테이블
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

-- 경쟁 참가자 테이블
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
-- 3. 제약조건 및 고유키 안전하게 추가
-- =====================================================

-- 고유 제약조건들 추가 (없으면)
DO $$
BEGIN
    -- friend_requests 고유 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'friend_requests' 
                   AND constraint_name = 'friend_requests_requester_id_requested_id_key') THEN
        ALTER TABLE public.friend_requests 
        ADD CONSTRAINT friend_requests_requester_id_requested_id_key 
        UNIQUE (requester_id, requested_id);
    END IF;
    
    -- challenge_invitations 고유 제약조건
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'challenge_invitations' 
                   AND constraint_name = 'challenge_invitations_challenge_id_invited_id_key') THEN
        ALTER TABLE public.challenge_invitations 
        ADD CONSTRAINT challenge_invitations_challenge_id_invited_id_key 
        UNIQUE (challenge_id, invited_id);
    END IF;
END $$;

-- =====================================================
-- 4. 인덱스 안전하게 생성
-- =====================================================

-- 기본 인덱스들
CREATE INDEX IF NOT EXISTS idx_study_rooms_host_id ON public.study_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_study_rooms_active ON public.study_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_rooms_created_at ON public.study_rooms(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_joined_at ON public.room_participants(joined_at);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_active ON public.room_participants(room_id, left_at) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON public.user_friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requested_id ON public.friend_requests(requested_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

CREATE INDEX IF NOT EXISTS idx_group_challenges_host_id ON public.group_challenges(host_id);
CREATE INDEX IF NOT EXISTS idx_group_challenges_active ON public.group_challenges(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_personal_challenges_user_id ON public.personal_challenges(user_id);

CREATE INDEX IF NOT EXISTS idx_encouragement_messages_receiver_id ON public.encouragement_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_unread ON public.encouragement_messages(receiver_id, is_read) WHERE is_read = false;

-- =====================================================
-- 5. 트리거 함수 안전하게 생성
-- =====================================================

-- updated_at 자동 업데이트 함수 (이미 존재할 수 있음)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거들 안전하게 생성
DROP TRIGGER IF EXISTS update_study_rooms_updated_at ON public.study_rooms;
CREATE TRIGGER update_study_rooms_updated_at 
    BEFORE UPDATE ON public.study_rooms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER update_friend_requests_updated_at 
    BEFORE UPDATE ON public.friend_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_group_challenges_updated_at ON public.group_challenges;
CREATE TRIGGER update_group_challenges_updated_at 
    BEFORE UPDATE ON public.group_challenges 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_personal_challenges_updated_at ON public.personal_challenges;
CREATE TRIGGER update_personal_challenges_updated_at 
    BEFORE UPDATE ON public.personal_challenges 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_challenge_invitations_updated_at ON public.challenge_invitations;
CREATE TRIGGER update_challenge_invitations_updated_at 
    BEFORE UPDATE ON public.challenge_invitations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 참가자 수 업데이트 함수
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

DROP TRIGGER IF EXISTS trigger_update_room_participant_count ON public.room_participants;
CREATE TRIGGER trigger_update_room_participant_count
    AFTER INSERT OR UPDATE OR DELETE ON public.room_participants
    FOR EACH ROW EXECUTE FUNCTION update_room_participant_count();

-- 챌린지 참가자 수 업데이트 함수
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

DROP TRIGGER IF EXISTS trigger_update_challenge_participant_count ON public.challenge_participants;
CREATE TRIGGER trigger_update_challenge_participant_count
    AFTER INSERT OR DELETE ON public.challenge_participants
    FOR EACH ROW EXECUTE FUNCTION update_challenge_participant_count();

-- =====================================================
-- 6. RLS 정책 안전하게 생성
-- =====================================================

-- 스터디룸 RLS
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "모든 사용자는 활성 스터디룸 조회 가능" ON public.study_rooms;
CREATE POLICY "모든 사용자는 활성 스터디룸 조회 가능" ON public.study_rooms FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "호스트는 자신의 스터디룸 관리 가능" ON public.study_rooms;
CREATE POLICY "호스트는 자신의 스터디룸 관리 가능" ON public.study_rooms FOR ALL USING (auth.uid() = host_id);

-- 스터디룸 참가자 RLS
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "참가자는 자신이 속한 방의 참가자 목록 조회 가능" ON public.room_participants;
CREATE POLICY "참가자는 자신이 속한 방의 참가자 목록 조회 가능" ON public.room_participants FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.room_id = room_participants.room_id AND rp.user_id = auth.uid()));

DROP POLICY IF EXISTS "사용자는 자신의 참가 기록 관리 가능" ON public.room_participants;
CREATE POLICY "사용자는 자신의 참가 기록 관리 가능" ON public.room_participants FOR ALL USING (auth.uid() = user_id);

-- 친구 관계 RLS
ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "사용자는 자신의 친구 관계만 접근 가능" ON public.user_friends;
CREATE POLICY "사용자는 자신의 친구 관계만 접근 가능" ON public.user_friends FOR ALL 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 친구 요청 RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "사용자는 자신과 관련된 친구 요청만 접근 가능" ON public.friend_requests;
CREATE POLICY "사용자는 자신과 관련된 친구 요청만 접근 가능" ON public.friend_requests FOR ALL 
USING (auth.uid() = requester_id OR auth.uid() = requested_id);

-- 그룹 챌린지 RLS
ALTER TABLE public.group_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "모든 사용자는 활성 챌린지 조회 가능" ON public.group_challenges;
CREATE POLICY "모든 사용자는 활성 챌린지 조회 가능" ON public.group_challenges FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "호스트는 자신의 챌린지 관리 가능" ON public.group_challenges;
CREATE POLICY "호스트는 자신의 챌린지 관리 가능" ON public.group_challenges FOR ALL USING (auth.uid() = host_id);

-- 개인 챌린지 RLS
ALTER TABLE public.personal_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "사용자는 자신의 개인 챌린지만 접근 가능" ON public.personal_challenges;
CREATE POLICY "사용자는 자신의 개인 챌린지만 접근 가능" ON public.personal_challenges FOR ALL USING (auth.uid() = user_id);

-- 격려 메시지 RLS
ALTER TABLE public.encouragement_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "사용자는 자신과 관련된 메시지만 접근 가능" ON public.encouragement_messages;
CREATE POLICY "사용자는 자신과 관련된 메시지만 접근 가능" ON public.encouragement_messages FOR ALL 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- =====================================================
-- 7. 유용한 뷰 생성
-- =====================================================

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

-- =====================================================
-- 8. 스토리지 버킷 안전하게 생성
-- =====================================================

-- 프로필 이미지 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- 세션 스냅샷 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-snapshots', 'session-snapshots', false)
ON CONFLICT (id) DO NOTHING;

-- 스토리지 RLS 정책들
DROP POLICY IF EXISTS "프로필 이미지 업로드 정책" ON storage.objects;
CREATE POLICY "프로필 이미지 업로드 정책" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "프로필 이미지 조회 정책" ON storage.objects;
CREATE POLICY "프로필 이미지 조회 정책" ON storage.objects FOR SELECT 
USING (bucket_id = 'profile-images');

DROP POLICY IF EXISTS "프로필 이미지 삭제 정책" ON storage.objects;
CREATE POLICY "프로필 이미지 삭제 정책" ON storage.objects FOR DELETE 
USING (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =====================================================
-- 완료 메시지
-- =====================================================

SELECT 'Focus Habit 안전한 마이그레이션 업데이트가 완료되었습니다.' as message;
