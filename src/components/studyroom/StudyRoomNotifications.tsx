'use client'

interface Notification {
  id: string
  message: string
  type: 'join' | 'leave'
}

interface StudyRoomNotificationsProps {
  notifications: Notification[]
}

export function StudyRoomNotifications({ notifications }: StudyRoomNotificationsProps) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 left-4 z-50 space-y-2">
      {notifications.slice(-3).map((notification) => (
        <div
          key={notification.id}
          className={`p-3 rounded-lg shadow-lg text-sm text-white max-w-xs ${
            notification.type === 'join' ? 'bg-green-500' : 'bg-gray-500'
          }`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  )
}
