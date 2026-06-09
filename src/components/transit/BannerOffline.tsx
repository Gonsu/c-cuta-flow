/**
 * BannerOffline — detecta navigator.onLine y muestra banner cuando no hay red.
 * Compatible con Android/Capacitor (usa eventos estándar del WebView).
 */
import { useEffect, useState } from "react";
import { WifiOff, RotateCw } from "lucide-react";

export function BannerOffline() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  const reintentar = async () => {
    // Ping ligero para forzar reevaluación de conectividad.
    try {
      await fetch("https://www.gstatic.com/generate_204", {
        method: "GET",
        cache: "no-store",
        mode: "no-cors",
      });
      setOnline(true);
    } catch {
      setOnline(navigator.onLine);
    }
  };

  if (online) return null;

  return (
    <div
      className="fixed inset-x-0 z-[1800] flex items-center justify-between gap-3 px-4 py-3 text-white shadow-elevated"
      style={{
        top: 0,
        paddingTop: `calc(env(safe-area-inset-top) + 12px)`,
        background: "#8A1538",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="size-4 shrink-0" />
        <p className="text-xs font-medium leading-tight">
          Sin conexión a internet — Revisa tu red para calcular rutas
        </p>
      </div>
      <button
        onClick={reintentar}
        className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold hover:bg-white/25"
      >
        <RotateCw className="size-3" /> Reintentar
      </button>
    </div>
  );
}
