/**
 * PanelAcercaDe — información del proyecto.
 */
import { X } from "lucide-react";
import logo from "@/assets/ufps-logo.png";

interface Props {
  onCerrar: () => void;
}

export function PanelAcercaDe({ onCerrar }: Props) {
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-elevated">
        <button
          onClick={onCerrar}
          className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
        <div className="flex flex-col items-center px-6 py-8 text-white" style={{ background: "#8A1538" }}>
          <img src={logo} alt="UFPS" className="size-20" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">UFPS Transit</h2>
          <p className="mt-1 text-center text-xs text-white/80">
            Optimización de la red vial hacia la UFPS
          </p>
        </div>
        <div className="space-y-3 px-6 py-5">
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
              Materia
            </p>
            <p className="text-sm text-ink">Aplicaciones Prácticas de Teoría de Grafos</p>
          </div>
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
              Universidad
            </p>
            <p className="text-sm text-ink">Universidad Francisco de Paula Santander</p>
          </div>
          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-ink-muted">
              Año
            </p>
            <p className="text-sm text-ink">2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
