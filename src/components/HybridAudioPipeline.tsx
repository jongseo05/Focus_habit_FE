"use client"

import { useEffect, useRef, useState } from "react"
import { koelectraPreprocess, testTokenizer } from "@/lib/tokenizer/koelectra"
import { useKoELECTRA } from "@/hooks/useKoELECTRA"

// 공부 관련 텍스트 분석 함수 (키워드 기반)
async function analyzeStudyRelatedByKeywords(text: string): Promise<boolean> {
  try {
    // 키워드 기반 판단 (기본)
    const studyKeywords = [
      "공부", "학습", "수업", "문제", "책", "읽기", "쓰기", "계산", "공식", "이론",
      "시험", "과제", "프로젝트", "리포트", "논문", "연구", "분석", "실험",
      "강의", "교과서", "참고서", "문제집", "연습", "복습", "예습"
    ]
    
    const lowerText = text.toLowerCase()
    return studyKeywords.some(keyword => lowerText.includes(keyword))
  } catch (error) {
    console.error("공부 관련 판단 실패:", error)
    return false
  }
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
  // KoELECTRA 모델 훅
  const { 
    isLoaded: isModelLoaded, 
    isLoading: isModelLoading, 
    error: modelError, 
    inference: koelectraInference 
  } = useKoELECTRA({ autoLoad: true })

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

  // useEffect 클로저에서 최신 상태를 참조하기 위한 Ref
  const stateRef = useRef({ isSpeaking, isListening });
  stateRef.current = { isSpeaking, isListening };

  // 오디오 파이프라인 초기화 함수
  const initializeAudioPipeline = async () => {
    if (isInitialized || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      // AudioContext 생성 및 실행 상태로 전환
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      
      // AudioContext가 suspended 상태일 수 있으므로 resume 호출
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      // 마이크 권한 요청
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      })

      // AudioWorklet 모듈 로드 시도
      try {
        await audioContext.audioWorklet.addModule("/audio/stft-mel-processor.js")
        const workletNode = new AudioWorkletNode(audioContext, "stft-mel-processor")
        workletNodeRef.current = workletNode

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(workletNode)

        // Worker 로드
        try {
          // 조건부 Worker 생성
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
          if (worker) {
            workerRef.current = worker;

            // Worklet에서 PCM 데이터를 Worker로 전달
            workletNode.port.onmessage = (e) => {
              if (e.data && e.data.pcm && workerRef.current) {
                workerRef.current.postMessage({ pcm: e.data.pcm });
              }
            };

            // Worker에서 멜 스펙트로그램 + scene_tag 수신
            worker.onmessage = (e) => {
              const { mel, scene_tag, noise_db } = e.data
              const packet = buildPacket({ mel, scene_tag, noise_db })

              if (scene_tag === "speech") {
                if (!stateRef.current.isSpeaking) {
                  setIsSpeaking(true)
                  speechBufferRef.current = ""
                  featureBufferRef.current = []
                }
                featureBufferRef.current.push(packet)
                
                // Speech Recognition 시작
                if (recognitionRef.current && !stateRef.current.isListening) {
                  try {
                    recognitionRef.current.start()
                  } catch (err) {
                    console.error("[STT] recognition.start() 에러:", err)
                  }
                }
                
                if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
                speechTimeoutRef.current = setTimeout(() => {
                  if (recognitionRef.current && stateRef.current.isListening) recognitionRef.current.stop()
                }, 2000)
              }
            }
          } else {
            throw new Error("Worker 생성 실패");
          }

        } catch (workerError) {
          console.warn("[AUDIO] Worker 로드 실패, 기본 모드로 전환:", workerError)
          
          // Worker 실패 시 기본 오디오 분석 모드
          const analyser = audioContext.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          
          const bufferLength = analyser.frequencyBinCount
          const dataArray = new Uint8Array(bufferLength)
          
          const checkAudioLevel = () => {
            analyser.getByteFrequencyData(dataArray)
            const average = dataArray.reduce((a, b) => a + b) / bufferLength
            
            // 간단한 음성 감지 (임계값 기반)
            if (average > 30) {
              if (!stateRef.current.isSpeaking) {
                setIsSpeaking(true)
                speechBufferRef.current = ""
                featureBufferRef.current = []
                console.log("[AUDIO] --- 🎤 발화 시작 (기본 모드) ---")
              }
              
              // Speech Recognition 시작
              if (recognitionRef.current && !stateRef.current.isListening) {
                try {
                  recognitionRef.current.start()
                } catch (err) {
                  console.error("[STT] recognition.start() 에러:", err)
                }
              }
              
              if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
              speechTimeoutRef.current = setTimeout(() => {
                if (recognitionRef.current && stateRef.current.isListening) recognitionRef.current.stop()
              }, 2000)
            }
            
            requestAnimationFrame(checkAudioLevel)
          }
          
          checkAudioLevel()
        }

      } catch (workletError) {
        console.warn("[AUDIO] AudioWorklet 로드 실패, 기본 분석기 모드로 전환:", workletError)
        
        // AudioWorklet 실패 시 기본 분석기 모드
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        
        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / bufferLength
          
          // 간단한 음성 감지 (임계값 기반)
          if (average > 30) {
            if (!stateRef.current.isSpeaking) {
              setIsSpeaking(true)
              speechBufferRef.current = ""
              featureBufferRef.current = []
            }
            
            // Speech Recognition 시작
            if (recognitionRef.current && !stateRef.current.isListening) {
              try {
                recognitionRef.current.start()
              } catch (err) {
                console.error("[STT] recognition.start() 에러:", err)
              }
            }
            
            if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
            speechTimeoutRef.current = setTimeout(() => {
              if (recognitionRef.current && stateRef.current.isListening) recognitionRef.current.stop()
            }, 2000)
          }
          
          requestAnimationFrame(checkAudioLevel)
        }
        
        checkAudioLevel()
      }

      setIsInitialized(true);

    } catch (error) {
      console.error("[AUDIO] 오디오 파이프라인 설정 오류:", error)
      setError(`오디오 파이프라인 초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  // 음성 인식(STT) 설정
  const setupSpeechRecognition = () => {
    if (!SpeechRecognition) {
      console.error("[STT] 이 브라우저는 Speech Recognition API를 지원하지 않습니다.")
      return
    }
    
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "ko-KR"

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        setLiveTranscript(event.results[i][0].transcript);
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        // 발화 시작 시간 기록 (첫 번째 텍스트가 들어올 때)
        if (!speechStartTimeRef.current) {
          speechStartTimeRef.current = Date.now();
          console.log('🎤 발화 시작:', new Date().toLocaleTimeString());
        }
        speechBufferRef.current += finalTranscript.trim() + " ";
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
    };
    recognition.onend = () => {
      setIsListening(false);
      if (stateRef.current.isSpeaking) {
        // 발화 종료 시간 기록
        speechEndTimeRef.current = Date.now();
        console.log('🎤 발화 종료:', new Date().toLocaleTimeString());
        processSpeechSegment();
        setIsSpeaking(false);
      }
    };
    recognition.onerror = (event: any) => {
      // aborted는 정상적인 종료이므로 별도 처리
      if (event.error === 'aborted') {
        console.log('🎤 음성 인식 정상 종료됨');
        return;
      }
      
      // 다른 오류들은 로그 출력
      console.error("[STT] recognition error:", event.error);
    };

    recognitionRef.current = recognition;
    console.log("[STT] recognition 인스턴스 생성 및 할당 완료:", recognitionRef.current);
  };

  // 수집된 발화 구간 데이터 종합 분석
  const processSpeechSegment = async () => {
    const fullText = speechBufferRef.current.trim();
    if (!fullText) return;

    // 타임스탬프 계산
    const startTime = speechStartTimeRef.current;
    const endTime = speechEndTimeRef.current || Date.now();
    const duration = startTime ? endTime - startTime : 0;

    console.log('🎤 발화 분석 시작 ===================');
    console.log(`📅 타임스탬프: ${new Date(startTime || Date.now()).toLocaleTimeString()} ~ ${new Date(endTime).toLocaleTimeString()}`);
    console.log(`⏱️  발화 지속시간: ${duration}ms (${(duration / 1000).toFixed(1)}초)`);
    console.log(`💬 발화 내용: "${fullText}"`);

    try {
      // 1. KoELECTRA 모델 분석 (우선)
      let isStudyRelated = false;
      let confidence = 0;
      
      if (isModelLoaded && koelectraInference) {
        try {
          const koelectraResult = await koelectraInference(fullText);
          confidence = koelectraResult?.confidence || 0;
          isStudyRelated = confidence > 0.6; // 신뢰도 60% 이상을 공부 관련으로 판단
          
          console.log(`🤖 KoELECTRA 분석 결과:`);
          console.log(`   - 신뢰도: ${(confidence * 100).toFixed(1)}%`);
          console.log(`   - 공부 관련: ${isStudyRelated ? '✅ 예' : '❌ 아니오'}`);
          console.log(`   - 처리 시간: ${koelectraResult?.processingTime.toFixed(1)}ms`);
        } catch (error) {
          console.warn('⚠️ KoELECTRA 분석 실패, 키워드 기반 분석으로 대체:', error);
        }
      }

      // 2. 키워드 기반 분석 (폴백 또는 보조)
      if (!isModelLoaded || !koelectraInference) {
        const keywordResult = await analyzeStudyRelatedByKeywords(fullText);
        isStudyRelated = keywordResult;
        console.log(`🔍 키워드 기반 분석 결과:`);
        console.log(`   - 공부 관련: ${keywordResult ? '✅ 예' : '❌ 아니오'}`);
      }

      // 3. 문맥 분석
      const context = analyzeTextContext(fullText);
      const contextualWeight = getContextualWeight(context);
      
      console.log(`📊 문맥 분석 결과:`);
      console.log(`   - 문맥 유형: ${getContextLabel(context)}`);
      console.log(`   - 문맥 가중치: ${contextualWeight}`);

      // 4. 최종 판정
      const finalResult = isStudyRelated ? '공부 관련' : '잡담';
      const finalConfidence = isModelLoaded ? confidence : 0.5; // 키워드 기반은 50% 신뢰도

      console.log(`🎯 최종 판정:`);
      console.log(`   - 결과: ${finalResult}`);
      console.log(`   - 신뢰도: ${(finalConfidence * 100).toFixed(1)}%`);
      console.log(`   - 문맥 가중치: ${contextualWeight}`);
      
      // 5. 상세 정보 출력
      console.log(`📋 상세 정보:`);
      console.log(`   - 발화 시작: ${new Date(startTime || Date.now()).toISOString()}`);
      console.log(`   - 발화 종료: ${new Date(endTime).toISOString()}`);
      console.log(`   - 텍스트 길이: ${fullText.length}자`);
      
      if (isStudyRelated) {
        console.log(`✅ 이 발화는 공부/학습 관련 내용입니다.`);
        console.log(`   - 질문, 토론, 수업 내용 등 학습 활동으로 분류됨`);
      } else {
        console.log(`❌ 이 발화는 잡담/개인적인 내용입니다.`);
        console.log(`   - 학습과 무관한 대화로 분류됨`);
      }
      
      console.log('🎤 발화 분석 완료 ===================\n');

    } catch (error) {
      console.error('❌ 발화 분석 중 오류 발생:', error);
    }

    // 버퍼 초기화
    speechBufferRef.current = "";
    featureBufferRef.current = [];
    speechStartTimeRef.current = null;
    speechEndTimeRef.current = null;
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

  useEffect(() => {
    // Speech Recognition 설정만 먼저 수행
    setupSpeechRecognition();

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (workerRef.current) workerRef.current.terminate()
    }
  }, [])

  // 컴포넌트 마운트 시 자동으로 오디오 파이프라인 초기화
  useEffect(() => {
    if (!isInitialized && !isInitializing) {
      console.log('🎤 오디오 파이프라인 자동 초기화 시작')
      initializeAudioPipeline()
    }
  }, [isInitialized, isInitializing])

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
