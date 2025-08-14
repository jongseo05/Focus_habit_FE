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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
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
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_room_id ON challenge_invitation(room_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_challenge_id ON challenge_invitation(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_proposed_by ON challenge_invitation(proposed_by);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_status ON challenge_invitation(status);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_expires_at ON challenge_invitation(expires_at);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_response_invitation_id ON challenge_invitation_response(invitation_id);
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_response_user_id ON challenge_invitation_response(user_id);
