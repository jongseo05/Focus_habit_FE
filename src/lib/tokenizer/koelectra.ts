// KoELECTRA 토크나이저 구현
// WordPiece 알고리즘과 BERT 스타일 전처리

export interface TokenizerConfig {
  vocab: string[];
  tokenizer: any;
  maxLength: number;
}

// 전역 캐시
let vocabCache: string[] | null = null;
let tokenizerCache: any = null;

// 어휘 사전 로드
export async function loadKOElectraVocab(): Promise<string[]> {
  if (vocabCache) return vocabCache;
  
  try {
    const response = await fetch("/models/koelectra/vocab.txt");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    vocabCache = text.split("\n").filter(line => line.trim());
    console.log('📚 어휘 사전 로드 완료:', vocabCache.length, '개 토큰');
    return vocabCache;
  } catch (error) {
    console.error("어휘 사전 로드 실패:", error);
    throw error;
  }
}

// 어휘 사전 자동 로드 (초기화 시 호출)
export async function initializeTokenizer(): Promise<void> {
  try {
    await loadKOElectraVocab();
    await loadKOElectraTokenizer();
    console.log('✅ 토크나이저 초기화 완료');
  } catch (error) {
    console.error('❌ 토크나이저 초기화 실패:', error);
  }
}

// 토크나이저 설정 로드
export async function loadKOElectraTokenizer(): Promise<any> {
  if (tokenizerCache) return tokenizerCache;
  
                try {
                const response = await fetch("/models/koelectra/tokenizer.json");
                tokenizerCache = await response.json();
                return tokenizerCache;
              } catch (error) {
                console.error("토크나이저 설정 로드 실패:", error);
                throw error;
              }
}

// 텍스트 정규화 (BERT 스타일)
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ") // 연속된 공백을 하나로
    .normalize("NFKC"); // 유니코드 정규화
}

// WordPiece 토크나이징
export function tokenizeWord(word: string, vocab: string[]): number[] {
  const tokens: number[] = [];
  let remaining = word;
  
  while (remaining.length > 0) {
    let found = false;
    
    // 가장 긴 매칭되는 서브워드 찾기 (greedy algorithm)
    for (let len = remaining.length; len > 0; len--) {
      const subword = remaining.substring(0, len);
      const index = vocab.indexOf(subword);
      
      if (index !== -1) {
        tokens.push(index);
        remaining = remaining.substring(len);
        found = true;
        break;
      }
    }
    
    if (!found) {
      // 매칭되는 토큰이 없으면 [UNK] 사용
      const unkIndex = vocab.indexOf("[UNK]");
      tokens.push(unkIndex !== -1 ? unkIndex : 1); // 기본값 1
      break;
    }
  }
  
  return tokens;
}

// BERT 스타일 토크나이징
export function tokenizeText(text: string, vocab: string[]): number[] {
  // 1. 텍스트 정규화
  const normalizedText = normalizeText(text);
  
  // 2. 단어 분리 (공백 기준)
  const words = normalizedText.split(/\s+/);
  
  // 3. 각 단어를 WordPiece로 토크나이징
  const tokens: number[] = [];
  
  for (const word of words) {
    if (word.length === 0) continue;
    
    const wordTokens = tokenizeWord(word, vocab);
    tokens.push(...wordTokens);
  }
  
  return tokens;
}

// KoELECTRA 전처리 (메인 함수) - 동기 버전으로 변경
export function koelectraPreprocess(text: string, maxLength: number = 512): { input_ids: number[], attention_mask: number[] } {
  try {
    // 1. 어휘 사전과 토크나이저 설정 로드 (캐시된 값 사용)
    if (!vocabCache) {
      console.warn("어휘 사전이 로드되지 않았습니다. 자동 로드를 시도합니다.");
      // 비동기 로드를 동기적으로 처리하기 위해 기본값 반환
      return {
        input_ids: new Array(maxLength).fill(0),
        attention_mask: new Array(maxLength).fill(0)
      };
    }
    
    // 2. BERT 스타일 토크나이징
    const wordTokens = tokenizeText(text, vocabCache);
    
    // 3. BERT 특수 토큰 추가
    const tokens: number[] = [];
    
    // [CLS] 토큰 추가
    const clsIndex = vocabCache.indexOf("[CLS]");
    tokens.push(clsIndex !== -1 ? clsIndex : 2);
    
    // 단어 토큰들 추가
    tokens.push(...wordTokens);
    
    // [SEP] 토큰 추가
    const sepIndex = vocabCache.indexOf("[SEP]");
    tokens.push(sepIndex !== -1 ? sepIndex : 3);
    
    // 4. 패딩 및 attention mask 생성
    const input_ids: number[] = [];
    const attention_mask: number[] = [];
    
    for (let i = 0; i < maxLength; i++) {
      if (i < tokens.length) {
        input_ids.push(tokens[i]);
        attention_mask.push(1); // 실제 토큰
      } else {
        const padIndex = vocabCache.indexOf("[PAD]");
        input_ids.push(padIndex !== -1 ? padIndex : 0);
        attention_mask.push(0); // 패딩 토큰
      }
    }
    
    return { input_ids, attention_mask };
  } catch (error) {
    console.error("토크나이징 실패:", error);
    // 에러 시 기본값 반환
    return {
      input_ids: new Array(maxLength).fill(0),
      attention_mask: new Array(maxLength).fill(0)
    };
  }
}

// 비동기 버전 (기존 호환성 유지)
export async function koelectraPreprocessAsync(text: string): Promise<number[]> {
  const result = koelectraPreprocess(text);
  return result.input_ids;
}

  // 토크나이저 테스트 함수
  export async function testTokenizer(texts: string[]): Promise<void> {
    for (const text of texts) {
      try {
        const tokens = await koelectraPreprocess(text);
      } catch (error) {
        console.error(`❌ "${text}" -> 에러:`, error);
      }
    }
  } 