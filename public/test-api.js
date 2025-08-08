// API 테스트 스크립트
// Node.js로 실행하거나 브라우저 콘솔에서 사용

const BASE_URL = 'http://localhost:3000/api';

// 테스트 함수들
async function testFocusSessionAPI() {
  console.log('🧪 집중 세션 API 테스트 시작...');
  
  try {
    // 1. 집중 세션 생성 테스트
    console.log('1. 집중 세션 생성 테스트...');
    const createResponse = await fetch(`${BASE_URL}/focus-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goal_min: 30,
        context_tag: 'study',
        session_type: 'study',
        notes: '테스트 세션입니다.'
      })
    });
    
    const createResult = await createResponse.json();
    console.log('생성 결과:', createResult);
    
    if (createResult.success && createResult.data) {
      const sessionId = createResult.data.session_id;
      
      // 2. 특정 세션 조회 테스트
      console.log('2. 특정 세션 조회 테스트...');
      const getResponse = await fetch(`${BASE_URL}/focus-session/${sessionId}`);
      const getResult = await getResponse.json();
      console.log('조회 결과:', getResult);
      
      // 3. 세션 목록 조회 테스트
      console.log('3. 세션 목록 조회 테스트...');
      const listResponse = await fetch(`${BASE_URL}/focus-session`);
      const listResult = await listResponse.json();
      console.log('목록 결과:', listResult);
      
      // 4. 세션 업데이트 테스트
      console.log('4. 세션 업데이트 테스트...');
      const updateResponse = await fetch(`${BASE_URL}/focus-session/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          focus_score: 85,
          distractions: 2,
          notes: '업데이트된 노트입니다.'
        })
      });
      
      const updateResult = await updateResponse.json();
      console.log('업데이트 결과:', updateResult);
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

async function testSendStudyStatusAPI() {
  console.log('🧪 오디오 분석 API 테스트 시작...');
  
  try {
    // 오디오 분석 데이터 전송 테스트
    const response = await fetch(`${BASE_URL}/send-study-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isStudy: true,
        context: 'study',
        confidence: 0.8,
        text: '집중 중입니다',
        audioFeatures: 10
      })
    });
    
    const result = await response.json();
    console.log('오디오 분석 결과:', result);
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

async function testDailyReportAPI() {
  console.log('🧪 일일 리포트 API 테스트 시작...');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(`${BASE_URL}/report/daily?date=${today}`);
    const result = await response.json();
    console.log('일일 리포트 결과:', result);
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// 전체 테스트 실행
async function runAllTests() {
  console.log('🚀 API 테스트 시작...');
  
  await testFocusSessionAPI();
  await testSendStudyStatusAPI();
  await testDailyReportAPI();
  
  console.log('✅ 모든 테스트 완료!');
}

// 브라우저에서 실행할 경우
if (typeof window !== 'undefined') {
  window.testAPI = {
    testFocusSessionAPI,
    testSendStudyStatusAPI,
    testDailyReportAPI,
    runAllTests
  };
  console.log('API 테스트 함수들이 window.testAPI에 등록되었습니다.');
  console.log('사용법: testAPI.runAllTests()');
}

// Node.js에서 실행할 경우
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testFocusSessionAPI,
    testSendStudyStatusAPI,
    testDailyReportAPI,
    runAllTests
  };
} 