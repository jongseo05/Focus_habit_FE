import { useEffect, useRef, useState, useCallback } from 'react';

// ML 피쳐값 타입 정의 (음성 분석 결과)
interface MLFeatures {
  timestamp: number;
  text: string;
  is_study_related: boolean;
  confidence: number;
  context: string;
  analysis_method: 'GPT' | 'Keyword';
  processing_time: number;
}

export default function MicrophoneMLPipeline() {
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastFeatures, setLastFeatures] = useState<MLFeatures | null>(null);
  const [featuresHistory, setFeaturesHistory] = useState<MLFeatures[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [analysisCount, setAnalysisCount] = useState(0);

  // Speech Recognition API 가져오기
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  // ML 피쳐값을 데이터베이스에 저장
  const saveMLFeatures = async (features: MLFeatures) => {
    try {
      // 현재 활성 세션 ID 가져오기
      const sessionResponse = await fetch('/api/focus-session?active=true');
      
      if (!sessionResponse.ok) {
        return;
      }
      
      const sessionData = await sessionResponse.json();
      
      if (!sessionData.data || !sessionData.data.session_id) {
        return;
      }

      // send-study-status API를 통해 저장
      const response = await fetch('/api/send-study-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isStudy: features.is_study_related,
          confidence: features.confidence,
          context: features.context,
          text: features.text,
          timestamp: features.timestamp
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ML 피쳐값 저장 실패: ${response.status} ${errorText}`);
      }

      const result = await response.json();
    } catch (error) {
      // 에러 처리만 유지
    }
  };

  // GPT API를 통한 텍스트 분석 (실제 구현 시 fine-tuning된 모델 사용)
  const analyzeTextWithGPT = async (text: string): Promise<{
    is_study_related: boolean;
    confidence: number;
    context: string;
  }> => {
    try {
      // TODO: 실제 GPT fine-tuning API 호출로 교체
      // 현재는 시뮬레이션된 분석 결과 반환
      
      // 간단한 키워드 기반 분석 (임시)
      const studyKeywords = ['공부', '학습', '코딩', '프로그래밍', '과제', '시험', '책', '강의', '수업'];
      const studyKeywordCount = studyKeywords.filter(keyword => text.includes(keyword)).length;
      
      const is_study_related = studyKeywordCount > 0;
      const confidence = Math.min(0.5 + (studyKeywordCount * 0.1), 0.95);
      
      // 문맥 분석
      let context = 'unknown';
      if (text.includes('코딩') || text.includes('프로그래밍')) context = 'programming';
      else if (text.includes('공부') || text.includes('학습')) context = 'study';
      else if (text.includes('과제') || text.includes('시험')) context = 'assignment';
      else if (text.includes('책') || text.includes('강의')) context = 'reading';
      
      // 실제 GPT API 호출 시뮬레이션 (1초 지연)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { is_study_related, confidence, context };
    } catch (error) {
      // 오류 시 기본값 반환
      return { is_study_related: false, confidence: 0.5, context: 'unknown' };
    }
  };

  // 음성 인식 설정
  const setupSpeechRecognition = useCallback(() => {
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setLiveTranscript(interimTranscript);

      // 최종 텍스트가 충분히 길어지면 분석 시작
      if (finalTranscript.length > 10 && !isAnalyzing) {
        processSpeechText(finalTranscript);
        finalTranscript = '';
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // 자동 재시작
      if (recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current?.start();
          } catch (error) {
            // 에러 처리만 유지
          }
        }, 1000);
      }
    };

    try {
      recognition.start();
    } catch (error) {
      // 에러 처리만 유지
    }
  }, [isAnalyzing]);

  // 음성 텍스트 처리 및 분석
  const processSpeechText = async (text: string) => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    const startTime = performance.now();
    
    try {
      // GPT를 통한 텍스트 분석
      const analysisResult = await analyzeTextWithGPT(text);
      
      const features: MLFeatures = {
        timestamp: Date.now(),
        text: text,
        is_study_related: analysisResult.is_study_related,
        confidence: analysisResult.confidence,
        context: analysisResult.context,
        analysis_method: 'GPT',
        processing_time: performance.now() - startTime
      };

      // 결과 저장
      setLastFeatures(features);
      setFeaturesHistory(prev => [...prev, features]);
      setAnalysisCount(prev => prev + 1);
      
      // 데이터베이스에 저장
      await saveMLFeatures(features);
      
    } catch (error) {
      // 텍스트 분석 실패
    } finally {
      setIsAnalyzing(false);
    }
  };

  // CSV 내보내기 함수
  const exportToCSV = () => {
    if (featuresHistory.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const headers = [
      'Timestamp',
      'Text',
      'Is Study Related',
      'Confidence',
      'Context',
      'Analysis Method',
      'Processing Time (ms)'
    ];

    const csvData = featuresHistory.map(feature => [
      new Date(feature.timestamp).toISOString(),
      `"${feature.text}"`,
      feature.is_study_related ? 'Yes' : 'No',
      feature.confidence.toFixed(3),
      feature.context,
      feature.analysis_method,
      feature.processing_time.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ml-features-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 데이터 초기화 함수
  const clearData = () => {
    if (confirm('모든 ML 피쳐값 데이터를 삭제하시겠습니까?')) {
      setFeaturesHistory([]);
      setAnalysisCount(0);
      setLastFeatures(null);
    }
  };

  useEffect(() => {
    setupSpeechRecognition();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [setupSpeechRecognition]);

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">음성 ML 파이프라인</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 음성 인식 상태 */}
        <div>
          <h4 className="font-medium mb-2">음성 인식 상태</h4>
          <div className="space-y-2">
            <div className="p-3 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-600">음성 인식 상태</div>
              <div className={`font-medium ${isListening ? 'text-green-600' : 'text-red-600'}`}>
                {isListening ? '듣는 중' : '듣지 않음'}
              </div>
            </div>
            
            <div className="p-3 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-600">분석 횟수</div>
              <div className="font-medium">{analysisCount}</div>
            </div>

            <div className="p-3 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-600">실시간 텍스트</div>
              <div className="text-xs text-gray-600 min-h-[20px]">
                {liveTranscript || '음성을 기다리는 중...'}
              </div>
            </div>

            <div className="p-3 bg-gray-100 rounded-lg">
              <div className="text-sm text-gray-600">분석 상태</div>
              <div className={`font-medium ${isAnalyzing ? 'text-blue-600' : 'text-gray-600'}`}>
                {isAnalyzing ? '분석 중...' : '대기 중'}
              </div>
            </div>
          </div>
        </div>

        {/* ML 분석 결과 */}
        <div>
          <h4 className="font-medium mb-2">ML 분석 결과</h4>
          <div className="space-y-2">
            {lastFeatures && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium text-blue-800">분석된 텍스트</div>
                  <div className="text-xs text-blue-600">
                    &quot;{lastFeatures.text}&quot;
                  </div>
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-sm font-medium text-green-800">공부 관련 여부</div>
                  <div className={`text-xs font-medium ${lastFeatures.is_study_related ? 'text-green-600' : 'text-red-600'}`}>
                    {lastFeatures.is_study_related ? '✅ 공부 관련' : '❌ 공부 관련 아님'}
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm font-medium text-purple-800">신뢰도</div>
                  <div className="text-xs text-purple-600">
                    {(lastFeatures.confidence * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm font-medium text-orange-800">문맥</div>
                  <div className="text-xs text-orange-600">
                    {lastFeatures.context}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-800">분석 시간</div>
                  <div className="text-xs text-gray-600">
                    {lastFeatures.processing_time.toFixed(2)}ms
                  </div>
                </div>
              </div>
            )}

            {/* 내보내기 버튼들 */}
            <div className="flex space-x-2 mt-4">
              <button
                onClick={exportToCSV}
                disabled={featuresHistory.length === 0}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                CSV 내보내기
              </button>
              <button
                onClick={clearData}
                disabled={featuresHistory.length === 0}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                데이터 초기화
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
