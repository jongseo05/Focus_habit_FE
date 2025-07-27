"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { koelectraPreprocess, testTokenizer, initializeTokenizer } from "@/lib/tokenizer/koelectra"
import { useKoELECTRA } from "@/hooks/useKoELECTRA"
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
  const { isRunning: isFocusSessionRunning, isPaused: isFocusSessionPaused } = useDashboardStore()
  
  // KoELECTRA 모델 훅
  const { 
    isLoaded: isModelLoaded, 
    isLoading: isModelLoading, 
    error: modelError, 
    inference: koelectraInference
  } = useKoELECTRA({ 
    autoLoad: true
  })

  // 오디오 파이프라인 Ref
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const workerRef = useRef<Worker | null>(null)

  // --- 상태 관리 ---
  const recognitionRef = useRef<SpeechRecognitionType | null>(null)
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false) // 음성 구간 감지 상태
  const [isListening, setIsListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState("") // 실시간으로 표시될 텍스트
  const [isInitialized, setIsInitialized] = useState(false) // 오디오 파이프라인 초기화 상태
  const [isInitializing, setIsInitializing] = useState(false) // 초기화 진행 중 상태
  const [error, setError] = useState<string | null>(null) // 오류 상태
  const speechBufferRef = useRef<string>("") // 한 발화가 끝날 때까지 텍스트를 모으는 버퍼
  const featureBufferRef = useRef<any[]>([]) // 한 발화 동안의 오디오 특징을 모으는 버퍼
  
  // 타임스탬프 관리
  const speechStartTimeRef = useRef<number | null>(null)
  const speechEndTimeRef = useRef<number | null>(null)

  // 성능 최적화를 위한 디바운스된 텍스트
  const debouncedLiveTranscript = useDebounce(liveTranscript, 100)

  // useEffect 클로저에서 최신 상태를 참조하기 위한 Ref
  const stateRef = useRef({ isSpeaking, isListening });
  stateRef.current = { isSpeaking, isListening };

  // 집중 모드 상태 변화 감지 및 오디오 파이프라인 제어
  useEffect(() => {
    console.log('🎯 집중 모드 상태 변화:', { 
      isRunning: isFocusSessionRunning, 
      isPaused: isFocusSessionPaused 
    })

    // 집중 모드가 종료되거나 일시정지된 경우
    if (!isFocusSessionRunning || isFocusSessionPaused) {
      console.log('⏸️ 집중 모드 일시정지/종료 - 오디오 파이프라인 중단')
      
      // 음성 인식 중단
      if (recognitionRef.current && recognitionRef.current.state === 'active') {
        try {
          recognitionRef.current.stop()
          console.log('🎤 음성 인식 중단됨')
        } catch (error) {
          console.log('🎤 음성 인식 중단 중 오류:', error)
        }
      }
      
      // 오디오 레벨 체크 중단
      setIsListening(false)
      console.log('🔇 오디오 레벨 체크 중단됨')
      
      // 발화 버퍼 초기화
      speechBufferRef.current = ""
      speechStartTimeRef.current = null
      speechEndTimeRef.current = null
      
      // 실시간 텍스트 초기화
      setLiveTranscript("")
      setIsSpeaking(false)
      
      console.log('✅ 오디오 파이프라인 일시정지 완료')
    }
    
    // 집중 모드가 재시작된 경우
    else if (isFocusSessionRunning && !isFocusSessionPaused && isInitialized) {
      console.log('▶️ 집중 모드 재시작 - 오디오 파이프라인 재시작')
      
      // 오디오 레벨 체크 재시작
      setIsListening(true)
      console.log('🔊 오디오 레벨 체크 재시작됨')
      
      // 음성 인식 재시작
      if (recognitionRef.current && recognitionRef.current.state === 'inactive') {
        try {
          recognitionRef.current.start()
          console.log('🎤 음성 인식 재시작됨')
        } catch (error) {
          console.log('🎤 음성 인식 재시작 중 오류:', error)
        }
      }
      
      console.log('✅ 오디오 파이프라인 재시작 완료')
    }
  }, [isFocusSessionRunning, isFocusSessionPaused, isInitialized])

  // 모델 상태 요약
  const modelStatus = useMemo(() => ({
    status: isModelLoaded ? '✅ 로드됨' : isModelLoading ? '🔄 로딩 중' : '❌ 로드 안됨'
  }), [isModelLoaded, isModelLoading])

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
      console.log('🎵 AudioContext 초기 상태:', audioContext.state);
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
        console.log('🎵 AudioContext resumed:', audioContext.state);
      }
      
      if (audioContext.state === 'closed') {
        throw new Error('AudioContext가 닫혀있습니다. 새로 생성합니다.');
      }
      
      // AudioContext 상태가 running인지 확인
      if (audioContext.state !== 'running') {
        console.warn('⚠️ AudioContext가 running 상태가 아닙니다:', audioContext.state);
        await audioContext.resume();
        console.log('🎵 AudioContext 강제 resume 후 상태:', audioContext.state);
      }

      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          sampleRate: 16000, 
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
      })

              // AudioWorklet 모듈 로드 시도 (AudioContext 상태 확인 후)
        try {
          if (audioContext.state !== 'running') {
            await audioContext.resume();
          }
          
          await audioContext.audioWorklet.addModule("/audio/stft-mel-processor.js")
          const workletNode = new AudioWorkletNode(audioContext, "stft-mel-processor", {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            processorOptions: {
              sampleRate: 16000,
              frameSize: 1024,
              hopSize: 512
            }
          })
          workletNodeRef.current = workletNode

          const source = audioContext.createMediaStreamSource(stream)
          source.connect(workletNode)

        // Web Worker 생성 (성능 최적화)
        const createWorker = () => {
          if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
            try {
              return new Worker("/audio/ml-inference-worker.js");
            } catch (error) {
              console.warn("Worker 생성 실패:", error);
              return null;
            }
          }
          return null;
        };

        const worker = createWorker();
        workerRef.current = worker;

        // 오디오 레벨 체크 함수 (명확한 음성 감지 최적화)
        const checkAudioLevel = async () => {
          console.log('🎤 오디오 레벨 체크 함수 호출됨');
          
          // AudioContext 상태 확인 (더 관대하게)
          if (!audioContext) {
            console.error('❌ AudioContext가 없습니다. 오디오 레벨 체크 중단');
            return;
          }
          
          console.log('🎵 AudioContext 상태:', audioContext.state);
          
          if (audioContext.state === 'closed') {
            console.error('❌ AudioContext가 닫혀있습니다. 오디오 레벨 체크 중단');
            return;
          }
          
          // suspended 상태면 resume 시도
          if (audioContext.state === 'suspended') {
            try {
              await audioContext.resume();
              console.log('🎵 AudioContext resumed from suspended');
            } catch (error) {
              console.warn('⚠️ AudioContext resume 실패:', error);
              return;
            }
          }
          
          // 디버깅: 오디오 레벨 체크 실행 확인
          console.log('🔍 오디오 레벨 체크 실행 중... (isListening:', stateRef.current.isListening, ')');
          
          if (!stateRef.current.isListening) {
            console.log('🔇 isListening이 false - 오디오 레벨 체크 중단');
            return;
          }
          
          // 오디오 레벨 분석 로직
          console.log('🎤 오디오 분석 시작...');
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 512; // 더 정밀한 분석
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          source.connect(analyser);
          analyser.getByteFrequencyData(dataArray);
          console.log('🎤 오디오 데이터 수집 완료 (버퍼 길이:', bufferLength, ')');
          
          // 평균 레벨 계산 (음성 필터링)
          const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
          
          // 디버깅: 오디오 레벨 값 출력 (더 자주)
          if (Math.random() < 0.3) { // 30% 확률로 로깅
            console.log('📊 현재 오디오 레벨:', average.toFixed(1));
          }
          
          // 음성 감지 (적절한 임계값)
          if (average > 25 && !stateRef.current.isSpeaking) {
            setIsSpeaking(true);
            speechStartTimeRef.current = Date.now();
            console.log('🎤 음성 감지됨 (레벨:', average.toFixed(1), ')');
          } else if (average < 15 && stateRef.current.isSpeaking) {
            // 발화 종료 감지 (조용해지면 즉시 종료)
            setIsSpeaking(false);
            speechEndTimeRef.current = Date.now();
            console.log('🎤 음성 종료 감지됨 (레벨:', average.toFixed(1), ')');
          }
          
          // 조용한 상태에서 음성 인식 일시 중단 (배경 소음 방지)
          if (average < 10 && recognitionRef.current && recognitionRef.current.state === 'active') {
            try {
              recognitionRef.current.stop();
              console.log('🔇 조용한 상태 - 음성 인식 일시 중단 (레벨:', average.toFixed(1), ')');
            } catch (error) {
              console.log('음성 인식 중단 중...');
            }
          }
          
          requestAnimationFrame(() => checkAudioLevel());
        };

        // 오디오 레벨 모니터링 시작
        setIsListening(true); // 오디오 레벨 체크를 위해 true로 설정
        console.log('🎤 오디오 레벨 모니터링 시작됨');
        
        // 강제로 오디오 레벨 체크 시작
        setTimeout(() => {
          console.log('🎤 오디오 레벨 체크 강제 시작');
          checkAudioLevel();
        }, 100);

        // Speech Recognition 설정
        setupSpeechRecognition();

        setIsInitialized(true);
        console.log('🎤 오디오 파이프라인 초기화 완료 (성능 최적화 적용)');
      } catch (workletError) {
        console.warn("AudioWorklet 로드 실패, 기본 오디오 처리로 대체:", workletError);
        
                 // 기본 오디오 레벨 체크 (명확한 음성 감지)
         const source = audioContext.createMediaStreamSource(stream);
         const checkAudioLevel = async () => {
           // AudioContext 상태 확인
           if (!audioContext || audioContext.state === 'closed') {
             console.error('❌ AudioContext가 닫혀있습니다. 기본 오디오 레벨 체크 중단');
             return;
           }
           
           if (audioContext.state !== 'running') {
             console.warn('⚠️ AudioContext가 running 상태가 아닙니다:', audioContext.state);
             return;
           }
           
           // 디버깅: 기본 오디오 레벨 체크 실행 확인
           console.log('🔍 기본 오디오 레벨 체크 실행 중... (isListening:', stateRef.current.isListening, ')');
           
           if (!stateRef.current.isListening) {
             console.log('🔇 isListening이 false - 기본 오디오 레벨 체크 중단');
             return;
           }
           
           const analyser = audioContext.createAnalyser();
           analyser.fftSize = 512; // 더 정밀한 분석
           const bufferLength = analyser.frequencyBinCount;
           const dataArray = new Uint8Array(bufferLength);
           
                     source.connect(analyser);
          analyser.getByteFrequencyData(dataArray);
          
          const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
          
          // 디버깅: 기본 오디오 레벨 값 출력 (더 자주)
          if (Math.random() < 0.3) { // 30% 확률로 로깅
            console.log('📊 현재 기본 오디오 레벨:', average.toFixed(1));
          }
          
          // 음성 감지 (적절한 임계값)
          if (average > 25 && !stateRef.current.isSpeaking) {
            setIsSpeaking(true);
            speechStartTimeRef.current = Date.now();
            console.log('🎤 음성 감지됨 (레벨:', average.toFixed(1), ')');
          } else if (average < 15 && stateRef.current.isSpeaking) {
            // 발화 종료 감지 (조용해지면 즉시 종료)
            setIsSpeaking(false);
            speechEndTimeRef.current = Date.now();
            console.log('🎤 음성 종료 감지됨 (레벨:', average.toFixed(1), ')');
          }
          
          requestAnimationFrame(() => checkAudioLevel());
        };

        setIsListening(true); // 기본 오디오 레벨 체크를 위해 true로 설정
        console.log('🎤 기본 오디오 레벨 모니터링 시작됨');
        
        // 강제로 기본 오디오 레벨 체크 시작
        setTimeout(() => {
          console.log('🎤 기본 오디오 레벨 체크 강제 시작');
          checkAudioLevel();
        }, 100);
        setupSpeechRecognition();
        setIsInitialized(true);
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

    // 이미 실행 중인 경우 중단
    if (recognitionRef.current && stateRef.current.isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.log('기존 음성 인식 중단 중...');
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
      setIsListening(true);
      console.log('🎤 음성 인식 시작됨');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          // 첫 번째 finalTranscript 수신 시 시작 시간 기록
          if (speechStartTimeRef.current === null) {
            speechStartTimeRef.current = Date.now();
            console.log('🎤 발화 시작 시간 기록:', new Date().toLocaleTimeString());
          }
        } else {
          interimTranscript += transcript;
        }
      }

      // 실시간 텍스트 업데이트 (디바운스 적용)
      setLiveTranscript(interimTranscript);
      
      if (finalTranscript) {
        speechBufferRef.current += finalTranscript;
        console.log('🎤 최종 텍스트 추가됨:', finalTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      speechEndTimeRef.current = Date.now();
      console.log('🎤 음성 인식 종료됨 - 발화 분석 시작');
      
      // 발화 세그먼트 처리 (강제 실행)
      if (speechBufferRef.current.trim()) {
        console.log('🎤 발화 버퍼 내용:', speechBufferRef.current);
        processSpeechSegment();
      } else {
        console.log('🎤 발화 버퍼가 비어있음 - 분석 건너뜀');
      }
      
      // 즉시 재시작 (연속 인식을 위해) - 상태 체크 강화
      if (recognitionRef.current && stateRef.current.isListening) {
        try {
          // 상태 확인 후 재시작
          if (recognitionRef.current.state === 'inactive') {
            recognitionRef.current.start();
            setIsListening(true);
            console.log('🎤 음성 인식 재시작됨');
          } else {
            console.log('🎤 음성 인식이 이미 활성 상태입니다 (상태:', recognitionRef.current.state, ')');
          }
        } catch (error) {
          console.warn('음성 인식 재시작 실패:', error);
          // 재시작 실패 시 200ms 후 재시도
          setTimeout(() => {
            if (recognitionRef.current && stateRef.current.isListening) {
              try {
                if (recognitionRef.current.state === 'inactive') {
                  recognitionRef.current.start();
                  setIsListening(true);
                  console.log('🎤 음성 인식 재시작 재시도 성공');
                }
              } catch (retryError) {
                console.error('음성 인식 재시작 재시도 실패:', retryError);
              }
            }
          }, 200);
        }
      }
    };

    recognition.onerror = (event: any) => {
      // aborted는 정상적인 종료이므로 별도 처리
      if (event.error === 'aborted') {
        console.log('🎤 음성 인식 정상 종료됨');
        return;
      }

      // no-speech는 정상적인 상황
      if (event.error === 'no-speech') {
        console.log('🎤 음성 없음 - 정상적인 상황');
        return;
      }

      // 다른 오류들은 로그 출력
      console.error("[STT] recognition error:", event.error);
    };

    // 안전하게 시작
    try {
      recognition.start();
    } catch (error) {
      console.warn('음성 인식 시작 실패:', error);
    }
  }, []);

  // 발화 세그먼트 처리 - 성능 최적화 적용
  const processSpeechSegment = useCallback(async () => {
    const text = speechBufferRef.current.trim();
    if (!text) return;

    const startTime = performance.now();
    
    try {
      // 발화 지속시간 계산
      const duration = speechStartTimeRef.current && speechEndTimeRef.current 
        ? (speechEndTimeRef.current - speechStartTimeRef.current) / 1000 
        : 0;

      // KoELECTRA 모델 추론 (우선순위)
      let isStudyRelated = false;
      let koelectraConfidence = 0;
      let analysisMethod = '키워드';

      if (isModelLoaded) {
        try {
          const result = await koelectraInference(text);
          if (result && result.confidence >= 0.6) {
            isStudyRelated = result.logits[1] > result.logits[0]; // 공부 관련 클래스가 더 높은 경우
            koelectraConfidence = result.confidence;
            analysisMethod = 'KoELECTRA';
          } else {
            // 신뢰도가 낮으면 키워드 기반으로 대체
            isStudyRelated = analyzeStudyRelatedByKeywords(text);
          }
        } catch (error) {
          console.warn('KoELECTRA 추론 실패, 키워드 기반으로 대체:', error);
          isStudyRelated = analyzeStudyRelatedByKeywords(text);
        }
      } else {
        // 모델이 로드되지 않은 경우 키워드 기반
        isStudyRelated = analyzeStudyRelatedByKeywords(text);
      }

      // 문맥 분석
      const context = analyzeTextContext(text);
      const contextualWeight = getContextualWeight(context);
      const contextLabel = getContextLabel(context);

      // 최종 판정 (문맥 가중치 적용)
      const finalJudgment = isStudyRelated && contextualWeight > 0.3;

      const processingTime = performance.now() - startTime;

      // 구조화된 분석 결과 출력
      console.log(`
🎤 발화 분석 결과 (${new Date().toLocaleTimeString()}):
├─ 시간: ${new Date().toLocaleString()}
├─ 지속시간: ${duration.toFixed(1)}초
├─ 원문: "${text}"
├─ 분석 방법: ${analysisMethod}
├─ KoELECTRA 신뢰도: ${koelectraConfidence.toFixed(3)}
├─ 공부 관련: ${isStudyRelated ? '✅' : '❌'}
├─ 문맥: ${contextLabel} (가중치: ${contextualWeight.toFixed(2)})
├─ 최종 판정: ${finalJudgment ? '공부 관련 발화' : '잡담'}
└─ 처리 시간: ${processingTime.toFixed(1)}ms
      `);

      // 버퍼 초기화
      speechBufferRef.current = "";
      speechStartTimeRef.current = null;
      speechEndTimeRef.current = null;

    } catch (error) {
      console.error('발화 분석 실패:', error);
      speechBufferRef.current = "";
    }
  }, [isModelLoaded, koelectraInference]);

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

  useEffect(() => {
    // Speech Recognition 설정만 먼저 수행
    setupSpeechRecognition();

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      // AudioContext는 닫지 않음 (오디오 레벨 체크를 위해 유지)
      if (workerRef.current) workerRef.current.terminate()
    }
  }, [])

  // 컴포넌트 마운트 시 토크나이저 및 오디오 파이프라인 초기화
  useEffect(() => {
    const initializeComponents = async () => {
      // 1. 토크나이저 초기화 (우선순위)
      try {
        console.log('📚 토크나이저 초기화 시작...');
        await initializeTokenizer();
        console.log('✅ 토크나이저 초기화 완료');
      } catch (error) {
        console.error('❌ 토크나이저 초기화 실패:', error);
      }
      
      // 2. 오디오 파이프라인 초기화 (토크나이저 로드 후)
      setTimeout(() => {
        if (!isInitialized && !isInitializing) {
          console.log('🎤 오디오 파이프라인 자동 초기화 시작')
          initializeAudioPipeline()
        }
      }, 500); // 토크나이저 로드 완료 후 500ms 대기
    };
    
    initializeComponents();
  }, [isInitialized, isInitializing, initializeAudioPipeline])

  // 토크나이저 테스트 함수
  const handleTokenizerTest = async () => {
    const testTexts = [
      "안녕하세요",
      "공부를 하고 있어요",
      "수학 문제를 풀고 있습니다",
      "이론을 공부하고 있어요",
      "토론을 하고 있어요",
      "선생님이 설명해주세요",
      "어떻게 풀어야 할까요?",
      "짜증나요 이 문제가 안 풀려요"
    ];
    
    await testTokenizer(testTexts);
  };

  return (
    <div className="p-4 bg-slate-100 rounded-lg">
      <h3 className="font-bold">하이브리드 오디오 파이프라인</h3>
      
      {/* 토크나이저 테스트 버튼 */}
      <div className="mb-4">
        <button 
          onClick={handleTokenizerTest}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mr-2"
        >
          토크나이저 테스트
        </button>
        <span className="text-sm text-gray-600">새로운 WordPiece 토크나이저를 테스트합니다</span>
      </div>
      
      {isInitializing && (
        <p className="text-blue-600 mb-4">🎤 오디오 파이프라인 초기화 중...</p>
      )}
      
      {error && (
        <p className="text-red-600 mb-4">오류: {error}</p>
      )}
      
      {/* KoELECTRA 모델 상태 */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <h4 className="font-semibold mb-2">🤖 KoELECTRA 모델 상태</h4>
        <div className="space-y-1 text-sm">
          <p><b>모델 로드:</b> 
            {isModelLoading ? "🔄 로딩 중..." : 
             isModelLoaded ? "✅ 로드됨" : "❌ 미로드"}
          </p>
          {modelError && (
            <p className="text-red-600"><b>모델 에러:</b> {modelError}</p>
          )}
        </div>
      </div>


      
      {isInitialized && (
        <div className="space-y-2">
          <p><b>음성 인식 상태:</b> {isListening ? "듣는 중..." : "대기 중"}</p>
          <p><b>실시간 텍스트:</b> {liveTranscript}</p>
        </div>
      )}
    </div>
  )
}
