"use client"

import { motion } from "framer-motion"

interface PulseIndicatorProps {
  count: number
  color?: string
  size?: number
}

export const PulseIndicator = ({
  count,
  color = "#F59E0B",
  size = 8,
}: PulseIndicatorProps) => {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: Math.min(count, 5) }).map((_, index) => (
        <motion.div
          key={index}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            opacity: 0.7 + index * 0.1,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            delay: index * 0.2,
          }}
        />
      ))}
      {count > 5 && <span className="text-xs text-slate-500 ml-1">+{count - 5}</span>}
    </div>
  )
}
