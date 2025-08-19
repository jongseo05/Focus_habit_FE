import { Badge as BadgeUI } from "@/components/ui/badge"
import { Activity, PlayCircle, BellOff, User } from "lucide-react"
import { UserStatus } from "@/types/profile"

interface StatusBadgeProps {
  status: UserStatus
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const getStatusConfig = (status: UserStatus) => {
    switch (status) {
      case UserStatus.ONLINE:
        return { text: "온라인", color: "bg-green-500", icon: Activity }
      case UserStatus.IN_SESSION:
        return { text: "세션중", color: "bg-blue-500", icon: PlayCircle }
      case UserStatus.DO_NOT_DISTURB:
        return { text: "방해금지", color: "bg-red-500", icon: BellOff }
      default:
        return { text: "오프라인", color: "bg-gray-500", icon: User }
    }
  }

  const config = getStatusConfig(status)
  const Icon = config.icon

  return (
    <BadgeUI variant="secondary" className={`${config.color} text-white flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {config.text}
    </BadgeUI>
  )
}
