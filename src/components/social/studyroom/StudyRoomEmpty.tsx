'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface StudyRoomEmptyProps {
  onCreateRoom: () => void
}

export function StudyRoomEmpty({ onCreateRoom }: StudyRoomEmptyProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>스터디룸</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={onCreateRoom} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            새 스터디룸 만들기
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
