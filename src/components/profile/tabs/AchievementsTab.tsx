import { Trophy, Target } from "lucide-react"
import { Badge, Challenge } from "@/types/profile"
import { BadgeCard, ChallengeCard } from "../cards"
import { useGroupChallenge } from "@/hooks/useGroupChallenge"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { GroupChallenge } from "@/types/social"

interface AchievementsTabProps {
  badges: Badge[]
  challenges: Challenge[]
}

// Active Challenges Section Component
const ActiveChallengesSection = () => {
  const { myChallenges, loading, getActiveChallenges } = useGroupChallenge()
  const [activeChallenges, setActiveChallenges] = useState<GroupChallenge[]>([])

  useEffect(() => {
    const challenges = getActiveChallenges()
    setActiveChallenges(challenges)
  }, [myChallenges, getActiveChallenges])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (activeChallenges.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
          <Target className="h-8 w-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">진행 중인 챌린지가 없습니다</h3>
        <p className="text-sm text-gray-500 mb-4">
          새로운 챌린지에 참가하거나 챌린지를 생성해보세요
        </p>
        <Button 
          variant="outline" 
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
          onClick={() => window.location.href = '/social'}
        >
          챌린지 보기
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {activeChallenges.map((challenge) => (
        <ChallengeCard 
          key={challenge.challenge_id} 
          challenge={{
            id: challenge.challenge_id,
            name: challenge.name,
            description: challenge.description,
            type: 'group',
            progress: 0, // 실제 진행 상황은 별도 API 호출 필요
            target: challenge.goal_value,
            current: 0, // 실제 진행 상황은 별도 API 호출 필요
            end_date: challenge.ends_at
          }} 
        />
      ))}
    </div>
  )
}

export const AchievementsTab = ({ badges, challenges }: AchievementsTabProps) => {
  return (
    <div className="space-y-6">
      {/* Badges Section */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          획득 배지
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((badge) => (
            <BadgeCard key={badge.id} badge={badge} />
          ))}
        </div>
      </div>

      {/* Challenges Section */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          진행 중 챌린지
        </h3>
        <ActiveChallengesSection />
      </div>
    </div>
  )
}
