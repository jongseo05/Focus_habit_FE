-- =====================================================
-- Focus Habit 누락된 컬럼 및 구조 수정
-- =====================================================

-- 확장 기능 안전하게 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. 기본 테이블 존재 여부 및 필수 컬럼 확인
-- =====================================================

-- profiles 테이블 확인 및 필수 컬럼 추가
DO $$
BEGIN
    -- profiles 테이블이 존재하는지 확인
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        
        -- profiles 테이블이 없으면 생성
        CREATE TABLE public.profiles (
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
        
        RAISE NOTICE 'profiles 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'profiles 테이블이 이미 존재합니다.';
        
        -- 필요한 컬럼들이 있는지 확인하고 없으면 추가
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'profiles' AND column_name = 'status') THEN
            ALTER TABLE public.profiles 
            ADD COLUMN status TEXT DEFAULT 'offline' 
            CHECK (status IN ('online', 'offline', 'busy', 'away'));
            RAISE NOTICE 'profiles 테이블에 status 컬럼을 추가했습니다.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'profiles' AND column_name = 'school') THEN
            ALTER TABLE public.profiles ADD COLUMN school TEXT;
            RAISE NOTICE 'profiles 테이블에 school 컬럼을 추가했습니다.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'profiles' AND column_name = 'major') THEN
            ALTER TABLE public.profiles ADD COLUMN major TEXT;
            RAISE NOTICE 'profiles 테이블에 major 컬럼을 추가했습니다.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'profiles' AND column_name = 'display_name') THEN
            ALTER TABLE public.profiles ADD COLUMN display_name TEXT NOT NULL DEFAULT 'User';
            RAISE NOTICE 'profiles 테이블에 display_name 컬럼을 추가했습니다.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'profiles' AND column_name = 'handle') THEN
            ALTER TABLE public.profiles ADD COLUMN handle TEXT UNIQUE;
            RAISE NOTICE 'profiles 테이블에 handle 컬럼을 추가했습니다.';
        END IF;
    END IF;
END $$;

-- focus_session 테이블 확인 및 필수 컬럼 추가
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'focus_session') THEN
        
        -- room_id 컬럼이 없으면 추가
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'focus_session' AND column_name = 'room_id') THEN
            ALTER TABLE public.focus_session ADD COLUMN room_id UUID;
            RAISE NOTICE 'focus_session 테이블에 room_id 컬럼을 추가했습니다.';
        END IF;
        
        -- session_type 체크 제약조건 업데이트
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'focus_session' AND column_name = 'session_type') THEN
            
            -- 기존 제약조건 제거 후 새로 추가
            ALTER TABLE public.focus_session DROP CONSTRAINT IF EXISTS focus_session_session_type_check;
            ALTER TABLE public.focus_session 
            ADD CONSTRAINT focus_session_session_type_check 
            CHECK (session_type IN ('study', 'work', 'reading', 'other', 'study_room'));
            
            RAISE NOTICE 'focus_session 테이블의 session_type 제약조건을 업데이트했습니다.';
        END IF;
    END IF;
END $$;

-- =====================================================
-- 2. 소셜 기능 테이블들 단계별 생성
-- =====================================================

-- 1단계: study_rooms 테이블 생성 (다른 테이블들이 참조하므로 먼저 생성)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'study_rooms') THEN
        
        CREATE TABLE public.study_rooms (
            room_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            host_id UUID NOT NULL,
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

-- 2단계: 외래키 제약조건 안전하게 추가
DO $$
BEGIN
    -- study_rooms의 host_id 외래키 제약조건 추가
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'study_rooms') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE table_name = 'study_rooms' 
                       AND constraint_name LIKE '%host_id%') THEN
            
            ALTER TABLE public.study_rooms 
            ADD CONSTRAINT study_rooms_host_id_fkey 
            FOREIGN KEY (host_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
            
            RAISE NOTICE 'study_rooms 테이블에 host_id 외래키 제약조건을 추가했습니다.';
        END IF;
    END IF;
    
    -- focus_session의 room_id 외래키 제약조건 추가
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'focus_session') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'study_rooms')
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'focus_session' AND column_name = 'room_id') THEN
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE table_name = 'focus_session' 
                       AND constraint_name LIKE '%room_id%') THEN
            
            ALTER TABLE public.focus_session 
            ADD CONSTRAINT focus_session_room_id_fkey 
            FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id) ON DELETE SET NULL;
            
            RAISE NOTICE 'focus_session 테이블에 room_id 외래키 제약조건을 추가했습니다.';
        END IF;
    END IF;
END $$;

-- 3단계: room_participants 테이블 생성
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'room_participants') THEN
        
        CREATE TABLE public.room_participants (
            room_id UUID NOT NULL,
            user_id UUID NOT NULL,
            is_host BOOLEAN DEFAULT false,
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            left_at TIMESTAMP WITH TIME ZONE,
            focus_score REAL CHECK (focus_score >= 0 AND focus_score <= 100),
            session_id UUID,
            PRIMARY KEY (room_id, user_id)
        );
        
        RAISE NOTICE 'room_participants 테이블이 생성되었습니다.';
    ELSE
        RAISE NOTICE 'room_participants 테이블이 이미 존재합니다.';
    END IF;
END $$;

-- 4단계: room_participants 외래키 제약조건 추가
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'room_participants') THEN
        
        -- room_id 외래키
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE table_name = 'room_participants' 
                       AND constraint_name LIKE '%room_id%') THEN
            
            ALTER TABLE public.room_participants 
            ADD CONSTRAINT room_participants_room_id_fkey 
            FOREIGN KEY (room_id) REFERENCES public.study_rooms(room_id) ON DELETE CASCADE;
        END IF;
        
        -- user_id 외래키
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE table_name = 'room_participants' 
                       AND constraint_name LIKE '%user_id%') THEN
            
            ALTER TABLE public.room_participants 
            ADD CONSTRAINT room_participants_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
        END IF;
        
        -- session_id 외래키
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'focus_session')
           AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                           WHERE table_name = 'room_participants' 
                           AND constraint_name LIKE '%session_id%') THEN
            
            ALTER TABLE public.room_participants 
            ADD CONSTRAINT room_participants_session_id_fkey 
            FOREIGN KEY (session_id) REFERENCES public.focus_session(session_id) ON DELETE SET NULL;
        END IF;
        
        RAISE NOTICE 'room_participants 테이블의 외래키 제약조건들을 추가했습니다.';
    END IF;
END $$;

-- 5단계: 나머지 소셜 기능 테이블들 생성
DO $$
BEGIN
    -- user_friends 테이블
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
    END IF;
    
    -- friend_requests 테이블
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
    END IF;
    
    -- encouragement_messages 테이블
    IF NOT EXISTS (SELECT FROM information_schema.tables 
                   WHERE table_schema = 'public' AND table_name = 'encouragement_messages') THEN
        
        CREATE TABLE public.encouragement_messages (
            message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
            receiver_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
            room_id UUID REFERENCES public.study_rooms(room_id) ON DELETE SET NULL,
            message TEXT NOT NULL,
            message_type TEXT DEFAULT 'encouragement' CHECK (message_type IN ('encouragement', 'celebration', 'reminder', 'support')),
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CHECK (sender_id != receiver_id)
        );
        
        RAISE NOTICE 'encouragement_messages 테이블이 생성되었습니다.';
    END IF;
END $$;

-- =====================================================
-- 3. 기본 인덱스 생성
-- =====================================================

-- 필수 인덱스들
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

CREATE INDEX IF NOT EXISTS idx_study_rooms_host_id ON public.study_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_study_rooms_active ON public.study_rooms(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_study_rooms_created_at ON public.study_rooms(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_active ON public.room_participants(room_id, left_at) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON public.user_friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requested_id ON public.friend_requests(requested_id);
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_receiver_id ON public.encouragement_messages(receiver_id);

-- =====================================================
-- 4. 기본 트리거 생성
-- =====================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거들 생성
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
        DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
        CREATE TRIGGER update_profiles_updated_at 
            BEFORE UPDATE ON public.profiles 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'study_rooms') THEN
        DROP TRIGGER IF EXISTS update_study_rooms_updated_at ON public.study_rooms;
        CREATE TRIGGER update_study_rooms_updated_at 
            BEFORE UPDATE ON public.study_rooms 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'friend_requests') THEN
        DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON public.friend_requests;
        CREATE TRIGGER update_friend_requests_updated_at 
            BEFORE UPDATE ON public.friend_requests 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================
-- 5. 기본 RLS 정책
-- =====================================================

-- profiles RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "사용자는 자신의 프로필만 조회 가능" ON public.profiles;
        CREATE POLICY "사용자는 자신의 프로필만 조회 가능" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
        
        DROP POLICY IF EXISTS "사용자는 자신의 프로필만 업데이트 가능" ON public.profiles;
        CREATE POLICY "사용자는 자신의 프로필만 업데이트 가능" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- study_rooms RLS
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

-- =====================================================
-- 6. 기본 뷰 생성
-- =====================================================

-- 활성 스터디룸 뷰 (안전하게 생성)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'study_rooms')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'room_participants') THEN
        
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
        
        RAISE NOTICE 'active_study_rooms_detail 뷰가 생성되었습니다.';
    END IF;
END $$;

-- =====================================================
-- 완료 메시지
-- =====================================================

SELECT 'Focus Habit 누락된 컬럼 및 구조 수정이 완료되었습니다.' as message;
