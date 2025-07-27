// onnxruntime-web import
import * as ort from "onnxruntime-web";

// KOElectra ONNX 모델 세션
let koelectraSession: ort.InferenceSession | null = null;

// KOElectra 모델 로드 함수
async function loadKOElectraModel() {
  if (!koelectraSession) {
    koelectraSession = await ort.InferenceSession.create("/models/koelectra/koelectra.onnx");
  }
}

// KOElectra ONNX 추론 함수
async function isStudyRelatedONNX(text: string): Promise<boolean> {
  await loadKOElectraModel();
  if (!koelectraSession) {
    console.error("KOElectra ONNX 모델 세션이 null입니다.");
    return false;
  }
  const inputArr = await koelectraPreprocess(text); // [seq_length]
  const inputTensor = new ort.Tensor("int64", inputArr, [1, inputArr.length]);
  const feeds: Record<string, ort.Tensor> = { input_ids: inputTensor };
  const results = await koelectraSession.run(feeds);
  const outputKey = Object.keys(results)[0];
  const logits = results[outputKey]?.data;
  if (!Array.isArray(logits) || logits.length === 0 || typeof logits[0] !== "number") {
    console.error("KOElectra ONNX 모델 출력값이 올바르지 않습니다.", logits);
    return false;
  }
  return logits[0] > 0.5;
}
// KOElectra vocab/tokenizer 로드 및 토크나이저 구현
let koelectraVocab: { [key: string]: number } = {};
let koelectraTokenizer: any = null;
const koelectraMaxLength = 32; // KOElectra 모델 입력 길이(예시)

// vocab.txt 파일을 fetch하여 파싱
async function loadKOElectraVocab() {
  if (Object.keys(koelectraVocab).length > 0) return;
  const res = await fetch("/models/koelectra/vocab.txt");
  const text = await res.text();
  text.split("\n").forEach((line, idx) => {
    const token = line.trim();
    if (token) koelectraVocab[token] = idx;
  });
}

// tokenizer.json을 fetch하여 파싱 (WordPiece 등)
async function loadKOElectraTokenizer() {
  if (koelectraTokenizer) return;
  const res = await fetch("/models/koelectra/tokenizer.json");
  koelectraTokenizer = await res.json();
}

// 텍스트를 KOElectra 방식으로 토큰화 및 인덱싱
async function koelectraPreprocess(text: string): Promise<number[]> {
  await loadKOElectraVocab();
  // tokenizer.json 구조에 따라 실제 WordPiece 토크나이저 구현 필요
  // 여기서는 띄어쓰기 기준으로 토큰화 후 vocab 인덱싱(간단 버전)
  const tokens = text.trim().split(/\s+/);
  const indices = tokens.map(t => koelectraVocab[t] ?? koelectraVocab["[UNK]"] ?? 0);
  while (indices.length < koelectraMaxLength) indices.push(0);
  return indices.slice(0, koelectraMaxLength);
}
// ML 모델 Ref (TensorFlow.js 등)
let studyModel: any = null;

// ML 모델 로드 함수 (비동기)
async function loadStudyModel() {
  if (!studyModel && (window as any).tf) {
    studyModel = await (window as any).tf.loadLayersModel("/model/model.json");
  }
}

// 공부 관련 여부 판단 함수 (ML 기반)
async function isStudyRelated(text: string): Promise<boolean> {
  // KOElectra ONNX 기반 추론 함수 사용
  try {
    return await isStudyRelatedONNX(text);
  } catch (err) {
    console.error("KOElectra ONNX 추론 오류:", err);
    return false;
  }
}
"use client"

import { useEffect, useRef, useState } from "react"

// 패킷 빌더: 추론 결과를 JSON 패킷으로 변환
function buildPacket({ mel, scene_tag, noise_db }: { mel: number[]; scene_tag: string; noise_db: number }) {
  return {
    timestamp: Date.now(),
    scene_tag,
    noise_db,
    mel,
  }
}


// SpeechRecognition 타입 선언 (간단 버전)
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
  const speechBufferRef = useRef<string>("") // 한 발화가 끝날 때까지 텍스트를 모으는 버퍼
  const featureBufferRef = useRef<any[]>([]) // 한 발화 동안의 오디오 특징을 모으는 버퍼

  // useEffect 클로저에서 최신 상태를 참조하기 위한 Ref
  const stateRef = useRef({ isSpeaking, isListening });
  stateRef.current = { isSpeaking, isListening };

  useEffect(() => {
    let isActive = true

    // 1. 오디오 파이프라인 설정 (기존 로직)
    async function setupAudioPipeline() {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      await audioContext.audioWorklet.addModule("/audio/stft-mel-processor.js")
      const workletNode = new AudioWorkletNode(audioContext, "stft-mel-processor")
      workletNodeRef.current = workletNode

      const worker = new Worker("/audio/ml-inference-worker.js")
      workerRef.current = worker

      // Worker에서 멜 스펙트로그램 + scene_tag 수신
      worker.onmessage = (e) => {
        if (!isActive) return

        const { mel, scene_tag, noise_db } = e.data
        const packet = buildPacket({ mel, scene_tag, noise_db })

        if (scene_tag === "speech") {
          if (!stateRef.current.isSpeaking) {
            setIsSpeaking(true)
            speechBufferRef.current = ""
            featureBufferRef.current = []
            console.log("[AUDIO] --- 🎤 발화 시작 ---")
          }
          featureBufferRef.current.push(packet)
          // 디버깅: 음성 scene_tag 발생
          console.log("[AUDIO] scene_tag=speech, isListening:", stateRef.current.isListening)
          if (recognitionRef.current && !stateRef.current.isListening) {
            try {
              console.log("[STT] recognition.start() 호출 시도")
              recognitionRef.current.start()
              console.log("[STT] recognition.start() 호출 완료")
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      })
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(workletNode)
    }

    // 2. 음성 인식(STT) 설정
    function setupSpeechRecognition() {
      if (!SpeechRecognition) {
        console.error("[STT] 이 브라우저는 Speech Recognition API를 지원하지 않습니다.")
        return
      }
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ko-KR"

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
    }

    // 3. 수집된 발화 구간 데이터 종합 분석
    async function processSpeechSegment() {
      const fullText = speechBufferRef.current.trim();
      if (!fullText) return;

      console.log("======[ 최종 분석 ]======");
      console.log("인식된 문장:", fullText);

      // 공부 관련 여부 판단 (ML 기반)
      const isStudy = await isStudyRelated(fullText);
      console.log("공부 관련 여부:", isStudy);

      // 서버로 결과 전송
      fetch("/api/send-study-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStudy }),
      })
        .then(res => res.ok ? console.log("서버 전송 성공") : console.error("서버 전송 실패"))
        .catch(err => console.error("서버 통신 오류", err));
    }

    // 텍스트 문맥을 분석하는 헬퍼 함수 (고도화)
    function analyzeTextContext(text: string):
      | 'discussion'
      | 'class'
      | 'presentation'
      | 'question'
      | 'frustration'
      | 'statement'
      | 'unknown' {
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
    }

    // 문맥에 따른 가중치를 반환하는 헬퍼 함수 (상황별 가중치 추가)
    function getContextualWeight(
      context:
        | 'discussion'
        | 'class'
        | 'presentation'
        | 'question'
        | 'frustration'
        | 'statement'
        | 'unknown'
    ): number {
      switch (context) {
        case 'discussion': return 0.95; // 토론: 집중도 약간 높음
        case 'class': return 1.0; // 수업: 집중도 최상
        case 'presentation': return 0.9; // 발표: 집중도 높음
        case 'question': return 0.8; // 질문: 막혔을 가능성, 집중도 약간 감소
        case 'frustration': return 0.5; // 좌절: 명확한 집중력 저하 신호, 집중도 크게 감소
        case 'statement': return 1.0; // 혼잣말/내용 읽기: 학습 활동의 일부로 판단, 가중치 없음
        default: return 0.9; // 불명확: 짧은 중얼거림 등, 약간의 방해로 간주
      }
    }

    setupAudioPipeline()
    setupSpeechRecognition()

    return () => {
      isActive = false
      if (recognitionRef.current) recognitionRef.current.abort()
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
      if (workerRef.current) workerRef.current.terminate()
    }
  }, []) // 의존성 배열을 비워 마운트 시 한 번만 실행되도록 수정

  return (
    <div className="p-4 bg-slate-100 rounded-lg">
      <h3 className="font-bold">하이브리드 오디오 파이프라인</h3>
      <p><b>음성 인식 상태:</b> {isListening ? "듣는 중..." : "대기 중"}</p>
      <p><b>실시간 텍스트:</b> {liveTranscript}</p>
    </div>
  )
}
