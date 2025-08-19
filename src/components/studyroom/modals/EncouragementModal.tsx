// =====================================================
// 격려 메시지 모달
// =====================================================

'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Heart, Zap, Target, Star, Send } from 'lucide-react'
import { useStudyRoomContext } from '../core/StudyRoomProvider'

interface EncouragementModalProps {
  targetUserId: string
  targetUserName: string
  onClose: () => void
}

const QUICK_MESSAGES = [
  { icon: '💪', text: '화이팅!', category: 'cheer' },
  { icon: '🔥', text: '집중 잘하고 있어요!', category: 'praise' },
  { icon: '⭐', text: '대단해요!', category: 'praise' },
  { icon: '🎯', text: '목표까지 조금 더!', category: 'motivation' },
  { icon: '☕', text: '잠깐 휴식 어때요?', category: 'care' },
  { icon: '🌟', text: '최고예요!', category: 'praise' },
  { icon: '💎', text: '꾸준히 하고 계시네요!', category: 'praise' },
  { icon: '🚀', text: '계속 가세요!', category: 'motivation' }
]

export function EncouragementModal({ 
  targetUserId, 
  targetUserName, 
  onClose 
}: EncouragementModalProps) {
  const { sendEncouragement } = useStudyRoomContext()
  const [message, setMessage] = useState('')
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // 빠른 메시지 선택
  const handleQuickMessage = (quickMessage: string) => {
    setMessage(quickMessage)
    setSelectedQuick(quickMessage)
  }

  // 메시지 전송
  const handleSend = async () => {
    if (!message.trim()) return

    try {
      setSending(true)
      sendEncouragement(targetUserId, message.trim())
      onClose()
    } catch (error) {
      console.error('격려 메시지 전송 실패:', error)
    } finally {
      setSending(false)
    }
  }

  // 엔터키로 전송 (Shift+Enter는 줄바꿈)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            격려 메시지 보내기
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-blue-600">{targetUserName}</span>님에게 
            따뜻한 격려의 메시지를 보내세요!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 빠른 메시지 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              빠른 메시지
            </label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_MESSAGES.map((quick, index) => (
                <Button
                  key={index}
                  variant={selectedQuick === quick.text ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickMessage(quick.text)}
                  className="justify-start h-auto p-2 text-left"
                >
                  <span className="mr-2">{quick.icon}</span>
                  <span className="text-xs">{quick.text}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* 커스텀 메시지 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              직접 입력
            </label>
            <Textarea
              placeholder="따뜻한 격려의 메시지를 입력해주세요..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setSelectedQuick(null)
              }}
              onKeyDown={handleKeyDown}
              rows={3}
              maxLength={200}
              className="resize-none"
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {message.length}/200
            </div>
          </div>

          {/* 메시지 미리보기 */}
          {message.trim() && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600 mb-1">미리보기:</div>
              <div className="bg-white p-2 rounded border">
                <div className="flex items-center gap-2 text-sm">
                  <Heart className="h-4 w-4 text-pink-500" />
                  <span className="font-medium">나</span>
                  <span className="text-gray-500">→</span>
                  <span className="font-medium text-blue-600">{targetUserName}</span>
                </div>
                <p className="mt-1 text-sm">{message}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sending}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            {sending ? '전송 중...' : '전송'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
