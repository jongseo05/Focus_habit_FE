"use client"

import { motion } from "framer-motion"

interface LoadingSpinnerProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ 
  message = "로딩 중...", 
  size = "md",
  className = ""
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-32 w-32", 
    lg: "h-48 w-48"
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${className}`}>
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className={`animate-spin rounded-full border-b-2 border-blue-600 mx-auto ${sizeClasses[size]}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.p 
          className="mt-4 text-gray-600 font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {message}
        </motion.p>
      </motion.div>
    </div>
  )
}

// 전체 화면 로딩 컴포넌트 (기존 로딩 페이지 스타일)
export function FullScreenLoading({ 
  message = "로딩 중...",
  showBackground = true 
}: { 
  message?: string
  showBackground?: boolean 
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden ${
        showBackground ? "bg-white" : ""
      }`}
    >
      {/* Animated Background Panning Effect */}
      {showBackground && (
        <motion.div
          className="absolute inset-0"
          animate={{
            backgroundPosition: ["0% 0%", "100% 0%"],
          }}
          transition={{
            duration: 8,
            ease: "linear",
            repeat: Number.POSITIVE_INFINITY,
          }}
          style={{
            backgroundImage: "linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.03) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
          }}
        />
      )}

      {/* Main Loading Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-10 flex flex-col items-center justify-center space-y-8"
      >
        {/* Circular Spinner */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="w-16 h-16 relative">
            {/* Background ring */}
            <div
              className="absolute inset-0 rounded-full border-4"
              style={{
                borderColor: "rgba(59, 130, 246, 0.06)",
              }}
            />

            {/* Animated spinner */}
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-transparent"
              style={{
                borderTopColor: "#3b82f6",
                borderRightColor: "#3b82f6",
                borderBottomColor: "transparent",
                borderLeftColor: "transparent",
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 1.2,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              }}
            />

            {/* Subtle inner glow */}
            <motion.div
              className="absolute inset-3 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%)",
              }}
              animate={{
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 2.4,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
              }}
            />
          </div>
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="text-center"
        >
          <p
            className="font-medium tracking-wide"
            style={{
              fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              color: "#6b7280",
              letterSpacing: "0.025em",
            }}
          >
            {message}
          </p>
        </motion.div>

        {/* Progress Dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="flex items-center gap-3"
        >
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: "#d1d5db",
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 2,
                ease: "easeInOut",
                repeat: Number.POSITIVE_INFINITY,
                delay: index * 0.3,
              }}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* Ambient atmosphere */}
      {showBackground && (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.08, scale: 1 }}
            transition={{ duration: 1.5, delay: 0.3 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="w-[1000px] h-[1000px] rounded-full blur-3xl"
              style={{
                background: "radial-gradient(circle, rgba(59, 130, 246, 0.03) 0%, transparent 70%)",
              }}
            />
          </motion.div>

          {/* Floating elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  backgroundColor: "rgba(59, 130, 246, 0.08)",
                  left: `${30 + i * 20}%`,
                  top: `${45 + (i % 2) * 10}%`,
                }}
                animate={{
                  y: [-20, -35, -20],
                  opacity: [0, 0.8, 0],
                  scale: [0.8, 1.4, 0.8],
                }}
                transition={{
                  duration: 6,
                  ease: "easeInOut",
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 2,
                }}
              />
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
