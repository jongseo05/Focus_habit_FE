// ml-inference-worker.js
// ML 추론을 위한 Web Worker

self.onmessage = async function(e) {
  const { pcm } = e.data;
  if (!pcm) return;

  // 1. STFT/Mel 변환 (샘플: 단순 평균값으로 대체)
  const mel = Array(64).fill(0).map((_, i) => {
    const bandSize = Math.floor(pcm.length / 64);
    const band = pcm.slice(i * bandSize, (i + 1) * bandSize);
    return band.reduce((a, b) => a + b, 0) / band.length;
  });

  // mel[0] 값과 mel 전체의 max값 로그
  console.log('[WORKER] mel[0] 값:', mel[0], 'mel max:', Math.max(...mel));

  // 2. ML 추론 (샘플: softmax, scene_tag, noise_db 등)
  // 임계값을 mel 전체의 max값으로 판단
  const melMax = Math.max(...mel);
  const scene_tag = melMax > 0.001 ? 'speech' : 'noise';
  const noise_db = melMax * 10;

  // 3. 결과 반환
  self.postMessage({ mel, scene_tag, noise_db });
};
