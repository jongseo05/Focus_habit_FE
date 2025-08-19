-- =====================================================
-- Social Stats 테이블 생성
-- =====================================================

-- 소셜 통계 테이블 생성
CREATE TABLE IF NOT EXISTS public.social_stats (
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
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 소셜 통계 업데이트 트리거 추가
CREATE TRIGGER update_social_stats_updated_at 
    BEFORE UPDATE ON public.social_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_social_stats_user_id ON public.social_stats(user_id);

-- RLS 정책 설정
ALTER TABLE public.social_stats ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 소셜 통계만 조회 가능
CREATE POLICY "Users can view their own social stats" ON public.social_stats FOR SELECT 
USING (auth.uid() = user_id);

-- 사용자는 자신의 소셜 통계만 업데이트 가능
CREATE POLICY "Users can update their own social stats" ON public.social_stats FOR UPDATE 
USING (auth.uid() = user_id);

-- 시스템에서 소셜 통계 생성 가능
CREATE POLICY "System can create social stats" ON public.social_stats FOR INSERT 
WITH CHECK (true);

-- 기존 사용자들을 위한 소셜 통계 초기화
INSERT INTO public.social_stats (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.social_stats)
ON CONFLICT (user_id) DO NOTHING;
