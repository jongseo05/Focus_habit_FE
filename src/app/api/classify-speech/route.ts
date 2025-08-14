import OpenAI from "openai"
import { NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 환경변수에서 API 키 가져오기
})

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ 
        error: "텍스트가 제공되지 않았습니다." 
      }, { status: 400 })
    }

    const prompt = `
너는 한국어 문장을 분석해서, 이 문장이 공부/학습과 관련 있으면 'study', 아니면 'no_study'로만 대답해.

공부 관련의 예시:
- 수업, 강의, 과제, 시험, 문제 풀이 관련 대화
- 학습 자료, 교과서, 참고서 내용 읽기
- 학습 계획, 복습, 예습 관련 언급
- 수학, 영어, 과학 등 과목별 학습 내용
- 연구, 분석, 실험, 이론 관련 내용
- 토론, 발표, 질문/답변 (학습 맥락에서)
- 집중력, 학습 방법 등에 대한 고민

공부와 관련 없는 예시:
- 일상 대화, 잡담
- 게임, 오락, 취미 관련 대화
- 음식, 날씨, 가족 등 일상 생활
- 감정 표현 (학습과 무관한)
- 단순한 인사, 반응어

다른 설명이나 부연 없이 'study' 또는 'no_study' 중 하나만 출력해야 한다.

문장: "${text}"
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0, // 일관된 결과를 위해 0으로 설정
      max_tokens: 10, // 짧은 응답만 필요
    })

    const result = completion.choices[0].message.content?.trim()
    
    // 결과 검증
    if (result !== 'study' && result !== 'no_study') {
      console.error('GPT 응답이 예상 형식과 다름:', result)
      // fallback으로 키워드 기반 분석 결과 반환
      const isStudyRelated = analyzeStudyRelatedByKeywords(text)
      return NextResponse.json({
        label: isStudyRelated ? 'study' : 'no_study',
        confidence: 0.5, // 낮은 신뢰도로 표시
        method: 'keyword_fallback',
        original_gpt_response: result
      })
    }

    return NextResponse.json({
      label: result,
      confidence: 0.9, // GPT 결과에 대한 높은 신뢰도
      method: 'gpt',
      text: text
    })

  } catch (error) {
    console.error('GPT 분류 API 오류:', error)
    
    // 에러 발생 시 키워드 기반 fallback
    try {
      const { text } = await req.json()
      const isStudyRelated = analyzeStudyRelatedByKeywords(text)
      
      return NextResponse.json({
        label: isStudyRelated ? 'study' : 'no_study',
        confidence: 0.5,
        method: 'keyword_fallback',
        error: 'GPT API 호출 실패'
      })
    } catch (fallbackError) {
      return NextResponse.json({ 
        error: "분류 처리 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }
  }
}

// 키워드 기반 분석 함수 (fallback용)
function analyzeStudyRelatedByKeywords(text: string): boolean {
  const studyKeywords = [
    "공부", "학습", "수업", "문제", "책", "읽기", "쓰기", "계산", "공식", "이론",
    "시험", "과제", "프로젝트", "리포트", "논문", "연구", "분석", "실험",
    "강의", "교과서", "참고서", "문제집", "연습", "복습", "예습",
    "수학", "영어", "과학", "역사", "국어", "물리", "화학", "생물",
    "토론", "발표", "질문", "답변", "설명", "정리", "요약",
    "집중", "암기", "이해", "풀이", "해결", "방법", "원리"
  ]
  
  const lowerText = text.toLowerCase()
  return studyKeywords.some(keyword => lowerText.includes(keyword))
}