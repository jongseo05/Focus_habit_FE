# Focus Habit Frontend

포커스 습관 관리 웹 애플리케이션입니다. Next.js 14, TypeScript, Tailwind CSS를 사용하여 구축되었으며, ONNX Runtime을 통한 KoELECTRA 모델 추론 기능을 포함합니다.

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase
- **Authentication**: Supabase Auth
- **State Management**: Zustand
- **Real-time**: WebSocket
- **ML/AI**: ONNX.js (KoELECTRA)

## 주요 기능

- 🔐 사용자 인증 및 권한 관리
- 📊 집중 세션 모니터링
- 🎯 제스처 인식 및 실시간 분석
- 🤖 KoELECTRA 모델을 통한 텍스트 분석
- 📈 대시보드 및 통계
- 🔄 실시간 데이터 동기화

## 시작하기

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

## KoELECTRA 모델 사용법

### 기본 사용법

```typescript
import { useKoELECTRA } from '@/hooks/useKoELECTRA'

function MyComponent() {
  const { 
    isLoaded, 
    isLoading, 
    error, 
    inference 
  } = useKoELECTRA({ autoLoad: true })

  const handleAnalysis = async (text: string) => {
    if (!isLoaded) return
    
    try {
      const result = await inference(text)
      console.log('신뢰도:', result.confidence)
      console.log('처리 시간:', result.processingTime)
    } catch (err) {
      console.error('추론 실패:', err)
    }
  }

  return (
    <div>
      {isLoading && <p>모델 로딩 중...</p>}
      {error && <p>에러: {error}</p>}
      {isLoaded && <button onClick={() => handleAnalysis('분석할 텍스트')}>
        분석하기
      </button>}
    </div>
  )
}
```

### 배치 처리

```typescript
const { batchInference } = useKoELECTRA({ autoLoad: true })

const analyzeMultipleTexts = async (texts: string[]) => {
  const results = await batchInference(texts)
  return results.map(result => ({
    confidence: result.confidence,
    processingTime: result.processingTime
  }))
}
```

### 성능 모니터링

```typescript
const { 
  inference, 
  lastInferenceTime, 
  totalInferences 
} = useKoELECTRA({ autoLoad: true })

// 성능 통계 확인
console.log('마지막 추론 시간:', lastInferenceTime)
console.log('총 추론 횟수:', totalInferences)
```

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router 페이지
├── components/             # 재사용 가능한 컴포넌트
├── hooks/                  # 커스텀 훅
│   ├── useKoELECTRA.ts    # KoELECTRA 모델 훅
│   └── ...
├── lib/                    # 유틸리티 및 설정
│   ├── ml/                # ML 관련 라이브러리
│   │   └── koelectra-inference.ts
│   ├── tokenizer/         # 토크나이저
│   │   └── koelectra.ts
│   └── ...
├── stores/                 # Zustand 스토어
└── types/                  # TypeScript 타입 정의
```

## 배포

### Vercel 배포

가장 쉬운 방법은 [Vercel Platform](https://vercel.com/new)을 사용하는 것입니다.

### 환경 변수 설정

배포 시 다음 환경 변수들을 설정하세요:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
