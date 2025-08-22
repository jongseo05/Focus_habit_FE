#!/bin/bash

echo "데이터베이스 마이그레이션을 시작합니다..."

# Supabase 마이그레이션 실행
echo "1. Supabase 마이그레이션 실행 중..."
npx supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "마이그레이션이 성공적으로 완료되었습니다!"
    echo ""
    echo "변경사항:"
    echo "- eye_status 컬럼이 문자열 타입으로 변경되었습니다"
    echo "- 기존 numeric 데이터가 OPEN/CLOSED로 변환되었습니다"
    echo "- 새로운 제약조건이 추가되어 OPEN/CLOSED 값만 허용됩니다"
else
    echo "마이그레이션 실행 중 오류가 발생했습니다."
    exit 1
fi

