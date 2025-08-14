'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGroupChallenge } from '@/hooks/useGroupChallenge'
import { Trophy, Target, Clock, Users } from 'lucide-react'

interface CreateGroupChallengeFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function CreateGroupChallengeForm({ onSuccess, onCancel }: CreateGroupChallengeFormProps) {
  const { createChallenge, loading } = useGroupChallenge()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    goal_type: 'total_hours' as 'total_hours' | 'total_sessions' | 'average_focus_score',
    goal_value: 10,
    duration_days: 7
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      alert('챌린지 이름을 입력해주세요.')
      return
    }

    const challenge = await createChallenge(formData)
    if (challenge) {
      onSuccess?.()
    }
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const getGoalTypeInfo = () => {
    switch (formData.goal_type) {
      case 'total_hours':
        return {
          label: '총 학습 시간',
          unit: '시간',
          description: '그룹 전체가 달성해야 할 총 학습 시간'
        }
      case 'total_sessions':
        return {
          label: '총 세션 수',
          unit: '회',
          description: '그룹 전체가 완료해야 할 총 집중 세션 수'
        }
      case 'average_focus_score':
        return {
          label: '평균 집중도',
          unit: '점',
          description: '그룹 전체가 달성해야 할 평균 집중도 점수'
        }
      default:
        return { label: '', unit: '', description: '' }
    }
  }

  const goalInfo = getGoalTypeInfo()

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          새로운 그룹 챌린지
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 챌린지 이름 */}
          <div className="space-y-2">
            <Label htmlFor="name">챌린지 이름</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="예: 1주일 100시간 학습 챌린지"
              required
            />
          </div>

          {/* 챌린지 설명 */}
          <div className="space-y-2">
            <Label htmlFor="description">설명 (선택사항)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="챌린지에 대한 자세한 설명을 입력하세요"
              rows={3}
            />
          </div>

          {/* 목표 타입 */}
          <div className="space-y-2">
            <Label htmlFor="goal_type">목표 타입</Label>
            <Select
              value={formData.goal_type}
              onValueChange={(value: 'total_hours' | 'total_sessions' | 'average_focus_score') => 
                handleInputChange('goal_type', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_hours">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    총 학습 시간
                  </div>
                </SelectItem>
                <SelectItem value="total_sessions">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    총 세션 수
                  </div>
                </SelectItem>
                <SelectItem value="average_focus_score">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    평균 집중도
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600">{goalInfo.description}</p>
          </div>

          {/* 목표 값 */}
          <div className="space-y-2">
            <Label htmlFor="goal_value">목표 값</Label>
            <Input
              id="goal_value"
              type="number"
              value={formData.goal_value}
              onChange={(e) => handleInputChange('goal_value', parseFloat(e.target.value) || 0)}
              min={1}
              max={formData.goal_type === 'average_focus_score' ? 100 : 1000}
              step={formData.goal_type === 'average_focus_score' ? 1 : 0.5}
              required
            />
            <p className="text-sm text-gray-600">
              목표: {formData.goal_value} {goalInfo.unit}
            </p>
          </div>

          {/* 기간 */}
          <div className="space-y-2">
            <Label htmlFor="duration_days">챌린지 기간</Label>
            <Select
              value={formData.duration_days.toString()}
              onValueChange={(value) => handleInputChange('duration_days', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1일</SelectItem>
                <SelectItem value="3">3일</SelectItem>
                <SelectItem value="7">1주일</SelectItem>
                <SelectItem value="14">2주일</SelectItem>
                <SelectItem value="30">1개월</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex-1"
            >
              {loading ? '생성 중...' : '챌린지 생성'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
