-- 집중도 업데이트 테이블 (없는 경우에만 생성)
CREATE TABLE IF NOT EXISTS focus_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES study_rooms(room_id) ON DELETE CASCADE,
  focus_score INTEGER NOT NULL CHECK (focus_score >= 0 AND focus_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 설정 (이미 활성화되어 있지 않은 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'focus_updates' 
    AND schemaname = 'public'
  ) THEN
    ALTER TABLE focus_updates ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- focus_updates RLS 정책 (없는 경우에만 생성)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'focus_updates' 
    AND policyname = 'Users can insert their own focus updates'
  ) THEN
    CREATE POLICY "Users can insert their own focus updates" ON focus_updates
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'focus_updates' 
    AND policyname = 'Users can view focus updates in their rooms'
  ) THEN
    CREATE POLICY "Users can view focus updates in their rooms" ON focus_updates
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM room_participants rp 
          WHERE rp.room_id = focus_updates.room_id 
          AND rp.user_id = auth.uid()
          AND rp.left_at IS NULL
        )
      );
  END IF;
END $$;

-- encouragement_messages RLS 정책 (없는 경우에만 생성)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'encouragement_messages' 
    AND policyname = 'Users can send encouragement messages'
  ) THEN
    CREATE POLICY "Users can send encouragement messages" ON encouragement_messages
      FOR INSERT WITH CHECK (auth.uid() = from_user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'encouragement_messages' 
    AND policyname = 'Users can view messages in their rooms'
  ) THEN
    CREATE POLICY "Users can view messages in their rooms" ON encouragement_messages
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM room_participants rp 
          WHERE rp.room_id = encouragement_messages.room_id 
          AND rp.user_id = auth.uid()
          AND rp.left_at IS NULL
        )
      );
  END IF;
END $$;

-- 인덱스 생성 (없는 경우에만)
CREATE INDEX IF NOT EXISTS idx_focus_updates_room_user ON focus_updates(room_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_room ON encouragement_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_encouragement_messages_to_user ON encouragement_messages(to_user_id, created_at DESC);

-- Realtime 활성화 (이미 추가되어 있지 않은 경우에만)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'focus_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE focus_updates;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'encouragement_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE encouragement_messages;
  END IF;
END $$;
