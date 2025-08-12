import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// Supabase 클라이언트 생성 (데이터베이스만 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('환경 변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '설정됨' : '설정되지 않음');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '설정됨' : '설정되지 않음');
  process.exit(1);
}

// 스토리지 기능을 제외한 데이터베이스 전용 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 모의 사용자 ID (실제 사용자 ID로 교체 필요)
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000000';

// 모의 데이터 생성 함수들
function generateMockSessions() {
  const sessions = [];
  const now = new Date();
  
  // 최근 7일간의 세션 데이터 생성
  for (let i = 6; i >= 0; i--) {
    const sessionDate = new Date(now);
    sessionDate.setDate(now.getDate() - i);
    
    // 하루에 2-4개 세션 생성
    const sessionCount = Math.floor(Math.random() * 3) + 2;
    
    for (let j = 0; j < sessionCount; j++) {
      const startHour = 9 + Math.floor(Math.random() * 8); // 9시-17시
      const startMinute = Math.floor(Math.random() * 60);
      const duration = 25 + Math.floor(Math.random() * 35); // 25-60분
      
      const startedAt = new Date(sessionDate);
      startedAt.setHours(startHour, startMinute, 0, 0);
      
      const endedAt = new Date(startedAt);
      endedAt.setMinutes(startedAt.getMinutes() + duration);
      
      const focusScore = Math.floor(Math.random() * 40) + 60; // 60-100점
      const distractions = Math.floor(Math.random() * 5); // 0-4개
      
      sessions.push({
        user_id: MOCK_USER_ID,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        goal_min: duration,
        context_tag: ['공부', '업무', '독서', '코딩'][Math.floor(Math.random() * 4)],
        session_type: 'study',
        focus_score: focusScore,
        distractions: distractions,
        notes: `모의 세션 ${i + 1}-${j + 1}`
      });
    }
  }
  
  return sessions;
}

function generateMockFocusSamples(sessionId: string, startedAt: string, endedAt: string) {
  const samples = [];
  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(endedAt).getTime();
  const interval = 30000; // 30초마다 샘플
  
  for (let time = startTime; time <= endTime; time += interval) {
    const score = Math.floor(Math.random() * 40) + 60; // 60-100점
    const pEye = Math.random() * 0.3 + 0.7; // 0.7-1.0
    const poseDev = Math.random() * 0.2; // 0-0.2
    const rmsDb = Math.random() * 20 + 40; // 40-60dB
    
    samples.push({
      session_id: sessionId,
      ts: new Date(time).toISOString(),
      raw_score: score,
      score_conf: Math.random() * 0.3 + 0.7, // 0.7-1.0
      score: score,
      p_eye: pEye,
      pose_dev: poseDev,
      topic_tag: 'study',
      rms_db: rmsDb
    });
  }
  
  return samples;
}

function generateMockMlFeatures(sessionId: string, startedAt: string, endedAt: string) {
  const features = [];
  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(endedAt).getTime();
  const interval = 1000; // 1초마다 피처
  
  for (let time = startTime; time <= endTime; time += interval) {
    features.push({
      session_id: sessionId,
      ts: new Date(time).toISOString(),
      head_pose_pitch: (Math.random() - 0.5) * 30, // -15도 ~ +15도
      head_pose_yaw: (Math.random() - 0.5) * 60, // -30도 ~ +30도
      head_pose_roll: (Math.random() - 0.5) * 20, // -10도 ~ +10도
      eye_status: ['OPEN', 'CLOSED', 'PARTIAL'][Math.floor(Math.random() * 3)],
      ear_value: Math.random() * 0.3 + 0.7, // 0.7-1.0
      frame_number: Math.floor((time - startTime) / 1000)
    });
  }
  
  return features;
}

function generateMockEvents(sessionId: string, startedAt: string, endedAt: string) {
  const events = [];
  const startTime = new Date(startedAt).getTime();
  const endTime = new Date(endedAt).getTime();
  
  // 집중 이벤트 (시작, 중간, 끝)
  events.push({
    session_id: sessionId,
    ts: new Date(startTime).toISOString(),
    event_type: 'focus',
    payload: { action: 'session_started', confidence: 0.9 }
  });
  
  // 중간에 몇 개의 이벤트 추가
  const eventCount = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < eventCount; i++) {
    const eventTime = startTime + Math.random() * (endTime - startTime);
    const eventType = ['phone', 'distraction', 'break', 'posture'][Math.floor(Math.random() * 4)];
    
    let payload = {};
    switch (eventType) {
      case 'phone':
        payload = { action: 'phone_picked_up', duration: Math.floor(Math.random() * 300) + 30 };
        break;
      case 'distraction':
        payload = { action: 'distraction_detected', type: 'environment_noise' };
        break;
      case 'break':
        payload = { action: 'break_started', reason: 'stretch' };
        break;
      case 'posture':
        payload = { action: 'posture_warning', severity: 'medium' };
        break;
    }
    
    events.push({
      session_id: sessionId,
      ts: new Date(eventTime).toISOString(),
      event_type: eventType,
      payload: payload
    });
  }
  
  // 세션 종료 이벤트
  events.push({
    session_id: sessionId,
    ts: new Date(endTime).toISOString(),
    event_type: 'focus',
    payload: { action: 'session_completed', duration: endTime - startTime }
  });
  
  return events;
}

async function insertMockData() {
  try {
    console.log('모의 데이터 삽입을 시작합니다...');
    
    // 1. 집중 세션 데이터 삽입
    console.log('1. 집중 세션 데이터 생성 중...');
    const mockSessions = generateMockSessions();
    console.log(`${mockSessions.length}개의 세션을 생성했습니다.`);
    
    const { data: sessions, error: sessionsError } = await supabase
      .from('focus_session')
      .insert(mockSessions)
      .select('session_id, started_at, ended_at');
    
    if (sessionsError) {
      console.error('세션 데이터 삽입 오류:', sessionsError);
      return;
    }
    
    console.log('세션 데이터 삽입 완료!');
    
    // 2. 각 세션에 대한 상세 데이터 삽입
    for (const session of sessions) {
      console.log(`\n세션 ${session.session_id}에 대한 상세 데이터 생성 중...`);
      
      // 집중도 샘플 데이터
      const samples = generateMockFocusSamples(
        session.session_id,
        session.started_at,
        session.ended_at
      );
      
      if (samples.length > 0) {
        const { error: samplesError } = await supabase
          .from('focus_sample')
          .insert(samples);
        
        if (samplesError) {
          console.error('샘플 데이터 삽입 오류:', samplesError);
        } else {
          console.log(`${samples.length}개의 샘플 데이터 삽입 완료`);
        }
      }
      
      // ML 피처 데이터
      const features = generateMockMlFeatures(
        session.session_id,
        session.started_at,
        session.ended_at
      );
      
      if (features.length > 0) {
        const { error: featuresError } = await supabase
          .from('ml_features')
          .insert(features);
        
        if (featuresError) {
          console.error('ML 피처 데이터 삽입 오류:', featuresError);
        } else {
          console.log(`${features.length}개의 ML 피처 데이터 삽입 완료`);
        }
      }
      
      // 이벤트 데이터
      const events = generateMockEvents(
        session.session_id,
        session.started_at,
        session.ended_at
      );
      
      if (events.length > 0) {
        const { error: eventsError } = await supabase
          .from('focus_event')
          .insert(events);
        
        if (eventsError) {
          console.error('이벤트 데이터 삽입 오류:', eventsError);
        } else {
          console.log(`${events.length}개의 이벤트 데이터 삽입 완료`);
        }
      }
    }
    
    console.log('\n🎉 모든 모의 데이터 삽입이 완료되었습니다!');
    console.log(`총 ${sessions.length}개의 세션과 관련 데이터가 생성되었습니다.`);
    
  } catch (error) {
    console.error('데이터 삽입 중 오류 발생:', error);
  }
}

// 스크립트 실행
if (require.main === module) {
  insertMockData()
    .then(() => {
      console.log('스크립트 실행 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('스크립트 실행 실패:', error);
      process.exit(1);
    });
}

export { insertMockData };
