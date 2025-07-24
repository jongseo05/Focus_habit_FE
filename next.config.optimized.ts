import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 실험적 기능 활성화
  experimental: {
    // React 서버 컴포넌트 최적화
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-select',
      '@radix-ui/react-dialog',
      '@radix-ui/react-progress',
    ],
    // 프리로딩 최적화
    optimizeCss: true,
    // Tree shaking 최적화
    scrollRestoration: true,
  },

  // 컴파일러 최적화
  compiler: {
    // 프로덕션에서 console 제거
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },

  // 이미지 최적화
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1년
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Webpack 최적화
  webpack: (config, { dev, isServer }) => {
    // 프로덕션 빌드 최적화
    if (!dev && !isServer) {
      // Bundle analyzer 설정 (선택적)
      if (process.env.ANALYZE === 'true') {
        const withBundleAnalyzer = require('@next/bundle-analyzer')({
          enabled: true,
        })
        config = withBundleAnalyzer(config)
      }

      // Tree shaking 최적화
      config.optimization = {
        ...config.optimization,
        sideEffects: false,
        usedExports: true,
        // Chunk 분할 최적화
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // 벤더 라이브러리 분리
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            // UI 컴포넌트 분리
            ui: {
              test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
              name: 'ui-components',
              chunks: 'all',
              priority: 20,
            },
            // 훅과 유틸리티 분리
            utils: {
              test: /[\\/]src[\\/](hooks|lib|utils)[\\/]/,
              name: 'utils',
              chunks: 'all',
              priority: 15,
            },
            // 상태 관리 분리
            store: {
              test: /[\\/]src[\\/]stores[\\/]/,
              name: 'store',
              chunks: 'all',
              priority: 25,
            },
          },
        },
      }
    }

    // 개발 환경 최적화
    if (dev) {
      // 빠른 리프레시 최적화
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }

    return config
  },

  // 헤더 최적화
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 보안 헤더
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          // 성능 최적화 헤더
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          // 정적 리소스 캐싱
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // PWA 설정 (선택적)
  ...(process.env.ENABLE_PWA === 'true' && {
    pwa: {
      dest: 'public',
      disable: process.env.NODE_ENV === 'development',
      register: true,
      skipWaiting: true,
    },
  }),
}

export default nextConfig
