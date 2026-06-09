/**
 * SplashScreen — pantalla de entrada con animación.
 * Funciona en web y APK Android (Capacitor) — pura animación CSS.
 */
import { useEffect, useState } from "react";
import logo from "@/assets/ufps-logo.png";

interface SplashScreenProps {
  onDone: () => void;
  /** ms antes de iniciar el fade-out (default 2000). */
  duracionMs?: number;
}

export function SplashScreen({ onDone, duracionMs = 2000 }: SplashScreenProps) {
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSaliendo(true), duracionMs);
    const t2 = setTimeout(() => onDone(), duracionMs + 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [duracionMs, onDone]);

  return (
    <div
      className={`fixed inset-0 z-[2000] flex flex-col items-center justify-center transition-opacity duration-500 ${
        saliendo ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ background: "#8A1538" }}
    >
      <img
        src={logo}
        alt="UFPS Transit"
        className="size-28 animate-[splash-fade-in_0.8s_ease-out_forwards] opacity-0"
        style={{ filter: "drop-shadow(0 10px 30px rgba(0,0,0,.3))" }}
      />
      <div className="mt-6 flex flex-col items-center opacity-0 animate-[splash-rise_0.5s_ease-out_0.7s_forwards]">
        <h1 className="text-3xl font-bold tracking-tight text-white">UFPS Transit</h1>
        <p className="mt-1 text-sm text-white/80">Optimización de la red vial</p>
      </div>

      <style>{`
        @keyframes splash-fade-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes splash-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
