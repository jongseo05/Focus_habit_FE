// stft-mel-processor.js
// AudioWorkletProcessor: 실시간 STFT + Log-Mel 변환 (64 Mel, 96 frame)
// window: 1초, hop: 512ms, 16kHz mono 입력

class StftMelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleRate = 16000;
    this.windowSize = 16000; // 1초
    this.hopSize = 8192; // 512ms
    this.melBands = 64;
    this.frameCount = 96;

    // GC 부담을 줄이기 위해 TypedArray와 오프셋 기반 버퍼 사용
    // windowSize + 최대 입력 프레임 크기(128)를 고려하여 여유 공간 확보
    this._buffer = new Float32Array(this.windowSize + 128);
    this._bufferOffset = 0; // 버퍼에 데이터가 채워진 위치

    // TODO: FFT, Mel 필터 구현 또는 WASM/Worker로 위임
  }

  process(inputs, outputs, parameters) {
    const inputChannel = inputs[0][0];
    if (!inputChannel) {
      return true;
    }

    // 입력 데이터를 버퍼에 복사
    this._buffer.set(inputChannel, this._bufferOffset);
    this._bufferOffset += inputChannel.length;

    // 윈도우 크기만큼 쌓이면 처리
    while (this._bufferOffset >= this.windowSize) {
      // 새로운 배열을 생성하지 않고 버퍼의 일부를 참조 (subarray)
      const windowed = this._buffer.subarray(0, this.windowSize);

      // FFT/Mel 변환은 Web Worker(WASM)에서 처리
      // postMessage는 데이터를 복사하므로, 전송할 데이터만 복사
      this.port.postMessage({ pcm: windowed.slice() });

      // 홉 크기만큼 버퍼를 앞으로 당김 (메모리 재할당 없음)
      const remaining = this._buffer.subarray(this.hopSize, this._bufferOffset);
      this._buffer.set(remaining, 0);
      this._bufferOffset = remaining.length;
    }
    return true;
  }
}

registerProcessor('stft-mel-processor', StftMelProcessor);
