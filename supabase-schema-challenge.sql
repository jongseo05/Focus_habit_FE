-- 대결 윈도우 관련 테이블들
-- 기존 study_session은 유지하고, challenge로 부분 구간만 관리

-- 대결 윈도우 테이블
CREATE TABLE IF NOT EXISTS challenge (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(room_id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('pomodoro', 'custom')),
  config JSONB NOT NULL, -- {work: 25, break: 5} 또는 {durationMin: 30}
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'ended')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 테이블에 created_by 컬럼 추가 (이미 존재하는 경우 무시)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenge' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE challenge ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 대결 참가자 테이블
CREATE TABLE IF NOT EXISTS challenge_participant (
  challenge_id UUID NOT NULL REFERENCES challenge(challenge_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  final_score NUMERIC(10,2) DEFAULT 0,
  PRIMARY KEY (challenge_id, user_id)
);

-- 실시간 랭킹 스냅샷 (선택사항)
CREATE TABLE IF NOT EXISTS challenge_tick (
  challenge_id UUID NOT NULL REFERENCES challenge(challenge_id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scores JSONB NOT NULL, -- {user_id: score, ...}
  rankings JSONB NOT NULL, -- [{userId: string, score: number, rank: number}]
  PRIMARY KEY (challenge_id, ts)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_challenge_room_id ON challenge(room_id);
CREATE INDEX IF NOT EXISTS idx_challenge_state ON challenge(state);
CREATE INDEX IF NOT EXISTS idx_challenge_participant_user ON challenge_participant(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_tick_challenge ON challenge_tick(challenge_id);

-- RLS 정책
ALTER TABLE challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_tick ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Users can view challenges in their rooms" ON challenge;
DROP POLICY IF EXISTS "Room hosts can create challenges" ON challenge;
DROP POLICY IF EXISTS "Room hosts can update challenges" ON challenge;
DROP POLICY IF EXISTS "Users can view challenge participants" ON challenge_participant;
DROP POLICY IF EXISTS "Users can join challenges in their rooms" ON challenge_participant;
DROP POLICY IF EXISTS "Users can view challenge ticks in their rooms" ON challenge_tick;

-- challenge 테이블 정책
CREATE POLICY "Users can view challenges in their rooms" ON challenge
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Room hosts can create challenges" ON challenge
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT room_id FROM study_rooms 
      WHERE host_id = auth.uid()
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Room hosts can update challenges" ON challenge
  FOR UPDATE USING (
    room_id IN (
      SELECT room_id FROM study_rooms 
      WHERE host_id = auth.uid()
    )
  );

-- challenge_participant 테이블 정책
CREATE POLICY "Users can view challenge participants" ON challenge_participant
  FOR SELECT USING (
    challenge_id IN (
      SELECT c.challenge_id FROM challenge c
      JOIN room_participants srp ON c.room_id = srp.room_id
      WHERE srp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join challenges in their rooms" ON challenge_participant
  FOR INSERT WITH CHECK (
    challenge_id IN (
      SELECT c.challenge_id FROM challenge c
      JOIN room_participants srp ON c.room_id = srp.room_id
      WHERE srp.user_id = auth.uid()
    )
  );

-- challenge_tick 테이블 정책
CREATE POLICY "Users can view challenge ticks in their rooms" ON challenge_tick
  FOR SELECT USING (
    challenge_id IN (
      SELECT c.challenge_id FROM challenge c
      JOIN room_participants srp ON c.room_id = srp.room_id
      WHERE srp.user_id = auth.uid()
    )
  );

-- 함수: 대결 시작 시 자동으로 참가자 추가
CREATE OR REPLACE FUNCTION auto_join_challenge()
RETURNS TRIGGER AS $$
BEGIN
  -- 룸의 모든 참가자를 대결에 자동 추가
  INSERT INTO challenge_participant (challenge_id, user_id)
  SELECT NEW.challenge_id, user_id
  FROM room_participants
  WHERE room_id = NEW.room_id
  AND user_id != NEW.created_by; -- 생성자 제외 (필요시)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거: challenge 생성 시 자동 참가 (기존 트리거 삭제 후 재생성)
DROP TRIGGER IF EXISTS trigger_auto_join_challenge ON challenge;
CREATE TRIGGER trigger_auto_join_challenge
  AFTER INSERT ON challenge
  FOR EACH ROW
  EXECUTE FUNCTION auto_join_challenge();

-- 함수: 대결 종료 시 최종 점수 계산
CREATE OR REPLACE FUNCTION calculate_final_scores(challenge_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- focus_sample에서 해당 시간창의 점수만 집계
  UPDATE challenge_participant 
  SET final_score = (
    SELECT COALESCE(AVG(score), 0)
    FROM focus_sample 
    WHERE user_id = challenge_participant.user_id
    AND ts BETWEEN (
      SELECT start_at FROM challenge WHERE challenge_id = challenge_uuid
    ) AND (
      SELECT COALESCE(end_at, NOW()) FROM challenge WHERE challenge_id = challenge_uuid
    )
  )
  WHERE challenge_id = challenge_uuid;
END;
$$ LANGUAGE plpgsql;

