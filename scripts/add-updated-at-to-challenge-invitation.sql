-- challenge_invitation 테이블에 updated_at 컬럼 추가
ALTER TABLE challenge_invitation 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 기존 레코드들의 updated_at을 created_at으로 설정
UPDATE challenge_invitation 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- updated_at 컬럼을 NOT NULL로 설정
ALTER TABLE challenge_invitation 
ALTER COLUMN updated_at SET NOT NULL;

-- updated_at 자동 업데이트를 위한 트리거 생성
CREATE OR REPLACE FUNCTION update_challenge_invitation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 존재하면 교체)
DROP TRIGGER IF EXISTS update_challenge_invitation_updated_at ON challenge_invitation;
CREATE TRIGGER update_challenge_invitation_updated_at
  BEFORE UPDATE ON challenge_invitation
  FOR EACH ROW
  EXECUTE FUNCTION update_challenge_invitation_updated_at();

-- updated_at 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_challenge_invitation_updated_at ON challenge_invitation(updated_at);
