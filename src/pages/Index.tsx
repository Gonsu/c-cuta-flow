import { useState } from "react";
import { MobileNavScreen } from "@/components/transit/MobileNavScreen";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import { AnalysisPanel } from "@/components/transit/AnalysisPanel";

const Index = () => {
  const [algorithm, setAlgorithm] = useState<"astar" | "dijkstra">("astar");

  return (
    <main className="flex min-h-screen w-full bg-background">
      {/* Lado izquierdo — escenario del mockup móvil */}
      <section className="relative flex flex-1 flex-col overflow-hidden bg-paper">
        {/* Branding superior */}
        <header className="z-10 flex items-center justify-between border-b border-border bg-surface/70 px-10 py-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">
              U
            </div>
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                UFPS Transit
              </p>
              <h1 className="text-base font-semibold tracking-tight text-ink">
                Optimización de la red vial hacia la UFPS
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted md:flex">
            <span>Mockup · Corte 2026</span>
            <span className="size-1 rounded-full bg-ink-subtle" />
            <span>Cúcuta, N. de Santander</span>
          </div>
        </header>

        {/* Escenario */}
        <div className="relative flex flex-1 items-center justify-center bg-grid mask-radial">
          {/* Etiquetas flotantes alrededor del teléfono — pistas académicas */}
          <FloatingTag
            className="left-[6%] top-[14%]"
            mono="// nodo origen"
            text="Intersección crítica · Av. 0 con Calle 10"
          />
          <FloatingTag
            className="left-[8%] bottom-[18%]"
            mono="// función de costo"
            text="f(e) = α·d + β·t  ·  α=0.4  β=0.6"
          />
          <FloatingTag
            className="right-[6%] top-[22%]"
            mono="// destino"
            text="UFPS · Edificio Cread"
            accent
          />
          <FloatingTag
            className="right-[8%] bottom-[14%]"
            mono="// heurística A*"
            text="h(n) = distancia euclidiana al destino"
          />

          {/* Líneas conectoras decorativas */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full text-border" aria-hidden>
            <line x1="22%" y1="22%" x2="40%" y2="32%" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
            <line x1="22%" y1="78%" x2="40%" y2="68%" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
            <line x1="78%" y1="28%" x2="60%" y2="36%" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
            <line x1="78%" y1="78%" x2="60%" y2="64%" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
          </svg>

          <PhoneFrame className="relative z-10">
            <MobileNavScreen algorithm={algorithm} />
          </PhoneFrame>
        </div>

        {/* Pie con créditos */}
        <footer className="border-t border-border bg-surface px-10 py-4 font-mono text-[10px] uppercase tracking-wider text-ink-muted">
          Aplicaciones prácticas de teoría de grafos · 1155616 · Universidad
          Francisco de Paula Santander
        </footer>
      </section>

      {/* Lado derecho — panel de análisis */}
      <AnalysisPanel algorithm={algorithm} onAlgorithmChange={setAlgorithm} />
    </main>
  );
};

function FloatingTag({
  className,
  mono,
  text,
  accent,
}: {
  className?: string;
  mono: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        "absolute hidden max-w-[220px] rounded-md border border-border bg-surface/95 px-3 py-2 shadow-card backdrop-blur lg:block " +
        (className ?? "")
      }
    >
      <p
        className={
          "font-mono text-[10px] font-semibold uppercase tracking-widest " +
          (accent ? "text-primary" : "text-ink-muted")
        }
      >
        {mono}
      </p>
      <p className="mt-0.5 text-xs text-ink">{text}</p>
    </div>
  );
}

export default Index;
