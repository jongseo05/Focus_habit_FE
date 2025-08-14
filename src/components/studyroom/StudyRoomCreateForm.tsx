'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { CreateStudyRoomData } from '@/types/social'

interface StudyRoomCreateFormProps {
  roomForm: CreateStudyRoomData
  onRoomFormChange: (form: CreateStudyRoomData) => void
  onCreateRoom: () => void
  onCancel: () => void
}

export function StudyRoomCreateForm({
  roomForm,
  onRoomFormChange,
  onCreateRoom,
  onCancel
}: StudyRoomCreateFormProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            새로운 스터디룸 만들기
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">룸 이름</label>
            <input
              type="text"
              value={roomForm.name}
              onChange={(e) => onRoomFormChange({ ...roomForm, name: e.target.value })}
              placeholder="예: 오늘 밤 공부방"
              className="w-full p-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">설명</label>
            <textarea
              value={roomForm.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onRoomFormChange({ ...roomForm, description: e.target.value })}
              placeholder="룸에 대한 설명을 입력하세요"
              rows={3}
              className="w-full p-2 border rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">최대 참가자 수</label>
              <input
                type="number"
                min="2"
                max="4"
                value={roomForm.max_participants}
                onChange={(e) => onRoomFormChange({ ...roomForm, max_participants: parseInt(e.target.value) })}
                className="w-full p-2 border rounded-md"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">목표 시간 (분)</label>
              <input
                type="number"
                min="15"
                value={roomForm.goal_minutes}
                onChange={(e) => onRoomFormChange({ ...roomForm, goal_minutes: parseInt(e.target.value) })}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">세션 타입</label>
            <select
              value={roomForm.session_type}
              onChange={(e) => onRoomFormChange({ ...roomForm, session_type: e.target.value as any })}
              className="w-full p-2 border rounded-md"
            >
              <option value="study">공부</option>
              <option value="work">업무</option>
              <option value="reading">독서</option>
              <option value="other">기타</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Button onClick={onCreateRoom} className="flex-1">
              스터디룸 생성
            </Button>
            <Button variant="outline" onClick={onCancel}>
              취소
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
