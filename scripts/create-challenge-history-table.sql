-- 대결 기록 테이블 생성
CREATE TABLE IF NOT EXISTS challenge_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(room_id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenge(challenge_id) ON DELETE CASCADE,
  duration INTEGER NOT NULL, -- 대결 시간 (분)
  scores JSONB NOT NULL, -- {user_id: score} 형태의 최종 점수
  winner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('pomodoro', 'custom')),
  config JSONB NOT NULL, -- 대결 설정 (work, break, durationMin 등)
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_challenge_history_room_id ON challenge_history(room_id);
CREATE INDEX IF NOT EXISTS idx_challenge_history_challenge_id ON challenge_history(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_history_winner_id ON challenge_history(winner_id);
CREATE INDEX IF NOT EXISTS idx_challenge_history_created_at ON challenge_history(created_at);
CREATE INDEX IF NOT EXISTS idx_challenge_history_created_by ON challenge_history(created_by);
