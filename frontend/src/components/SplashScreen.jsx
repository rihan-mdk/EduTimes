import React, { useEffect, useState } from "react";

export default function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const startTime = performance.now();
    const duration = 1600; // ms to reach full progress before fade
    let animFrame;

    const updateProgress = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progressFraction = Math.min(elapsed / duration, 1);
      // Smooth ease-out curve
      const eased = 1 - Math.pow(1 - progressFraction, 2.5);
      const currentPercent = Math.min(100, Math.round(8 + eased * 92));
      setProgress(currentPercent);

      if (progressFraction < 1) {
        animFrame = requestAnimationFrame(updateProgress);
      }
    };

    animFrame = requestAnimationFrame(updateProgress);

    const fadeTimer = setTimeout(() => setVisible(false), 1800);
    const doneTimer = setTimeout(() => onDone && onDone(), 2200);
    return () => {
      cancelAnimationFrame(animFrame);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 overflow-hidden"
      style={{
        backgroundImage: "url('/login-bg.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease-in-out",
        pointerEvents: visible ? "all" : "none",
      }}
    >
      {/* Dark tint backdrop */}
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]" />

      {/* Ambient warm glow behind logo */}
      <div className="absolute w-80 h-80 rounded-full bg-gradient-to-tr from-orange-600/30 to-amber-500/20 blur-3xl pointer-events-none animate-pulse" />

      <div className="relative z-10 flex flex-col items-center select-none text-center px-6">
        {/* Logo Badge matching Navbar */}
        <div className="relative mb-4 flex items-center justify-center">
          {/* Subtle pulsating rings */}
          <span className="absolute inline-flex h-28 w-28 rounded-3xl bg-gradient-to-tr from-orange-600/30 to-amber-500/20 animate-ping opacity-60" />
          <span className="absolute inline-flex h-24 w-24 rounded-3xl bg-orange-500/20 animate-pulse" />
          
          {/* Official E Logo Icon */}
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white font-extrabold text-4xl shadow-2xl shadow-orange-500/40 border border-white/20">
            E
          </div>
        </div>

        {/* Brand Name matching Navbar typography and color */}
        <div className="flex flex-col items-center">
          <h1
            className="text-4xl sm:text-5xl font-black tracking-tight text-white"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.6)" }}
          >
            Edu<span className="text-orange-500">Times</span>
          </h1>
          <p
            className="mt-1.5 text-xs font-semibold tracking-[0.25em] uppercase text-slate-300/80"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
          >
            Academic Suite
          </p>
        </div>

        {/* Dynamic moving loader indicator */}
        <div className="w-36 sm:w-44 h-1.5 bg-white/10 rounded-full mt-7 overflow-hidden relative border border-white/5 shadow-inner">
          {/* Progress fill */}
          <div
            className="h-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 rounded-full relative transition-[width] duration-75 ease-out shadow-[0_0_12px_rgba(249,115,22,0.5)]"
            style={{ width: `${progress}%` }}
          >
            {/* Continuously moving shimmer beam */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
            {/* Glowing tip at leading edge */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-200 shadow-[0_0_8px_#f97316] pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
