import { Card, CardContent } from "@/components/ui/card"
import { Badge as BadgeUI } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Challenge } from "@/types/profile"

interface ChallengeCardProps {
  challenge: Challenge
}

export const ChallengeCard = ({ challenge }: ChallengeCardProps) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'personal': return 'bg-blue-100 text-blue-800'
      case 'one_on_one': return 'bg-green-100 text-green-800'
      case 'group': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'personal': return '개인'
      case 'one_on_one': return '1:1'
      case 'group': return '그룹'
      default: return '기타'
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <BadgeUI className={getTypeColor(challenge.type)} variant="secondary">
            {getTypeText(challenge.type)}
          </BadgeUI>
          <span className="text-sm text-gray-500">
            {new Date(challenge.end_date).toLocaleDateString('ko-KR')}
          </span>
        </div>
        
        <h4 className="font-semibold text-gray-900 mb-2">{challenge.name}</h4>
        <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>진행률</span>
            <span className="font-medium">{challenge.progress}%</span>
          </div>
          <Progress value={challenge.progress} className="h-2" />
          <div className="text-xs text-gray-500 text-center">
            {challenge.current} / {challenge.target}분
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
