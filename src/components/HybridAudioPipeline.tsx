"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useDashboardStore } from "@/stores/dashboardStore"

// 공부 관련 텍스트 분석 함수 (키워드 기반) - 메모이제이션 적용
const analyzeStudyRelatedByKeywords = (() => {
  const studyKeywords = [
    "공부", "학습", "수업", "문제", "책", "읽기", "쓰기", "계산", "공식", "이론",
    "시험", "과제", "프로젝트", "리포트", "논문", "연구", "분석", "실험",
    "강의", "교과서", "참고서", "문제집", "연습", "복습", "예습"
  ]
  
  const keywordSet = new Set(studyKeywords.map(k => k.toLowerCase()))
  
  return (text: string): boolean => {
    const lowerText = text.toLowerCase()
    return studyKeywords.some(keyword => lowerText.includes(keyword))
  }
})()

  // 성능 최적화를 위한 디바운스 훅
  function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value)
      }, delay)

      return () => {
        clearTimeout(handler)
      }
    }, [value, delay])

    return debouncedValue
  }



function buildPacket({ mel, scene_tag, noise_db }: { mel: number[]; scene_tag: string; noise_db: number }) {
  return {
    timestamp: Date.now(),
    mel,
    scene_tag,
    noise_db
  }
}

type SpeechRecognitionType = typeof window extends { webkitSpeechRecognition: infer T } ? T : any;
const SpeechRecognition: any =
  typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

export default function HybridAudioPipeline() {
  // 집중 모드 상태 가져오기
  const { 
    isRunning: isFocusSessionRunning, 
    isPaused: isFocusSessionPaused,
    focusScore,
    updateFocusScore
  } = useDashboardStore()
  


  // 오디오 파이프라인 Ref
  const audioContextRef = useRef<AudioContext | null>(null)
  // AudioWorklet 제거됨 (GPT 기반 발화분석으로 대체)
  // Web Worker 제거됨 (GPT 기반 발화분석으로 대체)
  const streamRef = useRef<MediaStream | null>(null) // 스트림을 한 번만 생성하고 재사용

  // --- 상태 관리 ---
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false) // 음성 구간 감지 상태
  const [isListening, setIsListening] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSpeechRecognitionActive, setIsSpeechRecognitionActive] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState("") // 실시간으로 표시될 텍스트
  const [isInitialized, setIsInitialized] = useState(false) // 오디오 파이프라인 초기화 상태
  const [isInitializing, setIsInitializing] = useState(false) // 초기화 진행 중 상태
  const [error, setError] = useState<string | null>(null) // 오류 상태
  const [currentAudioLevel, setCurrentAudioLevel] = useState<number>(0) // 현재 오디오 레벨
  const speechBufferRef = useRef<string>("") // 한 발화가 끝날 때까지 텍스트를 모으는 버퍼
  const featureBufferRef = useRef<any[]>([]) // 한 발화 동안의 오디오 특징을 모으는 버퍼
  
  // 타임스탬프 관리
  const speechStartTimeRef = useRef<number | null>(null)
  const speechEndTimeRef = useRef<number | null>(null)
  const silenceStartTimeRef = useRef<number | null>(null) // 조용함 시작 시간
  
  // 오디오 레벨 기반 발화 감지 상태
  const audioLevelSpeechStartRef = useRef<number | null>(null) // 오디오 레벨로 감지한 발화 시작 시간
  const audioLevelSpeechEndRef = useRef<number | null>(null) // 오디오 레벨로 감지한 발화 종료 시간
  const isAudioLevelSpeakingRef = useRef<boolean>(false) // 오디오 레벨 기반 발화 상태
  
  // 오디오 레벨 변화 감지용 상태
  const previousAudioLevelRef = useRef<number>(0) // 이전 오디오 레벨
  const audioLevelHistoryRef = useRef<number[]>([]) // 최근 오디오 레벨 히스토리 (최대 10개)
  const rapidDropDetectedRef = useRef<boolean>(false) // 급격한 하락 감지 플래그

  // 성능 최적화를 위한 디바운스된 텍스트
  const debouncedLiveTranscript = useDebounce(liveTranscript, 100)

  // useEffect 클로저에서 최신 상태를 참조하기 위한 Ref
  const stateRef = useRef({ isSpeaking, isListening });
  stateRef.current = { isSpeaking, isListening };

  // 오디오 레벨 급격한 하락 감지 함수
  const detectRapidAudioLevelDrop = useCallback((currentLevel: number): boolean => {
    // 히스토리에 현재 레벨 추가 (최대 10개 유지)
    audioLevelHistoryRef.current.push(currentLevel);
    if (audioLevelHistoryRef.current.length > 10) {
      audioLevelHistoryRef.current.shift();
    }
    
    // 최소 3개의 데이터가 있어야 분석
    if (audioLevelHistoryRef.current.length < 3) {
      previousAudioLevelRef.current = currentLevel;
      return false;
    }
    
    // 최근 3개 값의 평균과 이전 3개 값의 평균 비교
    const recentValues = audioLevelHistoryRef.current.slice(-3);
    const previousValues = audioLevelHistoryRef.current.slice(-6, -3);
    
    if (previousValues.length < 3) {
      previousAudioLevelRef.current = currentLevel;
      return false;
    }
    
    const recentAverage = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const previousAverage = previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length;
    
    // 급격한 하락 감지 (이전 평균 대비 50% 이상 감소)
    const dropRatio = recentAverage / previousAverage;
    const isRapidDrop = dropRatio < 0.5 && previousAverage > 30 && recentAverage < 25;
    
    if (isRapidDrop && !rapidDropDetectedRef.current) {
      console.log('🎤 급격한 오디오 레벨 하락 감지:', {
        이전평균: previousAverage.toFixed(1),
        현재평균: recentAverage.toFixed(1),
        하락비율: (dropRatio * 100).toFixed(1) + '%'
      });
      rapidDropDetectedRef.current = true;
    }
    
    previousAudioLevelRef.current = currentLevel;
    return isRapidDrop;
  }, []);

  // 음성 인식 재시작 함수 (중앙 관리) - 개선된 버전
  const restartSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      console.log('🎤 음성 인식 재시작 실패: recognitionRef가 없음');
      return false;
    }

    if (!stateRef.current.isListening) {
      console.log('🎤 음성 인식 재시작 실패: isListening이 false');
      return false;
    }

    const currentState = recognitionRef.current.state;
    
    // inactive 또는 undefined 상태일 때 재시작 (브라우저 호환성 고려)
    if (currentState === 'inactive' || currentState === undefined) {
      try {
        recognitionRef.current.start();
        return true;
      } catch (error) {
        console.warn('🎤 음성 인식 재시작 실패:', error);
        return false;
      }
    } else if (currentState === 'active') {
      return true; // 이미 활성 상태면 성공으로 처리
    } else {
      return false;
    }
  }, []);

  // 집중 모드 상태 변화 감지 및 오디오 파이프라인 제어
  useEffect(() => {
    // 집중 모드가 종료되거나 일시정지된 경우
    if (!isFocusSessionRunning || isFocusSessionPaused) {
      // 음성 인식 중단
      if (recognitionRef.current && recognitionRef.current.state === 'active') {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          // 음성 인식 중단 오류는 무시
        }
      }
      
      // 오디오 레벨 체크 중단
      setIsListening(false)
      
      // 발화 버퍼 초기화
      speechBufferRef.current = ""
      speechStartTimeRef.current = null
      speechEndTimeRef.current = null
      silenceStartTimeRef.current = null
      
      // 오디오 레벨 기반 발화 감지 상태 초기화
      isAudioLevelSpeakingRef.current = false
      audioLevelSpeechStartRef.current = null
      audioLevelSpeechEndRef.current = null
      
      // 오디오 레벨 변화 감지 상태 초기화
      previousAudioLevelRef.current = 0
      audioLevelHistoryRef.current = []
      rapidDropDetectedRef.current = false
      
      // 실시간 텍스트 초기화
      setLiveTranscript("")
      setIsSpeaking(false)
    }
    
    // 집중 모드가 재시작된 경우
    else if (isFocusSessionRunning && !isFocusSessionPaused && isInitialized) {
      // 오디오 레벨 체크 재시작
      setIsListening(true)
      
      // 음성 인식 재시작 (중앙 함수 사용)
      restartSpeechRecognition();
    }
  }, [isFocusSessionRunning, isFocusSessionPaused, isInitialized, restartSpeechRecognition])



  // 오디오 파이프라인 초기화 함수 - 메모이제이션 적용
  const initializeAudioPipeline = useCallback(async () => {
    if (isInitialized || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // AudioContext 생성 및 실행 상태로 전환
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive' // 성능 최적화
      })
      audioContextRef.current = audioContext
      
      // AudioContext 상태 확인 및 복구
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      if (audioContext.state === 'closed') {
        throw new Error('AudioContext가 닫혀있습니다. 새로 생성합니다.');
      }
      
      // AudioContext 상태가 running인지 확인
      if (audioContext.state !== 'running') {
        await audioContext.resume();
      }

      // 마이크 권한 요청 및 스트림 생성 (한 번만)
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000
          }
        });
        streamRef.current = stream;
        
        // 오디오 트랙 이벤트 리스너 추가
        const audioTrack = stream.getAudioTracks()[0];
        audioTrack.onended = () => {};
        audioTrack.onmute = () => {};
        audioTrack.onunmute = () => {};
      }
      
      const stream = streamRef.current;

              // 마이크 트랙에서 실제 오디오 데이터 확인
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          // 오디오 트랙 이벤트 리스너 추가
          audioTrack.onended = () => {};
          audioTrack.onmute = () => {};
          audioTrack.onunmute = () => {};
        }

              // AudioWorklet 제거됨 (GPT 기반 발화분석으로 대체)
        try {
          if (audioContext.state !== 'running') {
            await audioContext.resume();
          }
          
          // AudioWorklet 제거됨 (GPT 기반 발화분석으로 대체)
          


          // Web Worker 제거됨 (GPT 기반 발화분석으로 대체)

        // 오디오 레벨 분석용 소스와 분석기 (한 번만 생성)
        const levelSource = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // 더 큰 FFT 크기로 변경
        analyser.smoothingTimeConstant = 0.1; // 더 빠른 반응
        analyser.minDecibels = -90; // 더 낮은 데시벨 임계값
        analyser.maxDecibels = -10; // 더 높은 데시벨 임계값
        levelSource.connect(analyser);

        // 오디오 레벨 체크 함수 (명확한 음성 감지 최적화)
        const checkAudioLevel = async () => {
          // AudioContext 상태 확인
          if (!audioContext || audioContext.state === 'closed') {
            return;
          }
          
          if (audioContext.state === 'suspended') {
            try {
              await audioContext.resume();
            } catch (error) {
              return;
            }
          }
          
          if (!stateRef.current.isListening) {
            return;
          }
          
          // 스트림 상태 확인
          if (!streamRef.current || !streamRef.current.active) {
            return;
          }
          
          const audioTrack = streamRef.current.getAudioTracks()[0];
          if (!audioTrack || !audioTrack.enabled || audioTrack.muted) {
            return;
          }
          
          // 오디오 레벨 분석 로직 - 재사용 가능한 분석기 사용
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          
          // 시간 도메인 데이터로도 오디오 레벨 계산 시도
          const timeDataArray = new Uint8Array(bufferLength);
          analyser.getByteTimeDomainData(timeDataArray);
          
          // RMS (Root Mean Square) 계산으로 오디오 레벨 측정
          let rms = 0;
          for (let i = 0; i < timeDataArray.length; i++) {
            const sample = (timeDataArray[i] - 128) / 128; // -1 to 1 범위로 정규화
            rms += sample * sample;
          }
          rms = Math.sqrt(rms / timeDataArray.length);
          const rmsLevel = rms * 100; // 0-100 범위로 변환
          
          // 주파수 도메인 데이터 분석 (더 민감하게)
          const freqAverage = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const freqMax = Math.max(...dataArray);
          const freqMin = Math.min(...dataArray);
          
          // 더 민감한 레벨 계산 (주파수 최대값과 RMS 중 더 높은 값 사용)
          const finalLevel = Math.max(freqMax * 0.5, rmsLevel * 2);
          
          // 디버깅: 실제 오디오 데이터가 있는지 확인
          const hasAudioData = freqMax > 0 || rms > 0.001;
          
          setCurrentAudioLevel(finalLevel);
          
          // 오디오 레벨 기반 발화 감지 (급격한 하락 감지 추가)
          const SPEECH_THRESHOLD = 40; // 말할 때 일반적으로 40 이상
          const SILENCE_THRESHOLD = 25; // 조용함 기준 (10-25 사이가 일반 상황)
          const SILENCE_DURATION = 800; // 0.8초 조용하면 발화 종료로 판단
          
          // 급격한 오디오 레벨 하락 감지
          const isRapidDrop = detectRapidAudioLevelDrop(finalLevel);
          
          // 발화 시작 감지 (오디오 레벨이 임계값을 넘을 때)
          if (finalLevel > SPEECH_THRESHOLD && !isAudioLevelSpeakingRef.current) {
            isAudioLevelSpeakingRef.current = true;
            audioLevelSpeechStartRef.current = Date.now();
            silenceStartTimeRef.current = null; // 조용함 타이머 리셋
            rapidDropDetectedRef.current = false; // 급격한 하락 플래그 리셋
            
            // 발화 시작 시점 집중도 저장
            saveSpeechStartFocusScore();
            
            console.log('🎤 오디오 레벨 기반 발화 시작 감지 (레벨:', finalLevel.toFixed(1), ')');
          }
          
          // 발화 종료 감지 (급격한 하락 또는 일정 시간 조용함)
          if ((isRapidDrop || finalLevel < SILENCE_THRESHOLD) && isAudioLevelSpeakingRef.current) {
            // 급격한 하락이 감지되면 즉시 발화 종료
            if (isRapidDrop) {
              isAudioLevelSpeakingRef.current = false;
              audioLevelSpeechEndRef.current = Date.now();
              
              // 실제 발화 지속시간 계산
              const actualSpeechDuration = audioLevelSpeechStartRef.current && audioLevelSpeechEndRef.current 
                ? (audioLevelSpeechEndRef.current - audioLevelSpeechStartRef.current) / 1000 
                : 0;
              
              console.log('🎤 급격한 하락으로 인한 발화 종료 감지:', {
                레벨: finalLevel.toFixed(1),
                실제발화시간: actualSpeechDuration.toFixed(1) + '초',
                하락감지: '즉시'
              });
              
              // 발화 분석 트리거 (실제 발화 시간이 0.5초 이상일 때만)
              if (speechBufferRef.current.trim() && actualSpeechDuration > 0.5) {
                console.log('🎤 급격한 하락 - 발화 분석 트리거 - 버퍼 내용:', speechBufferRef.current);
                processSpeechSegment();
              } else if (speechBufferRef.current.trim()) {
                console.log('🎤 급격한 하락 - 발화 시간이 너무 짧음 (', actualSpeechDuration.toFixed(1), '초) - 분석 건너뜀');
                speechBufferRef.current = ""; // 버퍼 초기화
              } else {
                console.log('🎤 급격한 하락 - 발화 버퍼가 비어있음 - 분석 건너뜀');
              }
              
              // 상태 리셋
              silenceStartTimeRef.current = null;
              audioLevelSpeechStartRef.current = null;
              audioLevelSpeechEndRef.current = null;
              rapidDropDetectedRef.current = false;
            } else {
              // 일반적인 조용함 감지 (기존 로직)
              if (!silenceStartTimeRef.current) {
                silenceStartTimeRef.current = Date.now();
              }
              
              const silenceDuration = Date.now() - silenceStartTimeRef.current;
              if (silenceDuration > SILENCE_DURATION) {
                isAudioLevelSpeakingRef.current = false;
                audioLevelSpeechEndRef.current = Date.now();
                
                const actualSpeechDuration = audioLevelSpeechStartRef.current && audioLevelSpeechEndRef.current 
                  ? (audioLevelSpeechEndRef.current - audioLevelSpeechStartRef.current) / 1000 
                  : 0;
                
                console.log('🎤 조용함 지속으로 인한 발화 종료 감지:', {
                  레벨: finalLevel.toFixed(1),
                  조용함지속: silenceDuration + 'ms',
                  실제발화시간: actualSpeechDuration.toFixed(1) + '초'
                });
                
                // 발화 분석 트리거 (실제 발화 시간이 0.5초 이상일 때만)
                if (speechBufferRef.current.trim() && actualSpeechDuration > 0.5) {
                  console.log('🎤 조용함 지속 - 발화 분석 트리거 - 버퍼 내용:', speechBufferRef.current);
                  processSpeechSegment();
                } else if (speechBufferRef.current.trim()) {
                  console.log('🎤 조용함 지속 - 발화 시간이 너무 짧음 (', actualSpeechDuration.toFixed(1), '초) - 분석 건너뜀');
                  speechBufferRef.current = ""; // 버퍼 초기화
                } else {
                  console.log('🎤 조용함 지속 - 발화 버퍼가 비어있음 - 분석 건너뜀');
                }
                
                // 타이머 리셋
                silenceStartTimeRef.current = null;
                audioLevelSpeechStartRef.current = null;
                audioLevelSpeechEndRef.current = null;
              }
            }
          } else if (finalLevel >= SILENCE_THRESHOLD && isAudioLevelSpeakingRef.current) {
            // 다시 소리가 나면 조용함 타이머 리셋
            silenceStartTimeRef.current = null;
          }
          
          // 기존 음성 감지 로직도 유지 (UI 표시용)
          if (finalLevel > 5 && !stateRef.current.isSpeaking) {
            setIsSpeaking(true);
            speechStartTimeRef.current = Date.now();
          } else if (finalLevel < 2 && stateRef.current.isSpeaking) {
            setIsSpeaking(false);
            speechEndTimeRef.current = Date.now();
          }
          
          requestAnimationFrame(() => checkAudioLevel());
        };

        // 오디오 레벨 모니터링 시작
        setIsListening(true); // 오디오 레벨 체크를 위해 true로 설정
        
        // 강제로 오디오 레벨 체크 시작
        setTimeout(() => {
          checkAudioLevel();
        }, 100);

        // Speech Recognition 설정
        setupSpeechRecognition();

        setIsInitialized(true);
        console.log('🎤 오디오 파이프라인 초기화 완료');
              } catch (error) {
        // AudioWorklet 제거됨 (GPT 기반 발화분석으로 대체)
        
        // 기본 오디오 레벨 체크 (명확한 음성 감지)
        // 오디오 레벨 분석용 소스와 분석기 (한 번만 생성)
        const source = audioContext.createMediaStreamSource(streamRef.current);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // 더 큰 FFT 크기로 변경
        analyser.smoothingTimeConstant = 0.1; // 더 빠른 반응
        analyser.minDecibels = -90; // 더 낮은 데시벨 임계값
        analyser.maxDecibels = -10; // 더 높은 데시벨 임계값
        source.connect(analyser);
         
         const checkAudioLevel = async () => {
           // AudioContext 상태 확인
           if (!audioContext || audioContext.state === 'closed') {
             return;
           }
           
           if (audioContext.state !== 'running') {
             return;
           }
           
           if (!stateRef.current.isListening) {
             return;
           }
           
           // 스트림 상태 확인
           if (!streamRef.current || !streamRef.current.active) {
             return;
           }
           
           const audioTrack = streamRef.current.getAudioTracks()[0];
           if (!audioTrack || !audioTrack.enabled || audioTrack.muted) {
             return;
           }
           
           // 오디오 레벨 분석 로직 - 재사용 가능한 분석기 사용
           const bufferLength = analyser.frequencyBinCount;
           const dataArray = new Uint8Array(bufferLength);
           analyser.getByteFrequencyData(dataArray);
           
           // 시간 도메인 데이터로도 오디오 레벨 계산 시도
           const timeDataArray = new Uint8Array(bufferLength);
           analyser.getByteTimeDomainData(timeDataArray);
           
           // RMS (Root Mean Square) 계산으로 오디오 레벨 측정
           let rms = 0;
           for (let i = 0; i < timeDataArray.length; i++) {
             const sample = (timeDataArray[i] - 128) / 128; // -1 to 1 범위로 정규화
             rms += sample * sample;
           }
           rms = Math.sqrt(rms / timeDataArray.length);
           const rmsLevel = rms * 100;
           
           // 주파수 도메인 데이터 분석 (더 민감하게)
           const freqAverage = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
           const freqMax = Math.max(...dataArray);
           const freqMin = Math.min(...dataArray);
           
           // 더 민감한 레벨 계산 (주파수 최대값과 RMS 중 더 높은 값 사용)
           const finalLevel = Math.max(freqMax * 0.5, rmsLevel * 2);
           
           // 디버깅: 실제 오디오 데이터가 있는지 확인
           const hasAudioData = freqMax > 0 || rms > 0.001;
           
           setCurrentAudioLevel(finalLevel);
           
           // 오디오 레벨 기반 발화 감지 (급격한 하락 감지 추가)
           const SPEECH_THRESHOLD = 40; // 말할 때 일반적으로 40 이상
           const SILENCE_THRESHOLD = 25; // 조용함 기준 (10-25 사이가 일반 상황)
           const SILENCE_DURATION = 800; // 0.8초 조용하면 발화 종료로 판단
           
           // 급격한 오디오 레벨 하락 감지
           const isRapidDrop = detectRapidAudioLevelDrop(finalLevel);
          
          // 발화 시작 감지 (오디오 레벨이 임계값을 넘을 때)
          if (finalLevel > SPEECH_THRESHOLD && !isAudioLevelSpeakingRef.current) {
            isAudioLevelSpeakingRef.current = true;
            audioLevelSpeechStartRef.current = Date.now();
            silenceStartTimeRef.current = null; // 조용함 타이머 리셋
            rapidDropDetectedRef.current = false; // 급격한 하락 플래그 리셋

          }
          
          // 발화 종료 감지 (급격한 하락 또는 일정 시간 조용함)
          if ((isRapidDrop || finalLevel < SILENCE_THRESHOLD) && isAudioLevelSpeakingRef.current) {
            // 급격한 하락이 감지되면 즉시 발화 종료
            if (isRapidDrop) {
              isAudioLevelSpeakingRef.current = false;
              audioLevelSpeechEndRef.current = Date.now();
              
              // 실제 발화 지속시간 계산
              const actualSpeechDuration = audioLevelSpeechStartRef.current && audioLevelSpeechEndRef.current 
                ? (audioLevelSpeechEndRef.current - audioLevelSpeechStartRef.current) / 1000 
                : 0;
              
                             // 발화 분석 트리거 (실제 발화 시간이 0.5초 이상일 때만)
               if (speechBufferRef.current.trim() && actualSpeechDuration > 0.5) {
                 processSpeechSegment();
               } else if (speechBufferRef.current.trim()) {
                 speechBufferRef.current = ""; // 버퍼 초기화
               }
               
               // 상태 리셋
               silenceStartTimeRef.current = null;
               audioLevelSpeechStartRef.current = null;
               audioLevelSpeechEndRef.current = null;
               rapidDropDetectedRef.current = false;
             } else {
               // 일반적인 조용함 감지 (기존 로직)
               if (!silenceStartTimeRef.current) {
                 silenceStartTimeRef.current = Date.now();
               }
               
               const silenceDuration = Date.now() - silenceStartTimeRef.current;
               if (silenceDuration > SILENCE_DURATION) {
                 isAudioLevelSpeakingRef.current = false;
                 audioLevelSpeechEndRef.current = Date.now();
                 
                 const actualSpeechDuration = audioLevelSpeechStartRef.current && audioLevelSpeechEndRef.current 
                   ? (audioLevelSpeechEndRef.current - audioLevelSpeechStartRef.current) / 1000 
                   : 0;
                 
                 // 발화 분석 트리거 (실제 발화 시간이 0.5초 이상일 때만)
                 if (speechBufferRef.current.trim() && actualSpeechDuration > 0.5) {
                   processSpeechSegment();
                 } else if (speechBufferRef.current.trim()) {
                   speechBufferRef.current = ""; // 버퍼 초기화
                 }
                 
                 // 타이머 리셋
                 silenceStartTimeRef.current = null;
                 audioLevelSpeechStartRef.current = null;
                 audioLevelSpeechEndRef.current = null;
               }
             }
           } else if (finalLevel >= SILENCE_THRESHOLD && isAudioLevelSpeakingRef.current) {
             // 다시 소리가 나면 조용함 타이머 리셋
             silenceStartTimeRef.current = null;
           }
           
           // 기존 음성 감지 로직도 유지 (UI 표시용)
           if (finalLevel > 5 && !stateRef.current.isSpeaking) {
             setIsSpeaking(true);
             speechStartTimeRef.current = Date.now();
           } else if (finalLevel < 2 && stateRef.current.isSpeaking) {
             setIsSpeaking(false);
             speechEndTimeRef.current = Date.now();
           }
           
           requestAnimationFrame(() => checkAudioLevel());
         };

        // 오디오 레벨 모니터링 시작
        setIsListening(true); // 오디오 레벨 체크를 위해 true로 설정
        
        // 강제로 기본 오디오 레벨 체크 시작
        setTimeout(() => {
          checkAudioLevel();
        }, 100);
        
        // 음성 인식 설정 및 시작
        setupSpeechRecognition();
        
        // 초기화 완료
        setIsInitialized(true);
        console.log('🎤 오디오 파이프라인 초기화 완료 - 음성 인식 상태:', {
          isListening: true,
          isInitialized: true,
          isFocusSessionRunning,
          isFocusSessionPaused
        });
      }
    } catch (error) {
      console.error('오디오 파이프라인 초기화 실패:', error);
      setError(error instanceof Error ? error.message : '초기화 실패');
    } finally {
      setIsInitializing(false);
    }
  }, [isInitialized, isInitializing]);

  // Speech Recognition 설정 - 메모이제이션 적용
  const setupSpeechRecognition = useCallback(() => {
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API를 지원하지 않습니다.");
      return;
    }

    // 기존 인스턴스가 있다면 정리
    if (recognitionRef.current) {
      try {
        // 상태 확인 후 안전하게 중단
        if (recognitionRef.current.state === 'active' || recognitionRef.current.state === 'starting') {
          recognitionRef.current.stop();
          console.log('🎤 기존 음성 인식 중단됨');
        }
      } catch (error) {
        console.log('🎤 기존 음성 인식 중단 중 오류:', error);
      }
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // 성능 최적화 설정
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let interimTranscript = '';

    recognition.onstart = () => { 
      setIsSpeechRecognitionActive(true);
      console.log('🎤 Speech Recognition 시작됨');
    };

    recognition.onresult = (event: any) => {
      console.log('🎤 Speech Recognition onresult 이벤트 발생:', {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length,
        hasResults: !!event.results
      });

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          // 첫 번째 finalTranscript 수신 시 시작 시간 기록
          if (speechStartTimeRef.current === null) {
            speechStartTimeRef.current = Date.now();
          }
        } else {
          interimTranscript += transcript;
        }
      }

      // 실시간 텍스트 업데이트 (디바운스 적용)
      setLiveTranscript(interimTranscript);
      
      if (finalTranscript) {
        speechBufferRef.current += finalTranscript;
      }
    };

    recognition.onend = () => {
      setIsSpeechRecognitionActive(false);
      speechEndTimeRef.current = Date.now();
      
      // 발화 세그먼트 처리 (오디오 레벨 기반 발화 감지에서만 처리하도록 변경)
      // 여기서는 처리하지 않고, 오디오 레벨 기반 발화 감지에서만 processSpeechSegment 호출
      
      // 자동 재시작 (중앙 함수 사용)
      const restartSuccess = restartSpeechRecognition();
      if (!restartSuccess) {
        // 재시작 실패 시 1초 후 재시도
        setTimeout(() => {
          restartSpeechRecognition();
        }, 1000);
      }
    };

    recognition.onerror = (event: any) => {
      // aborted는 정상적인 종료이므로 별도 처리
      if (event.error === 'aborted') {
        return;
      }

      // no-speech는 정상적인 상황
      if (event.error === 'no-speech') {
        return;
      }

      // 다른 오류들은 로그 출력
      console.error("[STT] recognition error:", event.error);
    };

          // 안전하게 시작 (상태 확인 후)
      try {
        recognition.start();
        setIsSpeechRecognitionActive(true);
      } catch (error) {
        console.warn('🎤 음성 인식 시작 실패:', error);
        setIsSpeechRecognitionActive(false);
      }
  }, []);

  // 발화 세그먼트 처리 - 성능 최적화 적용
  const processSpeechSegment = useCallback(async () => {
    console.log('🎤 processSpeechSegment 호출됨 - 현재 상태:', {
      isAnalyzing,
      bufferText: speechBufferRef.current,
      bufferLength: speechBufferRef.current.length
    });
    
    if (isAnalyzing) {
      console.log('🎤 이미 분석 중 - 건너뜀');
      return;
    }
    setIsAnalyzing(true);
    const text = speechBufferRef.current.trim();
    if (!text) { 
      console.log('🎤 버퍼가 비어있음 - 분석 건너뜀');
      setIsAnalyzing(false); 
      return; 
    }

    const startTime = performance.now();
    
    try {
      // 실제 발화 지속시간 계산 (오디오 레벨 기반)
      const actualSpeechDuration = audioLevelSpeechStartRef.current && audioLevelSpeechEndRef.current 
        ? (audioLevelSpeechEndRef.current - audioLevelSpeechStartRef.current) / 1000 
        : 0;
      
      // 기존 지속시간 계산 (백업용)
      const duration = speechStartTimeRef.current && speechEndTimeRef.current 
        ? (speechEndTimeRef.current - speechStartTimeRef.current) / 1000 
        : 0;

      // 타임스탬프 정보
      const startTimestamp = speechStartTimeRef.current ? new Date(speechStartTimeRef.current).toLocaleTimeString() : '알 수 없음';
      const endTimestamp = speechEndTimeRef.current ? new Date(speechEndTimeRef.current).toLocaleTimeString() : '알 수 없음';

      // GPT 발화분석 API 호출
      const gptResult = await analyzeSpeechWithGPT(text);

      // 문맥 분석
      const context = analyzeTextContext(text);
      const contextualWeight = getContextualWeight(context);
      const contextLabel = getContextLabel(context);

      // 최종 판정 (문맥 가중치 적용)
      const finalJudgment = gptResult.isStudyRelated && contextualWeight > 0.3;

      const processingTime = performance.now() - startTime;

      // 구조화된 분석 결과 출력
      console.log(`
🎤 발화 분석 결과 (${new Date().toLocaleTimeString()}):
├─ 시작 시간: ${startTimestamp}
├─ 종료 시간: ${endTimestamp}
├─ 실제 발화 시간: ${actualSpeechDuration.toFixed(1)}초
├─ 전체 분석 시간: ${duration.toFixed(1)}초
├─ 원문: "${text}"
├─ 분석 방법: GPT
├─ GPT 신뢰도: ${gptResult.confidence.toFixed(3)}
├─ 공부 관련: ${gptResult.isStudyRelated ? '✅' : '❌'}
├─ 문맥: ${contextLabel} (가중치: ${contextualWeight.toFixed(2)})
├─ 최종 판정: ${finalJudgment ? '공부 관련 발화' : '잡담'}
└─ 처리 시간: ${processingTime.toFixed(1)}ms
      `);

      // 버퍼 초기화 (분석 완료 후 즉시)
      speechBufferRef.current = "";
      speechStartTimeRef.current = null;
      speechEndTimeRef.current = null;
      
      // 오디오 레벨 기반 발화 감지 상태도 초기화
      isAudioLevelSpeakingRef.current = false;
      audioLevelSpeechStartRef.current = null;
      audioLevelSpeechEndRef.current = null;
      
      // 발화 분석 결과를 상태에 저장
      setLastSpeechAnalysis({
        isStudyRelated: gptResult.isStudyRelated,
        confidence: gptResult.confidence,
        reasoning: gptResult.reasoning,
        timestamp: Date.now(),
        shouldOverrideFocus: finalJudgment // 발화 분석 결과를 집중도 덮어쓰기 로직에 사용
      });

      // 공부 관련 발화가 감지된 경우 집중도 덮어쓰기 실행
      if (finalJudgment) {
        console.log('🎤 공부 관련 발화 감지 - 집중도 덮어쓰기 실행');
        await overrideFocusScoresDuringSpeech();
      }

      console.log('🎤 발화 분석 완료 - 버퍼 및 상태 초기화됨');

    } catch (error) {
      console.error('발화 분석 실패:', error);
      speechBufferRef.current = "";
    } finally {
      setIsAnalyzing(false);
      // 발화 분석 완료 후 음성 인식 상태 확인 및 재시작 보장
      console.log('🎤 발화 분석 완료 - 음성 인식 상태:', {
        hasRecognition: !!recognitionRef.current,
        recognitionState: recognitionRef.current?.state,
        isFocusSessionRunning,
        isFocusSessionPaused,
        isListening: stateRef.current.isListening
      });
      
      // 발화 분석 완료 후 음성 인식 재시작 보장
      if (isFocusSessionRunning && !isFocusSessionPaused) {
        setTimeout(() => {
          console.log('🎤 발화 분석 완료 후 음성 인식 재시작 보장');
          restartSpeechRecognition();
        }, 500);
      }
    }
  }, [isAnalyzing, restartSpeechRecognition]);

  // GPT 발화분석 API 호출 함수
  const analyzeSpeechWithGPT = async (transcript: string): Promise<{ isStudyRelated: boolean; confidence: number; reasoning: string }> => {
    try {
      const response = await fetch('/api/classify-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error(`GPT API 호출 실패: ${response.status}`);
      }

      const result = await response.json();
      return {
        isStudyRelated: result.isStudyRelated,
        confidence: result.confidence || 0.8,
        reasoning: result.reasoning || 'GPT 분석 결과'
      };
    } catch (error) {
      console.error('GPT 발화분석 오류:', error);
      // GPT API 실패 시 기존 키워드 기반 분석으로 폴백
      return {
        isStudyRelated: analyzeStudyRelatedByKeywords(transcript),
        confidence: 0.5,
        reasoning: '키워드 기반 분석 (GPT API 실패)'
      };
    }
  };

  // 텍스트 문맥을 분석하는 헬퍼 함수
  const analyzeTextContext = (text: string):
    | 'discussion'
    | 'class'
    | 'presentation'
    | 'question'
    | 'frustration'
    | 'statement'
    | 'unknown' => {
    const lower = text.toLowerCase();

    // 토론 상황
    if (
      lower.includes("토론") ||
      lower.includes("찬성") ||
      lower.includes("반대") ||
      lower.includes("의견") ||
      lower.includes("생각은")
    ) {
      return 'discussion';
    }
    // 수업 상황
    if (
      lower.includes("선생님") ||
      lower.includes("교과서") ||
      lower.includes("문제") ||
      lower.includes("설명") ||
      lower.includes("수업")
    ) {
      return 'class';
    }
    // 발표 상황
    if (
      lower.includes("발표") ||
      lower.includes("결론") ||
      lower.includes("요약") ||
      lower.includes("정리")
    ) {
      return 'presentation';
    }
    // 질문
    if (
      lower.includes("어떻게") ||
      lower.includes("왜") ||
      lower.includes("뭐야") ||
      lower.includes("무엇") ||
      lower.includes("궁금") ||
      text.endsWith("?")
    ) {
      return 'question';
    }
    // 좌절
    if (
      lower.includes("안돼") ||
      lower.includes("짜증나") ||
      lower.includes("아오")
    ) {
      return 'frustration';
    }
    // 진술
    if (text.length > 5) {
      return 'statement';
    }
    return 'unknown';
  };

  // 문맥에 따른 가중치를 반환하는 헬퍼 함수
  const getContextualWeight = (
    context:
      | 'discussion'
      | 'class'
      | 'presentation'
      | 'question'
      | 'frustration'
      | 'statement'
      | 'unknown'
  ): number => {
    switch (context) {
      case 'discussion': return 0.95; // 토론: 집중도 약간 높음
      case 'class': return 1.0; // 수업: 집중도 최상
      case 'presentation': return 0.9; // 발표: 집중도 높음
      case 'question': return 0.8; // 질문: 막혔을 가능성, 집중도 약간 감소
      case 'frustration': return 0.5; // 좌절: 명확한 집중력 저하 신호, 집중도 크게 감소
      case 'statement': return 1.0; // 혼잣말/내용 읽기: 학습 활동의 일부로 판단, 가중치 없음
      default: return 0.9; // 불명확: 짧은 중얼거림 등, 약간의 방해로 간주
    }
  };

  // 문맥 유형을 한글로 변환하는 헬퍼 함수
  const getContextLabel = (
    context:
      | 'discussion'
      | 'class'
      | 'presentation'
      | 'question'
      | 'frustration'
      | 'statement'
      | 'unknown'
  ): string => {
    switch (context) {
      case 'discussion': return '토론';
      case 'class': return '수업';
      case 'presentation': return '발표';
      case 'question': return '질문';
      case 'frustration': return '좌절';
      case 'statement': return '진술';
      default: return '불명확';
    }
  };

  // 발화 분석 결과를 저장하는 상태
  const [lastSpeechAnalysis, setLastSpeechAnalysis] = useState<{
    isStudyRelated: boolean;
    confidence: number;
    reasoning: string;
    timestamp: number;
    shouldOverrideFocus: boolean;
  } | null>(null);

  // 발화 시작 시점의 집중도 저장
  const [speechStartFocusScore, setSpeechStartFocusScore] = useState<number | null>(null);
  const [speechStartTime, setSpeechStartTime] = useState<number | null>(null);

  // 발화 시점 집중도 덮어쓰기 로직
  const shouldOverrideFocusScore = useCallback((currentFocusScore: number): boolean => {
    if (!lastSpeechAnalysis || !speechStartFocusScore || !speechStartTime) return false;
    
    // 최근 5초 내 발화 분석 결과가 있고, 학습 관련 발화인 경우
    const timeSinceSpeech = Date.now() - lastSpeechAnalysis.timestamp;
    const isRecentSpeech = timeSinceSpeech < 5000; // 5초 내
    
    return isRecentSpeech && 
           lastSpeechAnalysis.isStudyRelated && 
           lastSpeechAnalysis.confidence > 0.7;
  }, [lastSpeechAnalysis, speechStartFocusScore, speechStartTime]);

  // 집중도 점수 계산 시 발화 분석 결과 반영
  const calculateAdjustedFocusScore = useCallback((baseFocusScore: number): number => {
    if (shouldOverrideFocusScore(baseFocusScore)) {
      // 학습 관련 발화가 감지된 경우, 발화 시작 직전 집중도로 덮어쓰기
      console.log(`🎤 발화 분석 기반 집중도 덮어쓰기: ${baseFocusScore} → ${speechStartFocusScore}`);
      return speechStartFocusScore!;
    }
    return baseFocusScore;
  }, [shouldOverrideFocusScore, speechStartFocusScore]);

  // 발화 시작 시점 집중도 저장
  const saveSpeechStartFocusScore = useCallback(() => {
    if (focusScore !== undefined) {
      setSpeechStartFocusScore(focusScore);
      setSpeechStartTime(Date.now());
      console.log(`🎤 발화 시작 시점 집중도 저장: ${focusScore}점`);
    }
  }, [focusScore]);

  // 발화 분석 후 집중도 덮어쓰기 및 DB 저장
  const overrideFocusScoresDuringSpeech = useCallback(async () => {
    if (!lastSpeechAnalysis?.isStudyRelated || !speechStartFocusScore || !speechStartTime) {
      return;
    }

    try {
      // 발화 시작 시점부터 현재까지의 집중도 값을 발화 시작 직전 값으로 덮어쓰기
      const speechDuration = Date.now() - speechStartTime;
      const overrideData = {
        startTime: speechStartTime,
        endTime: Date.now(),
        duration: speechDuration,
        originalFocusScore: focusScore,
        overrideFocusScore: speechStartFocusScore,
        reason: `공부 관련 발화 감지: ${lastSpeechAnalysis.reasoning}`,
        confidence: lastSpeechAnalysis.confidence
      };

      console.log('🎤 집중도 덮어쓰기 데이터:', overrideData);

      // DB에 집중도 덮어쓰기 정보 저장 (API 호출)
      const response = await fetch('/api/focus-session/override-focus-scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(overrideData),
      });

      if (response.ok) {
        console.log('✅ 집중도 덮어쓰기 DB 저장 완료');
        // 집중도 점수 즉시 업데이트
        updateFocusScore(speechStartFocusScore);
      } else {
        console.error('❌ 집중도 덮어쓰기 DB 저장 실패:', response.status);
      }
    } catch (error) {
      console.error('❌ 집중도 덮어쓰기 처리 중 오류:', error);
    }
  }, [lastSpeechAnalysis, speechStartFocusScore, speechStartTime, focusScore, updateFocusScore]);

  useEffect(() => {
    // Speech Recognition 설정만 먼저 수행 (한 번만)
    if (!recognitionRef.current) {
      setupSpeechRecognition();
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (error) {
          console.log('🎤 Speech Recognition 정리 중 오류:', error);
        }
      }
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      // AudioContext는 닫지 않음 (오디오 레벨 체크를 위해 유지)
      // Web Worker 제거됨 (GPT 기반 발화분석으로 대체)
    }
  }, [setupSpeechRecognition])

  // 컴포넌트 마운트 시 오디오 파이프라인 초기화
  useEffect(() => {
    const initializeComponents = async () => {
      // 오디오 파이프라인 초기화
      if (!isInitialized && !isInitializing) {
        initializeAudioPipeline()
      }
    };
    
    initializeComponents();
  }, [isInitialized, isInitializing, initializeAudioPipeline])



  return (
    <div className="p-4 bg-slate-100 rounded-lg">
      <h3 className="font-bold">하이브리드 오디오 파이프라인</h3>
      
      {isInitializing && (
        <p className="text-blue-600 mb-4">🎤 오디오 파이프라인 초기화 중...</p>
      )}
      
      {error && (
        <p className="text-red-600 mb-4">오류: {error}</p>
      )}
      



      
      {isInitialized && (
        <div className="space-y-3 p-3 bg-white rounded border">
          <h4 className="font-semibold text-sm">🎤 오디오 파이프라인 상태</h4>
          
          {/* 음성 감지 상태 */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">
              {isSpeaking ? "🎤 말하는 중..." : "🔇 조용함"}
            </span>
          </div>
          
          {/* 오디오 레벨 기반 발화 상태 */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isAudioLevelSpeakingRef.current ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">
              {isAudioLevelSpeakingRef.current ? "🔊 실제 발화 감지" : "🔇 발화 없음"}
            </span>
          </div>
          
          {/* 오디오 레벨 표시 */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>오디오 레벨</span>
              <span>{currentAudioLevel.toFixed(1)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-200 ${
                  currentAudioLevel > 25 ? 'bg-red-500' : 
                  currentAudioLevel > 15 ? 'bg-yellow-500' : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(currentAudioLevel * 2, 100)}%` }}
              ></div>
            </div>
          </div>
          
          {/* 시스템 상태 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-600">음성 인식:</span>
              <span className={`ml-1 ${isSpeechRecognitionActive ? 'text-green-600' : 'text-gray-400'}`}>
                {isSpeechRecognitionActive ? '활성' : '대기'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">오디오 모니터링:</span>
              <span className={`ml-1 ${isListening ? 'text-green-600' : 'text-gray-400'}`}>
                {isListening ? '활성' : '비활성'}
              </span>
            </div>
          </div>
          
          {/* 실시간 텍스트 */}
          {liveTranscript && (
            <div className="p-2 bg-blue-50 rounded text-xs">
              <span className="text-gray-600">인식된 텍스트:</span>
              <p className="mt-1 text-gray-800">{liveTranscript}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
