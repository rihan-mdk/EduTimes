import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{
        backgroundImage: "url('/login-bg.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease-in-out",
        pointerEvents: visible ? "all" : "none",
      }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 flex flex-col items-center gap-6 select-none">
        <div className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-24 w-24 rounded-full bg-orange-400 opacity-20 animate-ping" />
          <span className="absolute inline-flex h-20 w-20 rounded-full bg-orange-500 opacity-30 animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-orange-500 shadow-2xl flex items-center justify-center">
            <Calendar className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="text-center">
          <h1
            className="text-5xl font-black tracking-tight text-white"
            style={{ textShadow: "0 2px 24px rgba(0,0,0,0.6)" }}
          >
            EduTimes
          </h1>
          <p
            className="mt-2 text-sm font-medium tracking-[0.25em] uppercase text-white/60 animate-pulse"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
          >
            Please Wait
          </p>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
