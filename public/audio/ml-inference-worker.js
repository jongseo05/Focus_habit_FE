// ml-inference-worker.js
// Web Worker: PCM -> STFT/Mel -> ML 추론 (샘플)
// 실제 모델 추론은 WASM/ONNX/TFLite로 교체 예정

self.onmessage = async function(e) {
  const { pcm } = e.data;
  if (!pcm) return;

  // 1. STFT/Mel 변환 (샘플: 단순 평균값으로 대체)
  // 실제 구현 시 WASM/라이브러리 사용
  const mel = Array(64).fill(0).map((_, i) => {
    const bandSize = Math.floor(pcm.length / 64);
    const band = pcm.slice(i * bandSize, (i + 1) * bandSize);
    return band.reduce((a, b) => a + b, 0) / band.length;
  });

  // 2. ML 추론 (샘플: softmax, scene_tag, noise_db 등)
  // 실제 구현 시 WASM/ONNX/TFLite 모델 사용
  const scene_tag = mel[0] > 0.1 ? 'speech' : 'noise';
  const noise_db = Math.max(...mel) * 10;

  // 3. 결과 반환
  self.postMessage({ mel, scene_tag, noise_db });
};
