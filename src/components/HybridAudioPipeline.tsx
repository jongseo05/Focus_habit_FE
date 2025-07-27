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

  // 성능 최적화를 위한 디바운스된 텍스트
  const debouncedLiveTranscript = useDebounce(liveTranscript, 100)

  // useEffect 클로저에서 최신 상태를 참조하기 위한 Ref
  const stateRef = useRef({ isSpeaking, isListening });
  stateRef.current = { isSpeaking, isListening };

  // 집중 모드 상태 변화 감지 및 오디오 파이프라인 제어
  useEffect(() => {
    // 집중 모드가 종료되거나 일시정지된 경우
    if (!isFocusSessionRunning || isFocusSessionPaused) {
      // 음성 인식 중단
      if (recognitionRef.current && recognitionRef.current.state === 'active') {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          console.log('🎤 음성 인식 중단 중 오류:', error)
        }
      }
      
      // 오디오 레벨 체크 중단
      setIsListening(false)
      
      // 발화 버퍼 초기화
      speechBufferRef.current = ""
      speechStartTimeRef.current = null
      speechEndTimeRef.current = null
      silenceStartTimeRef.current = null
      
      // 실시간 텍스트 초기화
      setLiveTranscript("")
      setIsSpeaking(false)
    }
    
    // 집중 모드가 재시작된 경우
    else if (isFocusSessionRunning && !isFocusSessionPaused && isInitialized) {
      // 오디오 레벨 체크 재시작
      setIsListening(true)
      
      // 음성 인식 재시작
      if (recognitionRef.current && recognitionRef.current.state === 'inactive') {
        try {
          recognitionRef.current.start()
        } catch (error) {
          console.log('🎤 음성 인식 재시작 중 오류:', error)
        }
      }
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
        audioTrack.onended = () => console.log('🎤 오디오 트랙 종료됨');
        audioTrack.onmute = () => console.log('🎤 오디오 트랙 음소거됨');
        audioTrack.onunmute = () => console.log('🎤 오디오 트랙 음소거 해제됨');
        
        console.log('🎤 마이크 스트림 초기화 완료:', {
          streamId: stream.id,
          streamActive: stream.active,
          audioTrackEnabled: audioTrack.enabled,
          audioTrackMuted: audioTrack.muted
        });
      }
      
      const stream = streamRef.current;

      // 마이크 트랙에서 실제 오디오 데이터 확인
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        console.log('🎤 오디오 트랙 상세 정보:', {
          id: audioTrack.id,
          label: audioTrack.label,
          enabled: audioTrack.enabled,
          muted: audioTrack.muted,
          readyState: audioTrack.readyState,
          settings: audioTrack.getSettings(),
          constraints: audioTrack.getConstraints()
        });
        
        // 오디오 트랙 이벤트 리스너 추가
        audioTrack.onended = () => console.log('🎤 오디오 트랙 종료됨');
        audioTrack.onmute = () => console.log('🎤 오디오 트랙 음소거됨');
        audioTrack.onunmute = () => console.log('🎤 오디오 트랙 음소거 해제됨');
        
        console.log('🎤 마이크 스트림 초기화 완료:', {
          streamId: stream.id,
          streamActive: stream.active,
          audioTrackEnabled: audioTrack.enabled,
          audioTrackMuted: audioTrack.muted
        });
      }

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

          // AudioWorklet용 소스
          const workletSource = audioContext.createMediaStreamSource(stream)
          workletSource.connect(workletNode)
          
          console.log('🎤 실제 오디오 분석 스트림 연결:', {
            audioContextState: audioContext.state,
            streamId: stream.id,
            streamActive: stream.active,
            workletSourceContext: workletSource.context === audioContext,
            workletNodeState: workletNode.context.state
          });

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
            console.warn('🎤 스트림이 비활성 상태입니다');
            return;
          }
          
          const audioTrack = streamRef.current.getAudioTracks()[0];
          if (!audioTrack || !audioTrack.enabled || audioTrack.muted) {
            console.warn('🎤 오디오 트랙이 비활성화되었습니다:', {
              enabled: audioTrack?.enabled,
              muted: audioTrack?.muted,
              readyState: audioTrack?.readyState
            });
            return;
          }
          
          // 오디오 레벨 분석 로직 - 재사용 가능한 분석기 사용
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(dataArray);
          
          // 시간 도메인 데이터로도 오디오 레벨 계산 시도
          const timeDataArray = new Uint8Array(bufferLength);
          analyser.getByteTimeDomainData(timeDataArray);
          
          // 디버깅: 실제 오디오 데이터 확인 (매우 드물게만)
          if (Math.random() < 0.001 && streamRef.current) { // 0.1% 확률로만 로깅
            console.log('🎤 실제 오디오 분석 데이터 확인:', {
              streamId: streamRef.current.id,
              audioContextState: audioContext.state,
              sourceConnected: levelSource.context === audioContext,
              dataArrayMax: Math.max(...dataArray),
              dataArrayMin: Math.min(...dataArray),
              dataArrayRange: `${Math.min(...dataArray)}-${Math.max(...dataArray)}`,
              nonZeroCount: dataArray.filter(val => val > 0).length,
              timeDataMax: Math.max(...timeDataArray),
              timeDataMin: Math.min(...timeDataArray),
              timeDataRange: `${Math.min(...timeDataArray)}-${Math.max(...timeDataArray)}`,
              streamActive: streamRef.current.active,
              audioTrackEnabled: streamRef.current.getAudioTracks()[0].enabled,
              audioTrackMuted: streamRef.current.getAudioTracks()[0].muted,
              // 추가 디버깅 정보
              bufferLength,
              fftSize: analyser.fftSize,
              smoothingTimeConstant: analyser.smoothingTimeConstant,
              minDecibels: analyser.minDecibels,
              maxDecibels: analyser.maxDecibels
            });
          }
          
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
          
          if (!hasAudioData && Math.random() < 0.01) { // 1% 확률로 로깅
            console.warn('🎤 오디오 데이터가 감지되지 않습니다:', {
              freqMax,
              freqMin,
              freqAverage: freqAverage.toFixed(2),
              rms: rms.toFixed(4),
              rmsLevel: rmsLevel.toFixed(2),
              finalLevel: finalLevel.toFixed(2),
              streamActive: streamRef.current?.active,
              audioTrackEnabled: audioTrack?.enabled,
              audioTrackMuted: audioTrack?.muted
            });
          }
          
          setCurrentAudioLevel(finalLevel);
          
          // 디버깅: 오디오 분석기 상태 확인 (매우 드물게만)
          if (Math.random() < 0.001) { // 0.1% 확률로만 로깅
            console.log('🔍 오디오 분석기 상태:', {
              analyserFftSize: analyser.fftSize,
              analyserFrequencyBinCount: analyser.frequencyBinCount,
              analyserSmoothingTimeConstant: analyser.smoothingTimeConstant,
              analyserMinDecibels: analyser.minDecibels,
              analyserMaxDecibels: analyser.maxDecibels,
              sourceConnected: levelSource.context === audioContext,
              dataArrayMax: Math.max(...dataArray),
              dataArrayMin: Math.min(...dataArray),
              dataArraySum: dataArray.reduce((sum, val) => sum + val, 0),
              nonZeroCount: dataArray.filter(val => val > 0).length,
              rmsLevel: rmsLevel.toFixed(2),
              timeDataMax: Math.max(...timeDataArray),
              timeDataMin: Math.min(...timeDataArray),
              finalLevel: finalLevel.toFixed(2),
              isSpeaking: stateRef.current.isSpeaking,
              audioContextState: audioContext.state,
              streamActive: stream.active,
              streamId: stream.id,
              // 추가 디버깅 정보
              freqAverage: freqAverage.toFixed(2),
              rms: rms.toFixed(4),
              timeDataRange: `${Math.min(...timeDataArray)}-${Math.max(...timeDataArray)}`,
              dataArrayRange: `${Math.min(...dataArray)}-${Math.max(...dataArray)}`
            });
          }
          
          // 음성 감지 (전체 주파수 대역에 맞는 임계값)
          if (finalLevel > 5 && !stateRef.current.isSpeaking) {
            setIsSpeaking(true);
            speechStartTimeRef.current = Date.now();
            silenceStartTimeRef.current = null; // 조용함 타이머 리셋
            console.log('🎤 음성 감지됨 (레벨:', finalLevel.toFixed(1), ')');
          } else if (finalLevel < 2 && stateRef.current.isSpeaking) {
            // 조용함 시작 시간 기록
            if (!silenceStartTimeRef.current) {
              silenceStartTimeRef.current = Date.now();
            }
            
            // 0.3초 이상 조용하면 발화 종료로 판단 (더 빠르게)
            const silenceDuration = Date.now() - silenceStartTimeRef.current;
            if (silenceDuration > 200) {
              setIsSpeaking(false);
              speechEndTimeRef.current = Date.now();
              console.log('🎤 음성 종료 감지됨 (레벨:', finalLevel.toFixed(1), ', 조용함 지속:', silenceDuration + 'ms)');
              
              // 발화 분석 트리거
              if (speechBufferRef.current.trim()) {
                processSpeechSegment();
              }
              
              // 타이머 리셋
              silenceStartTimeRef.current = null;
            }
          } else if (finalLevel >= 2 && stateRef.current.isSpeaking) {
            // 다시 소리가 나면 조용함 타이머 리셋
            silenceStartTimeRef.current = null;
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
      } catch (workletError) {
        console.warn("AudioWorklet 로드 실패, 기본 오디오 처리로 대체:", workletError);
        
        // 기본 오디오 레벨 체크 (명확한 음성 감지)
        // 오디오 레벨 분석용 소스와 분석기 (한 번만 생성)
        const source = audioContext.createMediaStreamSource(streamRef.current);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // 더 큰 FFT 크기로 변경
        analyser.smoothingTimeConstant = 0.1; // 더 빠른 반응
        analyser.minDecibels = -90; // 더 낮은 데시벨 임계값
        analyser.maxDecibels = -10; // 더 높은 데시벨 임계값
        source.connect(analyser);
         
         console.log('🎤 기본 오디오 레벨 체크 스트림 연결:', {
           audioContextState: audioContext.state,
           streamId: streamRef.current.id,
           streamActive: streamRef.current.active,
           sourceContext: source.context === audioContext
         });
         
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
             console.warn('🎤 기본 체크: 스트림이 비활성 상태입니다');
             return;
           }
           
           const audioTrack = streamRef.current.getAudioTracks()[0];
           if (!audioTrack || !audioTrack.enabled || audioTrack.muted) {
             console.warn('🎤 기본 체크: 오디오 트랙이 비활성화되었습니다:', {
               enabled: audioTrack?.enabled,
               muted: audioTrack?.muted,
               readyState: audioTrack?.readyState
             });
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
           
           if (!hasAudioData && Math.random() < 0.01) { // 1% 확률로 로깅
             console.warn('🎤 기본 체크: 오디오 데이터가 감지되지 않습니다:', {
               freqMax,
               freqMin,
               freqAverage: freqAverage.toFixed(2),
               rms: rms.toFixed(4),
               rmsLevel: rmsLevel.toFixed(2),
               finalLevel: finalLevel.toFixed(2),
               streamActive: streamRef.current?.active,
               audioTrackEnabled: audioTrack?.enabled,
               audioTrackMuted: audioTrack?.muted
             });
           }
           
           setCurrentAudioLevel(finalLevel);
           
           // 디버깅: 오디오 분석기 상태 확인 (매우 드물게만)
           if (Math.random() < 0.001) { // 0.1% 확률로만 로깅
             console.log('🔍 오디오 분석기 상태:', {
               analyserFftSize: analyser.fftSize,
               analyserFrequencyBinCount: analyser.frequencyBinCount,
               analyserSmoothingTimeConstant: analyser.smoothingTimeConstant,
               analyserMinDecibels: analyser.minDecibels,
               analyserMaxDecibels: analyser.maxDecibels,
               sourceConnected: source.context === audioContext,
               dataArrayMax: Math.max(...dataArray),
               dataArrayMin: Math.min(...dataArray),
               dataArraySum: dataArray.reduce((sum, val) => sum + val, 0),
               nonZeroCount: dataArray.filter(val => val > 0).length,
               rmsLevel: rmsLevel.toFixed(2),
               timeDataMax: Math.max(...timeDataArray),
               timeDataMin: Math.min(...timeDataArray),
               finalLevel: finalLevel.toFixed(2),
               isSpeaking: stateRef.current.isSpeaking
             });
           }
           
           // 음성 감지 (전체 주파수 대역에 맞는 임계값)
           if (finalLevel > 5 && !stateRef.current.isSpeaking) {
             setIsSpeaking(true);
             speechStartTimeRef.current = Date.now();
             silenceStartTimeRef.current = null; // 조용함 타이머 리셋
             console.log('🎤 음성 감지됨 (레벨:', finalLevel.toFixed(1), ')');
           } else if (finalLevel < 2 && stateRef.current.isSpeaking) {
             // 조용함 시작 시간 기록
             if (!silenceStartTimeRef.current) {
               silenceStartTimeRef.current = Date.now();
             }
             
             // 0.3초 이상 조용하면 발화 종료로 판단 (더 빠르게)
             const silenceDuration = Date.now() - silenceStartTimeRef.current;
             if (silenceDuration > 200) {
               setIsSpeaking(false);
               speechEndTimeRef.current = Date.now();
               console.log('🎤 음성 종료 감지됨 (레벨:', finalLevel.toFixed(1), ', 조용함 지속:', silenceDuration + 'ms)');
               
               // 발화 분석 트리거
               if (speechBufferRef.current.trim()) {
                 processSpeechSegment();
               }
               
               // 타이머 리셋
               silenceStartTimeRef.current = null;
             }
           } else if (finalLevel >= 2 && stateRef.current.isSpeaking) {
             // 다시 소리가 나면 조용함 타이머 리셋
             silenceStartTimeRef.current = null;
           }
           
           requestAnimationFrame(() => checkAudioLevel());
         };

        setIsListening(true); // 기본 오디오 레벨 체크를 위해 true로 설정
        
        // 강제로 기본 오디오 레벨 체크 시작
        setTimeout(() => {
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

    recognition.onstart = () => { setIsSpeechRecognitionActive(true); };

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
      setIsSpeechRecognitionActive(false);
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
          const currentState = recognitionRef.current.state;
          console.log('🎤 음성 인식 상태 확인:', currentState);
          
          if (currentState === 'inactive') {
            recognitionRef.current.start();
            setIsListening(true);
            console.log('🎤 음성 인식 재시작됨');
          } else {
            console.log('🎤 음성 인식이 이미 활성 상태입니다 (상태:', currentState, ')');
          }
        } catch (error) {
          console.warn('음성 인식 재시작 실패:', error);
          // 재시작 실패 시 200ms 후 재시도
          setTimeout(() => {
            if (recognitionRef.current && stateRef.current.isListening) {
              try {
                const retryState = recognitionRef.current.state;
                console.log('🎤 음성 인식 재시도 - 상태:', retryState);
                if (retryState === 'inactive') {
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
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    const text = speechBufferRef.current.trim();
    if (!text) { setIsAnalyzing(false); return; }

    const startTime = performance.now();
    
    try {
      // 발화 지속시간 계산
      const duration = speechStartTimeRef.current && speechEndTimeRef.current 
        ? (speechEndTimeRef.current - speechStartTimeRef.current) / 1000 
        : 0;

      // 타임스탬프 정보
      const startTimestamp = speechStartTimeRef.current ? new Date(speechStartTimeRef.current).toLocaleTimeString() : '알 수 없음';
      const endTimestamp = speechEndTimeRef.current ? new Date(speechEndTimeRef.current).toLocaleTimeString() : '알 수 없음';

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
├─ 시작 시간: ${startTimestamp}
├─ 종료 시간: ${endTimestamp}
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
    } finally {
      setIsAnalyzing(false);
      // 분석 완료 후 음성인식 재시작 보장
      setTimeout(() => {
        if (recognitionRef.current && isInitialized && isFocusSessionRunning && !isFocusSessionPaused) {
          try {
            console.log('🎤 발화 분석 완료 - 음성 인식 재시작 시도 (상태:', recognitionRef.current.state, ')');
            if (recognitionRef.current.state === 'inactive') {
              recognitionRef.current.start();
              console.log('🎤 음성 인식 재시작 성공');
            } else {
              console.log('🎤 음성 인식이 이미 활성 상태입니다 (상태:', recognitionRef.current.state, ')');
            }
          } catch (error) {
            console.warn('분석 후 재시작 실패:', error);
          }
        } else {
          console.log('🎤 음성 인식 재시작 조건 불만족:', {
            hasRecognition: !!recognitionRef.current,
            isInitialized,
            isFocusSessionRunning,
            isFocusSessionPaused
          });
          
          // isInitialized가 false여도 재시작 시도
          if (recognitionRef.current && isFocusSessionRunning && !isFocusSessionPaused) {
            try {
              console.log('🎤 isInitialized가 false이지만 재시작 시도');
              // 상태가 undefined인 경우에도 재시작 시도
              if (!recognitionRef.current.state || recognitionRef.current.state === 'inactive') {
                recognitionRef.current.start();
                console.log('🎤 음성 인식 재시작 성공 (isInitialized 무시)');
              } else {
                console.log('🎤 음성 인식 상태 확인:', recognitionRef.current.state);
              }
            } catch (error) {
              console.warn('재시작 실패 (isInitialized 무시):', error);
            }
          }
        }
      }, 100); // 100ms 지연 후 재시작
    }
  }, [isModelLoaded, koelectraInference, isInitialized, isAnalyzing]);

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
        await initializeTokenizer();
      } catch (error) {
        console.error('❌ 토크나이저 초기화 실패:', error);
      }
      
      // 2. 오디오 파이프라인 초기화 (토크나이저 로드 후)
      setTimeout(() => {
        if (!isInitialized && !isInitializing) {
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
        <div className="space-y-3 p-3 bg-white rounded border">
          <h4 className="font-semibold text-sm">🎤 오디오 파이프라인 상태</h4>
          
          {/* 음성 감지 상태 */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">
              {isSpeaking ? "🎤 말하는 중..." : "🔇 조용함"}
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
