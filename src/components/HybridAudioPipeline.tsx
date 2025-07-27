"use client"

// onnxruntime-web import
import * as ort from "onnxruntime-web";
import { useEffect, useRef, useState } from "react"

// ONNX 모델 로드 함수들
async function loadKOElectraModel() {
  const response = await fetch("/models/koelectra/koelectra.onnx")
  const arrayBuffer = await response.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

async function isStudyRelatedONNX(text: string): Promise<boolean> {
  try {
    const model = await loadKOElectraModel()
    // 실제 ONNX 추론 로직은 여기에 구현
    // 현재는 간단한 키워드 기반 판단
    const studyKeywords = ["공부", "학습", "수업", "문제", "책", "읽기", "쓰기", "계산", "공식", "이론"]
    return studyKeywords.some(keyword => text.includes(keyword))
  } catch (error) {
    console.error("ONNX 모델 로드 실패:", error)
    return false
  }
}

async function loadKOElectraVocab() {
  const response = await fetch("/models/koelectra/vocab.txt")
  const text = await response.text()
  return text.split("\n").filter(line => line.trim())
}

async function loadKOElectraTokenizer() {
  const response = await fetch("/models/koelectra/tokenizer.json")
  return response.json()
}

async function koelectraPreprocess(text: string): Promise<number[]> {
  try {
    const vocab = await loadKOElectraVocab()
    const tokenizer = await loadKOElectraTokenizer()
    
    // 간단한 토크나이징 (실제로는 더 복잡한 로직 필요)
    const tokens = text.split(" ").map(word => {
      const index = vocab.indexOf(word)
      return index >= 0 ? index : 0
    })
    
    return tokens.slice(0, 512) // 최대 길이 제한
  } catch (error) {
    console.error("토크나이징 실패:", error)
    return []
  }
}

async function loadStudyModel() {
  // 실제 모델 로드 로직
  return null
}

async function isStudyRelated(text: string): Promise<boolean> {
  try {
    // 1. ONNX 모델 기반 판단 시도
    const onnxResult = await isStudyRelatedONNX(text)
    if (onnxResult !== null) return onnxResult
    
    // 2. 키워드 기반 판단 (폴백)
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

  // useEffect 클로저에서 최신 상태를 참조하기 위한 Ref
  const stateRef = useRef({ isSpeaking, isListening });
  stateRef.current = { isSpeaking, isListening };

  // 오디오 파이프라인 초기화 함수
  const initializeAudioPipeline = async () => {
    if (isInitialized || isInitializing) return;
    
    setIsInitializing(true);
    setError(null);
    
    try {
      console.log("[AUDIO] 오디오 파이프라인 초기화 시작");
      
      // AudioContext 생성 및 실행 상태로 전환
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      
      // AudioContext가 suspended 상태일 수 있으므로 resume 호출
      if (audioContext.state === 'suspended') {
        console.log("[AUDIO] AudioContext suspended 상태, resume 호출");
        await audioContext.resume()
      }

      console.log("[AUDIO] AudioContext 상태:", audioContext.state);

      // 마이크 권한 요청
      console.log("[AUDIO] 마이크 권한 요청");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      })
      console.log("[AUDIO] 마이크 권한 획득 성공");

      // AudioWorklet 모듈 로드 시도
      try {
        console.log("[AUDIO] AudioWorklet 모듈 로드 시도");
        await audioContext.audioWorklet.addModule("/audio/stft-mel-processor.js")
        const workletNode = new AudioWorkletNode(audioContext, "stft-mel-processor")
        workletNodeRef.current = workletNode
        console.log("[AUDIO] AudioWorklet 모듈 로드 성공");

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(workletNode)

        // Worker 로드
        try {
          console.log("[AUDIO] Worker 모드로 시작")
          
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
            console.log("[AUDIO] Worker 생성 성공");

            // Worklet에서 PCM 데이터를 Worker로 전달
            workletNode.port.onmessage = (e) => {
              console.log("[AUDIO] Worklet에서 PCM 수신:", e.data);
              if (e.data && e.data.pcm && workerRef.current) {
                console.log("[AUDIO] Worker로 PCM 전달");
                workerRef.current.postMessage({ pcm: e.data.pcm });
              }
            };

            // Worker에서 멜 스펙트로그램 + scene_tag 수신
            worker.onmessage = (e) => {
              console.log("[AUDIO] Worker에서 결과 수신:", e.data);
              const { mel, scene_tag, noise_db } = e.data
              const packet = buildPacket({ mel, scene_tag, noise_db })

              if (scene_tag === "speech") {
                console.log("[AUDIO] scene_tag === 'speech' 감지됨");
                if (!stateRef.current.isSpeaking) {
                  setIsSpeaking(true)
                  speechBufferRef.current = ""
                  featureBufferRef.current = []
                  console.log("[AUDIO] --- 🎤 발화 시작 (Worker) ---")
                }
                featureBufferRef.current.push(packet)
                
                // Speech Recognition 시작
                console.log("[STT] 음성 감지됨 (Worker 모드), Speech Recognition 시작 시도");
                console.log("[STT] recognitionRef.current:", recognitionRef.current);
                console.log("[STT] stateRef.current.isListening:", stateRef.current.isListening);
                
                if (recognitionRef.current && !stateRef.current.isListening) {
                  try {
                    console.log("[STT] recognition.start() 호출 시도")
                    recognitionRef.current.start()
                    console.log("[STT] recognition.start() 호출 완료")
                  } catch (err) {
                    console.error("[STT] recognition.start() 에러:", err)
                  }
                } else {
                  console.log("[STT] Speech Recognition 시작 조건 불충족 (Worker 모드)");
                  console.log("[STT] - recognitionRef.current 존재:", !!recognitionRef.current);
                  console.log("[STT] - 이미 듣는 중:", stateRef.current.isListening);
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
              console.log("[STT] 음성 감지됨 (기본 모드), Speech Recognition 시작 시도");
              console.log("[STT] recognitionRef.current:", recognitionRef.current);
              console.log("[STT] stateRef.current.isListening:", stateRef.current.isListening);
              
              if (recognitionRef.current && !stateRef.current.isListening) {
                try {
                  console.log("[STT] recognition.start() 호출 시도")
                  recognitionRef.current.start()
                  console.log("[STT] recognition.start() 호출 완료")
                } catch (err) {
                  console.error("[STT] recognition.start() 에러:", err)
                }
              } else {
                console.log("[STT] Speech Recognition 시작 조건 불충족 (기본 모드)");
                console.log("[STT] - recognitionRef.current 존재:", !!recognitionRef.current);
                console.log("[STT] - 이미 듣는 중:", stateRef.current.isListening);
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
              console.log("[AUDIO] --- 🎤 발화 시작 (기본 분석기 모드) ---")
            }
            
            // Speech Recognition 시작
            console.log("[STT] 음성 감지됨 (기본 분석기 모드), Speech Recognition 시작 시도");
            console.log("[STT] recognitionRef.current:", recognitionRef.current);
            console.log("[STT] stateRef.current.isListening:", stateRef.current.isListening);
            
            if (recognitionRef.current && !stateRef.current.isListening) {
              try {
                console.log("[STT] recognition.start() 호출 시도")
                recognitionRef.current.start()
                console.log("[STT] recognition.start() 호출 완료")
              } catch (err) {
                console.error("[STT] recognition.start() 에러:", err)
              }
            } else {
              console.log("[STT] Speech Recognition 시작 조건 불충족 (기본 분석기 모드)");
              console.log("[STT] - recognitionRef.current 존재:", !!recognitionRef.current);
              console.log("[STT] - 이미 듣는 중:", stateRef.current.isListening);
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
      console.log("[AUDIO] 오디오 파이프라인 초기화 완료");

    } catch (error) {
      console.error("[AUDIO] 오디오 파이프라인 설정 오류:", error)
      setError(`오디오 파이프라인 초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  // 음성 인식(STT) 설정
  const setupSpeechRecognition = () => {
    console.log("[STT] Speech Recognition 설정 시작");
    console.log("[STT] SpeechRecognition 객체:", SpeechRecognition);
    
    if (!SpeechRecognition) {
      console.error("[STT] 이 브라우저는 Speech Recognition API를 지원하지 않습니다.")
      return
    }
    
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "ko-KR"
    
    console.log("[STT] Recognition 인스턴스 생성:", recognition);

    recognition.onresult = (event: any) => {
      console.log("[STT] onresult 이벤트 발생");
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        setLiveTranscript(event.results[i][0].transcript);
        console.log("[STT] 실시간 인식 텍스트:", event.results[i][0].transcript);
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        speechBufferRef.current += finalTranscript.trim() + " ";
        console.log("[STT] 최종 인식 텍스트 누적:", speechBufferRef.current);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      console.log("[STT] recognition 시작됨");
    };
    recognition.onend = () => {
      setIsListening(false);
      console.log("[STT] recognition 종료됨");
      if (stateRef.current.isSpeaking) {
        console.log("[STT] --- 🎤 발화 종료 ---");
        processSpeechSegment();
        setIsSpeaking(false);
      }
    };
    recognition.onerror = (event: any) => {
      console.error("[STT] recognition error:", event.error);
    };

    recognitionRef.current = recognition;
    console.log("[STT] recognition 인스턴스 생성 및 할당 완료:", recognitionRef.current);
  };

  // 수집된 발화 구간 데이터 종합 분석
  const processSpeechSegment = async () => {
    const fullText = speechBufferRef.current.trim();
    if (!fullText) return;

    console.log("======[ 최종 분석 ]======");
    console.log("인식된 문장:", fullText);

    // 공부 관련 여부 판단 (ML 기반)
    const isStudy = await isStudyRelated(fullText);
    console.log("공부 관련 여부:", isStudy);

    // 문맥 분석
    const context = analyzeTextContext(fullText);
    const contextualWeight = getContextualWeight(context);
    console.log("문맥 분석:", context, "가중치:", contextualWeight);
    console.log("분석 결과 - 학습 관련:", isStudy, "텍스트:", fullText);
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

  return (
    <div className="p-4 bg-slate-100 rounded-lg">
      <h3 className="font-bold">하이브리드 오디오 파이프라인</h3>
      
      {!isInitialized && !isInitializing && (
        <button 
          onClick={initializeAudioPipeline}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mb-4"
        >
          오디오 파이프라인 시작
        </button>
      )}
      
      {isInitializing && (
        <p className="text-blue-600 mb-4">오디오 파이프라인 초기화 중...</p>
      )}
      
      {error && (
        <p className="text-red-600 mb-4">오류: {error}</p>
      )}
      
      {isInitialized && (
        <div className="space-y-2">
          <p><b>음성 인식 상태:</b> {isListening ? "듣는 중..." : "대기 중"}</p>
          <p><b>실시간 텍스트:</b> {liveTranscript}</p>
        </div>
      )}
    </div>
  )
}
