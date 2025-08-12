import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// Supabase 클라이언트 생성 (데이터베이스만 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '설정됨' : '설정되지 않음');
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '설정됨' : '설정되지 않음');
  process.exit(1);
}

// 스토리지 기능을 제외한 데이터베이스 전용 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getCurrentUser() {
  try {
    console.log('현재 로그인된 사용자 정보를 확인합니다...');
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('사용자 정보 조회 오류:', error.message);
      return;
    }
    
    if (!user) {
      console.log('로그인된 사용자가 없습니다.');
      console.log('먼저 애플리케이션에서 로그인해주세요.');
      return;
    }
    
    console.log('\n=== 사용자 정보 ===');
    console.log('사용자 ID:', user.id);
    console.log('이메일:', user.email);
    console.log('생성일:', user.created_at);
    
    if (user.user_metadata) {
      console.log('이름:', user.user_metadata.name || '설정되지 않음');
      console.log('아바타:', user.user_metadata.avatar_url || '설정되지 않음');
    }
    
    console.log('\n=== 모의 데이터 삽입용 설정 ===');
    console.log('insert-mock-data.ts 파일에서 다음 값을 변경하세요:');
    console.log(`const MOCK_USER_ID = '${user.id}';`);
    
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  getCurrentUser()
    .then(() => {
      console.log('\n스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { getCurrentUser };
