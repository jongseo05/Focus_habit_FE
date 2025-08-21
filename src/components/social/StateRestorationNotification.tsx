// =====================================================
// 상태 복원 알림 컴포넌트
// =====================================================

import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { RotateCcw, X } from 'lucide-react'

interface StateRestorationNotificationProps {
  canRestore: boolean
  hasRestored: boolean
  onRestore: () => void
  onDismiss: () => void
  isVisible: boolean
}

export function StateRestorationNotification({
  canRestore,
  hasRestored,
  onRestore,
  onDismiss,
  isVisible
}: StateRestorationNotificationProps) {
  if (!isVisible) return null

  if (hasRestored) {
    return (
      <Alert className="mb-4 border-green-200 bg-green-50">
        <RotateCcw className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">세션 복원 완료</AlertTitle>
        <AlertDescription className="text-green-700">
          이전 세션이 성공적으로 복원되었습니다. 계속해서 학습을 진행하세요.
        </AlertDescription>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="absolute right-2 top-2 h-6 w-6 p-0 text-green-600 hover:text-green-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </Alert>
    )
  }

  if (canRestore) {
    return (
      <Alert className="mb-4 border-blue-200 bg-blue-50">
        <RotateCcw className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800">이전 세션 발견</AlertTitle>
        <AlertDescription className="text-blue-700">
          이전에 진행 중이던 세션이 있습니다. 복원하시겠습니까?
        </AlertDescription>
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            onClick={onRestore}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            세션 복원
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            새로 시작
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="absolute right-2 top-2 h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </Alert>
    )
  }

  return null
}
