-- 기존 챌린지 관련 테이블들
-- 챌린지 테이블
CREATE TABLE IF NOT EXISTS challenge (
  challenge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(room_id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('pomodoro', 'custom')),
  config JSONB NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'completed', 'cancelled')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 챌린지 참가자 테이블
CREATE TABLE IF NOT EXISTS challenge_participant (
  participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenge(challenge_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  current_progress INTEGER DEFAULT 0,
  UNIQUE(challenge_id, user_id)
);

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

-- 대결 초대 테이블 생성
CREATE TABLE IF NOT EXISTS challenge_invitation (
  invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES study_rooms(room_id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenge(challenge_id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('pomodoro', 'custom')),
  config JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  responses JSONB NOT NULL DEFAULT '{}', -- {user_id: 'pending'|'accepted'|'rejected'}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes')
);

-- 대결 초대 응답 테이블 (상세 응답 기록)
CREATE TABLE IF NOT EXISTS challenge_invitation_response (
  response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES challenge_invitation(invitation_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('accepted', 'rejected')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invitation_id, user_id)
);

-- 인덱스 생성
-- 챌린지 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_room_id ON challenge(room_id);
CREATE INDEX IF NOT EXISTS idx_challenge_created_by ON challenge(created_by);
CREATE INDEX IF NOT EXISTS idx_challenge_state ON challenge(state);
CREATE INDEX IF NOT EXISTS idx_challenge_created_at ON challenge(created_at);

-- 챌린지 참가자 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_participant_challenge_id ON challenge_participant(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participant_user_id ON challenge_participant(user_id);

-- 대결 기록 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_history_room_id ON challenge_history(room_id);
CREATE INDEX IF NOT EXISTS idx_challenge_history_challenge_id ON challenge_history(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_history_winner_id ON challenge_history(winner_id);
CREATE INDEX IF NOT EXISTS idx_challenge_history_created_at ON challenge_history(created_at);
CREATE INDEX IF NOT EXISTS idx_challenge_history_created_by ON challenge_history(created_by);

-- 대결 초대 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_room_id ON challenge_invitation(room_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_challenge_id ON challenge_invitation(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_proposed_by ON challenge_invitation(proposed_by);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_status ON challenge_invitation(status);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_expires_at ON challenge_invitation(expires_at);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_response_invitation_id ON challenge_invitation_response(invitation_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_response_user_id ON challenge_invitation_response(user_id);

-- 5. RLS 정책 설정
ALTER TABLE challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_invitation ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_invitation_response ENABLE ROW LEVEL SECURITY;

-- 챌린지 테이블 RLS 정책
CREATE POLICY "Users can view challenges in their rooms" ON challenge
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "Room hosts can create challenges" ON challenge
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT room_id FROM study_rooms 
      WHERE host_id = auth.uid()
    )
  );

CREATE POLICY "Room hosts can update challenges" ON challenge
  FOR UPDATE USING (
    room_id IN (
      SELECT room_id FROM study_rooms 
      WHERE host_id = auth.uid()
    )
  );

-- 챌린지 참가자 테이블 RLS 정책
CREATE POLICY "Users can view challenge participants" ON challenge_participant
  FOR SELECT USING (
    challenge_id IN (
      SELECT challenge_id FROM challenge 
      WHERE room_id IN (
        SELECT room_id FROM room_participants 
        WHERE user_id = auth.uid() AND left_at IS NULL
      )
    )
  );

CREATE POLICY "Users can join challenges in their rooms" ON challenge_participant
  FOR INSERT WITH CHECK (
    challenge_id IN (
      SELECT challenge_id FROM challenge 
      WHERE room_id IN (
        SELECT room_id FROM room_participants 
        WHERE user_id = auth.uid() AND left_at IS NULL
      )
    ) AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own participation" ON challenge_participant
  FOR UPDATE USING (user_id = auth.uid());

-- 대결 기록 테이블 RLS 정책
CREATE POLICY "Users can view challenge history in their rooms" ON challenge_history
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "Users can create challenge history" ON challenge_history
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

-- 대결 초대 테이블 RLS 정책
CREATE POLICY "Users can view challenge invitations in their rooms" ON challenge_invitation
  FOR SELECT USING (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "Users can propose challenges" ON challenge_invitation
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT room_id FROM room_participants 
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "Users can update their own challenge invitations" ON challenge_invitation
  FOR UPDATE USING (proposed_by = auth.uid());

-- 대결 초대 응답 테이블 RLS 정책
CREATE POLICY "Users can view challenge invitation responses" ON challenge_invitation_response
  FOR SELECT USING (
    invitation_id IN (
      SELECT invitation_id FROM challenge_invitation 
      WHERE proposed_by = auth.uid()
    )
  );

CREATE POLICY "Users can respond to challenge invitations" ON challenge_invitation_response
  FOR INSERT WITH CHECK (
    invitation_id IN (
      SELECT invitation_id FROM challenge_invitation 
      WHERE proposed_by = auth.uid()
    )
  );

-- 6. 함수 생성 (최종 점수 계산)
CREATE OR REPLACE FUNCTION calculate_final_scores(challenge_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- 최종 점수 계산 및 순위 업데이트
  UPDATE challenge_participant 
  SET final_score = current_score
  WHERE challenge_id = challenge_uuid;
  
  -- 챌린지 종료 시간 설정
  UPDATE challenge 
  SET end_at = NOW(), state = 'ended'
  WHERE challenge_id = challenge_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 트리거 함수 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 생성
CREATE TRIGGER update_challenge_updated_at
  BEFORE UPDATE ON challenge
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
