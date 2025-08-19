-- =====================================================
-- Focus Habit 안전한 점진적 업데이트
-- 기존 테이블 존재 여부를 확인하고 안전하게 생성/수정
-- =====================================================

-- 확장 기능 안전하게 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. 기존 테이블 존재 여부 확인 및 생성
-- =====================================================

-- friend_requests 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'friend_requests') THEN
        
        CREATE TABLE public.friend_requests (
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
        
        RAISE NOTICE 'friend_requests 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'friend_requests 테이블이 이미 존재합니다.';
        
        -- 기존 테이블에 누락된 컬럼이 있으면 추가
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'friend_requests' AND column_name = 'requester_id') THEN
            ALTER TABLE public.friend_requests ADD COLUMN requester_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'friend_requests' AND column_name = 'requested_id') THEN
            ALTER TABLE public.friend_requests ADD COLUMN requested_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- study_rooms 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'study_rooms') THEN
        
        CREATE TABLE public.study_rooms (
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
        
        RAISE NOTICE 'study_rooms 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'study_rooms 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- room_participants 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'room_participants') THEN
        
        CREATE TABLE public.room_participants (
            room_id UUID NOT NULL REFERENCES public.study_rooms(room_id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
            is_host BOOLEAN DEFAULT false,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            left_at TIMESTAMP WITH TIME ZONE,
            focus_score REAL CHECK (focus_score >= 0 AND focus_score <= 100),
            session_id UUID REFERENCES public.focus_session(session_id) ON DELETE SET NULL,
            PRIMARY KEY (room_id, user_id)
        );
        
        RAISE NOTICE 'room_participants 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'room_participants 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- user_friends 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'user_friends') THEN
        
        CREATE TABLE public.user_friends (
            user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
            friend_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            PRIMARY KEY (user_id, friend_id),
            CHECK (user_id != friend_id)
        );
        
        RAISE NOTICE 'user_friends 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'user_friends 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- group_challenges 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'group_challenges') THEN
        
        CREATE TABLE public.group_challenges (
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
        
        RAISE NOTICE 'group_challenges 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'group_challenges 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- challenge_participants 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'challenge_participants') THEN
        
        CREATE TABLE public.challenge_participants (
            challenge_id UUID NOT NULL REFERENCES public.group_challenges(challenge_id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
            current_progress REAL DEFAULT 0 CHECK (current_progress >= 0),
            is_completed BOOLEAN DEFAULT false,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE,
            PRIMARY KEY (challenge_id, user_id)
        );
        
        RAISE NOTICE 'challenge_participants 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'challenge_participants 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- personal_challenges 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'personal_challenges') THEN
        
        CREATE TABLE public.personal_challenges (
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
        
        RAISE NOTICE 'personal_challenges 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'personal_challenges 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- challenge_invitations 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'challenge_invitations') THEN
        
        CREATE TABLE public.challenge_invitations (
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
        
        RAISE NOTICE 'challenge_invitations 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'challenge_invitations 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- encouragement_messages 테이블 존재 확인 및 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'encouragement_messages') THEN
        
        CREATE TABLE public.encouragement_messages (
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
        
        RAISE NOTICE 'encouragement_messages 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'encouragement_messages 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- =====================================================
-- 2. 제약조건 안전하게 추가
-- =====================================================

-- friend_requests 고유 제약조건 추가
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'friend_requests' 
                   AND constraint_name = 'friend_requests_requester_id_requested_id_key') THEN
        
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'friend_requests' AND column_name = 'requester_id') 
           AND EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'friend_requests' AND column_name = 'requested_id') THEN
            
            ALTER TABLE public.friend_requests 
            ADD CONSTRAINT friend_requests_requester_id_requested_id_key 
            UNIQUE (requester_id, requested_id);
            
            RAISE NOTICE 'friend_requests 고유 제약조건이 추가되었습니다.';
        ELSE
            RAISE NOTICE 'friend_requests 테이블에 필요한 컬럼이 없습니다.';
        END IF;
    ELSE
        RAISE NOTICE 'friend_requests 고유 제약조건이 이미 존재합니다.';
    END IF;
END $$;

-- challenge_invitations 고유 제약조건 추가
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'challenge_invitations' 
                   AND constraint_name = 'challenge_invitations_challenge_id_invited_id_key') THEN
        
        IF EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'challenge_invitations') THEN
            
            ALTER TABLE public.challenge_invitations 
            ADD CONSTRAINT challenge_invitations_challenge_id_invited_id_key 
            UNIQUE (challenge_id, invited_id);
            
            RAISE NOTICE 'challenge_invitations 고유 제약조건이 추가되었습니다.';
        END IF;
    ELSE
        RAISE NOTICE 'challenge_invitations 고유 제약조건이 이미 존재합니다.';
    END IF;
END $$;

-- =====================================================
-- 3. 인덱스 안전하게 생성
-- =====================================================

-- 스터디룸 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_study_rooms_host_id ON public.study_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_study_rooms_active ON public.study_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_rooms_created_at ON public.study_rooms(created_at DESC);

-- 참가자 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_joined_at ON public.room_participants(joined_at);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_active ON public.room_participants(room_id, left_at) WHERE left_at IS NULL;

-- 친구 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON public.user_friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requested_id ON public.friend_requests(requested_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status);

-- 챌린지 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_group_challenges_host_id ON public.group_challenges(host_id);
CREATE INDEX IF NOT EXISTS idx_group_challenges_active ON public.group_challenges(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_personal_challenges_user_id ON public.personal_challenges(user_id);

-- 메시지 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_receiver_id ON public.encouragement_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_unread ON public.encouragement_messages(receiver_id, is_read) WHERE is_read = false;

-- =====================================================
-- 4. 트리거 함수 및 트리거 생성
-- =====================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 각 테이블에 updated_at 트리거 추가
DO $$
BEGIN
    -- study_rooms 트리거
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'study_rooms') THEN
        DROP TRIGGER IF EXISTS update_study_rooms_updated_at ON public.study_rooms;
        CREATE TRIGGER update_study_rooms_updated_at 
            BEFORE UPDATE ON public.study_rooms 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- friend_requests 트리거
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friend_requests') THEN
        DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON public.friend_requests;
        CREATE TRIGGER update_friend_requests_updated_at 
            BEFORE UPDATE ON public.friend_requests 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- group_challenges 트리거
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'group_challenges') THEN
        DROP TRIGGER IF EXISTS update_group_challenges_updated_at ON public.group_challenges;
        CREATE TRIGGER update_group_challenges_updated_at 
            BEFORE UPDATE ON public.group_challenges 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- personal_challenges 트리거
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'personal_challenges') THEN
        DROP TRIGGER IF EXISTS update_personal_challenges_updated_at ON public.personal_challenges;
        CREATE TRIGGER update_personal_challenges_updated_at 
            BEFORE UPDATE ON public.personal_challenges 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- challenge_invitations 트리거
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'challenge_invitations') THEN
        DROP TRIGGER IF EXISTS update_challenge_invitations_updated_at ON public.challenge_invitations;
        CREATE TRIGGER update_challenge_invitations_updated_at 
            BEFORE UPDATE ON public.challenge_invitations 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================
-- 5. RLS 정책 안전하게 생성
-- =====================================================

-- 스터디룸 RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'study_rooms') THEN
        ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "모든 사용자는 활성 스터디룸 조회 가능" ON public.study_rooms;
        CREATE POLICY "모든 사용자는 활성 스터디룸 조회 가능" ON public.study_rooms FOR SELECT USING (is_active = true);
        
        DROP POLICY IF EXISTS "호스트는 자신의 스터디룸 관리 가능" ON public.study_rooms;
        CREATE POLICY "호스트는 자신의 스터디룸 관리 가능" ON public.study_rooms FOR ALL USING (auth.uid() = host_id);
    END IF;
END $$;

-- 스터디룸 참가자 RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'room_participants') THEN
        ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "참가자는 자신이 속한 방의 참가자 목록 조회 가능" ON public.room_participants;
        CREATE POLICY "참가자는 자신이 속한 방의 참가자 목록 조회 가능" ON public.room_participants FOR SELECT 
        USING (EXISTS (SELECT 1 FROM public.room_participants rp WHERE rp.room_id = room_participants.room_id AND rp.user_id = auth.uid()));
        
        DROP POLICY IF EXISTS "사용자는 자신의 참가 기록 관리 가능" ON public.room_participants;
        CREATE POLICY "사용자는 자신의 참가 기록 관리 가능" ON public.room_participants FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 친구 관계 RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_friends') THEN
        ALTER TABLE public.user_friends ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "사용자는 자신의 친구 관계만 접근 가능" ON public.user_friends;
        CREATE POLICY "사용자는 자신의 친구 관계만 접근 가능" ON public.user_friends FOR ALL 
        USING (auth.uid() = user_id OR auth.uid() = friend_id);
    END IF;
END $$;

-- 친구 요청 RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friend_requests') THEN
        ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "사용자는 자신과 관련된 친구 요청만 접근 가능" ON public.friend_requests;
        CREATE POLICY "사용자는 자신과 관련된 친구 요청만 접근 가능" ON public.friend_requests FOR ALL 
        USING (auth.uid() = requester_id OR auth.uid() = requested_id);
    END IF;
END $$;

-- =====================================================
-- 6. 유용한 뷰 생성
-- =====================================================

-- 활성 스터디룸 상세 뷰
CREATE OR REPLACE VIEW public.active_study_rooms_detail AS
SELECT 
    sr.*,
    p.display_name as host_name,
    p.avatar_url as host_avatar,
    COALESCE(COUNT(rp.user_id), 0) as actual_participants
FROM public.study_rooms sr
JOIN public.profiles p ON sr.host_id = p.user_id
LEFT JOIN public.room_participants rp ON sr.room_id = rp.room_id AND rp.left_at IS NULL
WHERE sr.is_active = true
GROUP BY sr.room_id, p.display_name, p.avatar_url;

-- =====================================================
-- 완료 메시지
-- =====================================================

SELECT 'Focus Habit 안전한 점진적 업데이트가 완료되었습니다.' as message;
