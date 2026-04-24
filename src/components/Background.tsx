import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface BackgroundProps {
  condition: "sunny" | "snow" | "rain" | "cloudy";
}

export default function Background({ condition }: BackgroundProps) {
  return (
    <div className="fixed inset-0 -z-10 bg-[#020617] overflow-hidden pointer-events-none">
      {/* Immersive Orbital Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#1e293b,0%,#020617_80%)]" />
      
      {/* Condition Specific Overlay */}
      <div 
        className={`absolute inset-0 transition-opacity duration-1000 ${
          condition === "sunny" ? "bg-cyan-400/5" :
          condition === "snow" ? "bg-blue-300/10" :
          condition === "rain" ? "bg-cyan-400/10" :
          "bg-slate-400/5"
        }`} 
      />

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-10" 
           style={{ backgroundImage: 'linear-gradient(#ffffff0a 1px, transparent 1px), linear-gradient(90deg, #ffffff0a 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Floating Atmospheric Dots (Stable) */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`dot-${i}`}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{ 
              top: `${(i * 13.7) % 100}%`, 
              left: `${(i * 17.3) % 100}%` 
            }}
            animate={{
              y: [0, -40, 0],
              opacity: [0.1, 0.5, 0.1],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 5 + (i % 5),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2
            }}
          />
        ))}
      </div>

      {/* Atmospheric Effects */}
      {condition === "sunny" && (
        <>
          <motion.div
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-60 -right-60 w-[1000px] h-[1000px] bg-cyan-400/10 blur-[200px] rounded-full"
          />
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-20 right-20 w-64 h-64 bg-white/20 blur-[100px] rounded-full"
          />
        </>
      )}

      {condition === "cloudy" && (
        <>
          <motion.div 
            animate={{ 
              x: [-100, 100, -100],
              opacity: [0.15, 0.3, 0.15]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-0 left-0 w-[150%] h-2/3 bg-slate-500/10 blur-[120px] rounded-full" 
          />
        </>
      )}

      {/* Particles (Snow/Rain) - Stable Rendering */}
      {(condition === "snow" || condition === "rain") && [...Array(condition === "snow" ? 60 : 40)].map((_, i) => (
        <motion.div
          key={`particle-${condition}-${i}`}
          className={`absolute top-[-20px] ${condition === "snow" ? "w-1 h-1 bg-white rounded-full blur-[0.5px]" : "w-[1px] h-8 bg-cyan-400/60"}`}
          initial={{ 
            left: `${(i * 1.61) % 100}%`, 
            y: -50, 
            opacity: 0,
            scale: 0.5 + (i % 5) * 0.1
          }}
          animate={{ 
            y: "110vh",
            x: condition === "snow" ? [(i % 2 === 0 ? 0 : 20), (i % 2 === 0 ? 20 : 0)] : 0,
            opacity: [0, 0.8, 0]
          }}
          transition={{
            duration: condition === "snow" ? 8 + (i % 10) : 0.5 + (i % 3) * 0.1,
            repeat: Infinity,
            delay: (i * 0.1) % 10,
            ease: condition === "snow" ? "easeInOut" : "linear"
          }}
        />
      ))}

      {/* Retro Tri-Color Scanline Overlay */}
      <div className="absolute inset-0 opacity-[0.15] z-10" 
           style={{ 
             background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04))',
             backgroundSize: '100% 4px, 3px 100%' 
           }} 
      />
    </div>
  );
}
