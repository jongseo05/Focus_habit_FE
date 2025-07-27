import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack 설정
  turbopack: {
    rules: {
      // Worker 파일을 정적 자산으로 처리
      '*.worker.js': {
        loaders: ['asset'],
        as: '*.js',
      },
      // ml-inference-worker.js 파일 처리
      '**/ml-inference-worker.js': {
        loaders: ['asset'],
        as: '*.js',
      },
    },
  },
  // Worker 파일을 public 폴더에서 제공
  async headers() {
    return [
      {
        source: '/audio/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      // ONNX Runtime WASM 파일들을 위한 CORS 설정
      {
        source: '/_next/static/chunks/pages/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
      // WASM 파일들을 위한 MIME 타입 설정
      {
        source: '/ort-wasm-simd-threaded.wasm',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
        ],
      },
      {
        source: '/ort-wasm-simd-threaded.jsep.wasm',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
        ],
      },
      {
        source: '/ort-wasm-simd-threaded.mjs',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
      {
        source: '/ort-wasm-simd-threaded.jsep.mjs',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
