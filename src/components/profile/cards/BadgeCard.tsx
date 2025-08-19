import { Card, CardContent } from "@/components/ui/card"
import { Trophy } from "lucide-react"
import { Badge } from "@/types/profile"

interface BadgeCardProps {
  badge: Badge
}

export const BadgeCard = ({ badge }: BadgeCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">{badge.name}</h4>
            <p className="text-sm text-gray-600">{badge.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(badge.earned_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
