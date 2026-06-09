/**
 * PanelHistorial — muestra las últimas 5 rutas calculadas.
 */
import { Clock, X, Trash2 } from "lucide-react";
import type { EntradaHistorial } from "@/hooks/useHistorial";

interface Props {
  items: EntradaHistorial[];
  onCerrar: () => void;
  onSeleccionar: (e: EntradaHistorial) => void;
  onLimpiar: () => void;
}

function fmtMin(s: number) {
  const m = Math.max(1, Math.round(s / 60));
  return `${m} min`;
}

function fmtFecha(ts: number) {
  return new Date(ts).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PanelHistorial({ items, onCerrar, onSeleccionar, onLimpiar }: Props) {
  return (
    <div className="absolute right-3 top-[16.5rem] z-[600] w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-elevated">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-primary" />
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
            Historial
          </p>
        </div>
        <div className="flex items-center gap-1">
          {items.length > 0 && (
            <button
              onClick={onLimpiar}
              className="text-ink-muted hover:text-ink"
              aria-label="Limpiar historial"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          <button onClick={onCerrar} className="text-ink-muted hover:text-ink" aria-label="Cerrar">
            <X className="size-3.5" />
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-xs text-ink-muted">Aún no hay rutas guardadas</p>
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {items.map((e) => (
            <li key={e.id} className="border-b border-border last:border-b-0 hover:bg-paper">
              <button
                onClick={() => onSeleccionar(e)}
                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left"
              >
                <p className="truncate text-[11px] font-semibold text-ink">
                  {e.destino.label}
                </p>
                <p className="truncate text-[10px] text-ink-muted">desde {e.origen.label}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider text-ink-subtle">
                  {fmtMin(e.duracionS)} · {fmtFecha(e.fecha)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
