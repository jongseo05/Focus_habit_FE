import { useEffect, useRef } from 'react';

// 패킷 빌더: 추론 결과를 JSON 패킷으로 변환
function buildPacket({ mel, scene_tag, noise_db }: { mel: number[]; scene_tag: string; noise_db: number }) {
  return {
    timestamp: Date.now(),
    scene_tag,
    noise_db,
    mel,
    // 필요시 추가 필드
  };
}

export default function MicrophoneMLPipeline() {
  const audioContextRef = useRef<AudioContext|null>(null);
  const workletNodeRef = useRef<AudioWorkletNode|null>(null);
  const workerRef = useRef<Worker|null>(null);
  const wsRef = useRef<WebSocket|null>(null);

  useEffect(() => {
    let isActive = true;
    async function setup() {
      // AudioContext 생성
      const audioContext = new window.AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // AudioWorklet 등록
      await audioContext.audioWorklet.addModule('/audio/stft-mel-processor.js');
      const workletNode = new window.AudioWorkletNode(audioContext, 'stft-mel-processor');
      workletNodeRef.current = workletNode;

      // ML Inference Worker 생성
      const worker = new Worker('/audio/ml-inference-worker.js');
      workerRef.current = worker;

      // WebSocket 연결 (예시: ws://localhost:8080)
      const ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      // Worklet에서 PCM 수신 → Worker로 전달
      workletNode.port.onmessage = (e) => {
        const { pcm } = e.data;
        if (pcm) {
          worker.postMessage({ pcm });
        }
      };

      // Worker에서 추론 결과 수신 → 후처리 및 패킷화 → WebSocket 전송
      worker.onmessage = (e) => {
        const { mel, scene_tag, noise_db } = e.data;
        // 후처리 예시: noise_db threshold, scene_tag 필터 등
        const packet = buildPacket({ mel, scene_tag, noise_db });
        // WebSocket 전송
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(packet));
        }
        // UI/로컬 큐 등 추가 처리 가능
        if (isActive) {
          // 예시: 콘솔 출력
          console.log('전송 패킷:', packet);
        }
      };

      // 마이크 스트림 연결
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(workletNode);
    }
    setup();

    return () => {
      isActive = false;
      if (audioContextRef.current) audioContextRef.current.close();
      if (workerRef.current) workerRef.current.terminate();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return <div>마이크 ML 파이프라인 동작 중...</div>;
}
