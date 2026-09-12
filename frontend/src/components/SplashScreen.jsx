import React, { useEffect, useState } from "react";

export default function SplashScreen({ onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(false), 1800);
    const doneTimer = setTimeout(() => onDone && onDone(), 2200);
    return () => {
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

        {/* Clean minimal loader indicator */}
        <div className="w-28 h-1 bg-white/10 rounded-full mt-6 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full animate-[pulse_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
