import OpenAI from "openai"
import { NextResponse } from "next/server"
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleAPIError
} from '../../../lib/api/standardResponse'

// OpenAI API 키가 있을 때만 클라이언트 초기화
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

export async function POST(req: Request) {
  try {
    const { transcript } = await req.json()

    if (!transcript || typeof transcript !== 'string') {
      return createErrorResponse(
        '발화 텍스트가 필요합니다.',
        400
      )
    }

    // OpenAI API 키가 없으면 키워드 기반 분석만 사용
    if (!openai) {
      const isStudyRelated = analyzeStudyRelatedByKeywords(transcript)
      return createSuccessResponse(
        {
          isStudyRelated: isStudyRelated,
          confidence: 0.5,
          reasoning: '키워드 기반 분석 (OpenAI API 키 없음)',
          method: 'keyword_only',
          transcript: transcript
        },
        '키워드 기반으로 발화를 분석했습니다.'
      )
    }

    const prompt = `
다음은 음성 인식된 발화 텍스트입니다. 이 발화가 공부/학습과 관련된 것이라면 'study', 아니라면 'no_study'로만 응답해.

공부 관련 발화의 예시:
- 공부, 학습, 수업, 문제, 책 읽기, 쓰기, 계산, 공식, 이론
- 시험, 과제, 프로젝트, 리포트, 논문, 연구, 분석, 실험
- 강의, 교과서, 참고서, 문제집, 연습, 복습, 예습
- 질문, 토론, 발표, 발표 자료, 발표 내용
- 기타, 기록, 메모, 정리, 요약, 복습, 예습

공부와 관련없는 발화의 예시:
- 일상적인 대화, 잡담
- 게임, 영화, 음악, 엔터테인먼트
- 개인적인 일상, 가족, 친구

정확히 'study' 또는 'no_study' 중 하나로만 응답해야 합니다.

발화: "${transcript}"
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 10,
    })

    const result = completion.choices[0].message.content?.trim()
    
    if (result !== 'study' && result !== 'no_study') {
      console.error('GPT 응답이 예상 형식과 다름:', result)
      const isStudyRelated = analyzeStudyRelatedByKeywords(transcript)
      return createSuccessResponse(
        {
          isStudyRelated: isStudyRelated,
          confidence: 0.5,
          reasoning: '키워드 기반 분석 (GPT 응답 형식 오류)',
          method: 'keyword_fallback',
          original_gpt_response: result
        },
        'GPT 오류로 키워드 기반 분석을 사용했습니다.'
      )
    }

    return createSuccessResponse(
      {
        isStudyRelated: result === 'study',
        confidence: 0.9,
        reasoning: result === 'study' ? 'GPT 분석: 공부 관련 발화' : 'GPT 분석: 공부와 무관한 발화',
        method: 'gpt',
        transcript: transcript
      },
      'GPT로 발화를 성공적으로 분석했습니다.'
    )

  } catch (error) {
    console.error('GPT 발화분석 API 오류:', error)
    
    try {
      const { transcript } = await req.json()
      const isStudyRelated = analyzeStudyRelatedByKeywords(transcript)
      
      return createSuccessResponse(
        {
          isStudyRelated: isStudyRelated,
          confidence: 0.5,
          reasoning: '키워드 기반 분석 (GPT API 호출 실패)',
          method: 'keyword_fallback',
          error: 'GPT API 호출 실패'
        },
        'GPT 오류로 키워드 기반 분석을 사용했습니다.'
      )
    } catch (fallbackError) {
      return handleAPIError(fallbackError, '발화 분석 폴백')
    }
  }
}

function analyzeStudyRelatedByKeywords(text: string): boolean {
  const studyKeywords = [
    "공부", "학습", "수업", "문제", "책", "읽기", "쓰기", "계산", "공식", "이론",
    "시험", "과제", "프로젝트", "리포트", "논문", "연구", "분석", "실험",
    "강의", "교과서", "참고서", "문제집", "연습", "복습", "예습",
    "질문", "토론", "발표", "발표 자료", "발표 내용",
    "기타", "기록", "메모", "정리", "요약", "복습", "예습"
  ]
  
  const lowerText = text.toLowerCase()
  return studyKeywords.some(keyword => lowerText.includes(keyword))
}

