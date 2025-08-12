"use client"

import { motion } from "framer-motion"
import { Brain } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function LoadingPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto redirect to dashboard after 3 seconds
    const redirectTimer = setTimeout(() => {
      router.push("/dashboard")
    }, 3000)

    return () => {
      clearTimeout(redirectTimer)
    }
  }, [router])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{
        background: "#ffffff",
      }}
    >
      {/* Animated Background Panning Effect - 8 seconds left-to-right */}
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

      {/* Logo Watermark with ample whitespace */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.04, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div className="w-96 h-96 flex items-center justify-center">
          <Brain
            className="w-full h-full"
            style={{
              color: "#6b7280",
              filter: "blur(1.5px)",
            }}
          />
        </div>
      </motion.div>

      {/* Main Loading Content - Minimalist with ample whitespace */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-10 flex flex-col items-center justify-center space-y-12"
      >
        {/* Circular Spinner - Linear infinite rotation over 1.2 seconds */}
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

            {/* Animated spinner - Linear infinite rotation over 1.2 seconds */}
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

            {/* Subtle inner glow for sophistication */}
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

        {/* Loading Text - Pretendard 14px, medium weight, slate-500 */}
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
              color: "#6b7280", // slate-500 equivalent
              letterSpacing: "0.025em",
            }}
          >
            대시보드로 이동 중...
          </p>
        </motion.div>

        {/* Minimalist Progress Dots with ample spacing */}
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

      {/* Sophisticated ambient atmosphere */}
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

      {/* Minimalist floating elements for sophistication */}
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

      {/* Subtle corner accents for sophisticated atmosphere */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.02 }}
        transition={{ duration: 1, delay: 0.5 }}
        className="absolute top-0 right-0 w-80 h-80 pointer-events-none"
        style={{
          background: "radial-gradient(circle at top right, rgba(59, 130, 246, 0.06) 0%, transparent 60%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.015 }}
        transition={{ duration: 1, delay: 0.7 }}
        className="absolute bottom-0 left-0 w-64 h-64 pointer-events-none"
        style={{
          background: "radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.04) 0%, transparent 60%)",
        }}
      />
    </motion.div>
  )
}
