'use client'

import { useEffect, useState } from 'react'
import { useKoELECTRA } from '@/hooks/useKoELECTRA'
import { initializeTokenizer, koelectraPreprocess } from '@/lib/tokenizer/koelectra'

export default function TestKoELECTRAPage() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [isTesting, setIsTesting] = useState(false)
  
  const { 
    isLoaded, 
    isLoading, 
    error, 
    loadModel, 
    inference,
    modelInfo 
  } = useKoELECTRA({ 
    autoLoad: false,
    config: {
      modelPath: '/models/koelectra/koelectra.onnx',
      maxLength: 512,
      batchSize: 1,
      enableCache: true,
      cacheSize: 100,
      enableBatching: false
    }
  })

  const addLog = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  // ONNX.js 초기화 테스트
  const testONNXInitialization = async () => {
    addLog('ONNX.js 초기화 테스트 시작...')
    
    try {
      // 브라우저 환경 확인
      if (typeof window !== 'undefined') {
        addLog('✅ 브라우저 환경 확인됨')
        
        // 동적 import 테스트
        addLog('동적 import 테스트 시작...')
        try {
          const onnxModule = await import('onnxruntime-web')
          addLog('✅ onnxruntime-web 모듈 import 성공')
          addLog(`ONNX Runtime 버전: ${(onnxModule as any).version || '알 수 없음'}`)
          
          // 환경 설정 테스트
          addLog('ONNX Runtime 환경 설정 테스트...')
          onnxModule.env.wasm.numThreads = 1
          onnxModule.env.wasm.simd = true
          onnxModule.env.wasm.wasmPaths = '/'
          addLog('✅ ONNX Runtime 환경 설정 완료')
          
        } catch (importError) {
          addLog(`❌ onnxruntime-web 모듈 import 실패: ${importError}`)
        }
        
        // 전역 객체 확인
        if ((window as any).ort) {
          addLog('✅ ONNX Runtime Web이 전역에서 사용 가능함')
          addLog(`ONNX Runtime 버전: ${(window as any).ort.version}`)
        } else {
          addLog('⚠️ ONNX Runtime Web이 전역에서 사용 불가능함 (동적 import 사용)')
        }
        
        // transformers.js 확인 (사용하지 않음)
        if ((window as any).transformers) {
          addLog('✅ Transformers.js가 전역에서 사용 가능함')
        } else {
          addLog('⚠️ Transformers.js가 전역에서 사용 불가능함 (직접 구현 사용)')
        }
      } else {
        addLog('❌ 브라우저 환경이 아님')
      }
    } catch (error) {
      addLog(`❌ ONNX 초기화 테스트 실패: ${error}`)
    }
  }

  // 모델 파일 존재 확인
  const testModelFiles = async () => {
    addLog('모델 파일 존재 확인 시작...')
    
    const files = [
      '/models/koelectra/koelectra.onnx',
      '/models/koelectra/tokenizer.json',
      '/models/koelectra/vocab.txt'
    ]
    
    for (const file of files) {
      try {
        const response = await fetch(file, { method: 'HEAD' })
        if (response.ok) {
          addLog(`✅ ${file} - 존재함 (${response.headers.get('content-length')} bytes)`)
        } else {
          addLog(`❌ ${file} - 존재하지 않음 (${response.status})`)
        }
      } catch (error) {
        addLog(`❌ ${file} - 확인 실패: ${error}`)
      }
    }
  }

  // 토크나이저 테스트
  const testTokenizer = async () => {
    addLog('토크나이저 테스트 시작...')
    
    try {
      addLog('토크나이저 초기화 시도...')
      await initializeTokenizer()
      addLog('✅ 토크나이저 초기화 성공')
      
      // 간단한 토크나이징 테스트
      const testText = '안녕하세요 테스트입니다.'
      addLog(`토크나이징 테스트: "${testText}"`)
      
      const result = koelectraPreprocess(testText, 512)
      addLog(`✅ 토크나이징 성공 - input_ids 길이: ${result.input_ids.length}, attention_mask 길이: ${result.attention_mask.length}, token_type_ids 길이: ${result.token_type_ids.length}`)
      addLog(`   input_ids 샘플: [${result.input_ids.slice(0, 10).join(', ')}...]`)
      addLog(`   attention_mask 샘플: [${result.attention_mask.slice(0, 10).join(', ')}...]`)
      addLog(`   token_type_ids 샘플: [${result.token_type_ids.slice(0, 10).join(', ')}...]`)
      
    } catch (error) {
      addLog(`❌ 토크나이저 테스트 실패: ${error}`)
    }
  }

  // 모델 로딩 테스트
  const testModelLoading = async () => {
    addLog('모델 로딩 테스트 시작...')
    
    if (isLoaded) {
      addLog('✅ 모델이 이미 로드됨')
      return
    }
    
    if (isLoading) {
      addLog('⏳ 모델이 로딩 중...')
      return
    }
    
    try {
      addLog('1단계: useKoELECTRA 훅을 통한 모델 로드 시도...')
      await loadModel()
      addLog('✅ 모델 로드 성공')
    } catch (error) {
      addLog(`❌ 모델 로드 실패: ${error}`)
      
      // 직접 테스트
      addLog('2단계: 직접 모델 로드 테스트...')
      try {
        const onnxModule = await import('onnxruntime-web')
        addLog('✅ onnxruntime-web 모듈 로드 성공')
        
        // 모델 파일 직접 로드 테스트
        const modelResponse = await fetch('/models/koelectra/koelectra.onnx')
        if (modelResponse.ok) {
          addLog('✅ 모델 파일 접근 성공')
          addLog(`모델 파일 크기: ${modelResponse.headers.get('content-length')} bytes`)
          
          // InferenceSession 생성 테스트
          addLog('InferenceSession 생성 테스트...')
          const session = await onnxModule.InferenceSession.create('/models/koelectra/koelectra.onnx')
          addLog('✅ InferenceSession 생성 성공')
          addLog(`입력 이름: ${session.inputNames.join(', ')}`)
          addLog(`출력 이름: ${session.outputNames.join(', ')}`)
          
        } else {
          addLog(`❌ 모델 파일 접근 실패: ${modelResponse.status}`)
        }
      } catch (directError) {
        addLog(`❌ 직접 모델 로드 테스트 실패: ${directError}`)
      }
    }
  }

  // 추론 테스트
  const testInference = async () => {
    addLog('추론 테스트 시작...')
    addLog(`현재 모델 상태: isLoaded=${isLoaded}, isLoading=${isLoading}, error=${error}`)
    
    // 직접 추론 시도 (React 상태와 관계없이)
    addLog('직접 추론 시도...')
    
    const testTexts = [
      '공부를 열심히 하고 있습니다.',
      '게임을 하고 있습니다.',
      '음악을 듣고 있습니다.'
    ]
    
    for (const text of testTexts) {
      try {
        addLog(`추론 중: "${text}"`)
        
        // useKoELECTRA 훅의 inference 함수 사용
        const result = await inference(text)
        
        if (result) {
          addLog(`✅ 추론 성공 - 신뢰도: ${result.confidence.toFixed(4)}, 처리시간: ${result.processingTime.toFixed(2)}ms`)
          addLog(`   로짓 값: [${Array.from(result.logits).map(v => v.toFixed(4)).join(', ')}]`)
        } else {
          addLog(`❌ 추론 실패 - 결과가 null`)
          
          // 직접 모델 인스턴스에 접근 시도
          addLog('직접 모델 인스턴스 접근 시도...')
          try {
            const { createKoELECTRA } = await import('@/lib/ml/koelectra-inference')
            const model = createKoELECTRA()
            
            if (model.isLoaded) {
              addLog('✅ 직접 모델 인스턴스에서 로드됨 확인')
              const directResult = await model.inference(text)
              addLog(`✅ 직접 추론 성공 - 신뢰도: ${directResult.confidence.toFixed(4)}`)
            } else {
              addLog('❌ 직접 모델 인스턴스도 로드되지 않음')
            }
          } catch (directError) {
            addLog(`❌ 직접 모델 접근 실패: ${directError}`)
          }
        }
      } catch (error) {
        addLog(`❌ 추론 실패: ${error}`)
        addLog(`오류 상세: ${error instanceof Error ? error.stack : String(error)}`)
      }
    }
  }

  // 전체 테스트 실행
  const runAllTests = async () => {
    setIsTesting(true)
    setTestResults([])
    
    addLog('=== KoELECTRA 모델 테스트 시작 ===')
    
    await testONNXInitialization()
    await testModelFiles()
    await testTokenizer()
    await testModelLoading()
    
    // 모델 로드 완료 대기 (React 상태 업데이트 대기)
    addLog('모델 로드 완료 대기 중...')
    let waitCount = 0
    while (!isLoaded && waitCount < 15) { // 대기 시간 증가
      await new Promise(resolve => setTimeout(resolve, 500)) // 더 짧은 간격으로 체크
      waitCount++
      addLog(`대기 중... (${waitCount}/15) - isLoaded: ${isLoaded}, isLoading: ${isLoading}`)
    }
    
    if (isLoaded) {
      addLog('✅ 모델 로드 완료 확인됨')
      await testInference()
    } else {
      addLog('❌ 모델 로드가 완료되지 않았습니다.')
      addLog('콘솔에서 모델 로드 상태를 확인해보세요.')
    }
    
    addLog('=== 테스트 완료 ===')
    setIsTesting(false)
  }

  // 상태 변화 모니터링
  useEffect(() => {
    addLog(`모델 상태 변화: isLoaded=${isLoaded}, isLoading=${isLoading}, error=${error}`)
  }, [isLoaded, isLoading, error])

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">KoELECTRA 모델 테스트</h1>
      
      {/* 현재 상태 */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-2">현재 상태</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>모델 로드됨:</strong> {isLoaded ? '✅' : '❌'}</p>
            <p><strong>로딩 중:</strong> {isLoading ? '⏳' : '❌'}</p>
            <p><strong>오류:</strong> {error || '없음'}</p>
          </div>
          <div>
            <p><strong>입력 이름:</strong> {modelInfo?.inputNames?.join(', ') || '알 수 없음'}</p>
            <p><strong>출력 이름:</strong> {modelInfo?.outputNames?.join(', ') || '알 수 없음'}</p>
          </div>
        </div>
      </div>
      
      {/* 테스트 버튼들 */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={runAllTests}
          disabled={isTesting}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isTesting ? '테스트 중...' : '전체 테스트 실행'}
        </button>
        
        <button 
          onClick={testONNXInitialization}
          disabled={isTesting}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
        >
          ONNX 초기화 테스트
        </button>
        
        <button 
          onClick={testModelFiles}
          disabled={isTesting}
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:bg-gray-400"
        >
          파일 존재 확인
        </button>
        
        <button 
          onClick={testTokenizer}
          disabled={isTesting}
          className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:bg-gray-400"
        >
          토크나이저 테스트
        </button>
        
        <button 
          onClick={testModelLoading}
          disabled={isTesting}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-400"
        >
          모델 로딩 테스트
        </button>
        
        <button 
          onClick={testInference}
          disabled={isTesting || !isLoaded}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
        >
          추론 테스트
        </button>
      </div>
      
      {/* 테스트 결과 */}
      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-2 text-white">테스트 로그</h2>
        {testResults.length === 0 ? (
          <p className="text-gray-500">테스트를 실행하면 결과가 여기에 표시됩니다.</p>
        ) : (
          testResults.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  )
} 