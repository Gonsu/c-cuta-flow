import { PantallaCelular } from "@/components/transit/PantallaCelular";
import { PhoneFrame } from "@/components/transit/PhoneFrame";
import ufpsLogo from "@/assets/ufps-logo.png";

const Index = () => {
  return (
    <main className="relative flex min-h-screen w-full flex-col bg-background">
      {/* Cabecera del mockup */}
      <header className="z-10 flex items-center justify-between border-b border-border bg-surface px-6 py-4 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">
            U
          </div>
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              UFPS Transit
            </p>
            <h1 className="text-sm font-semibold tracking-tight text-ink lg:text-base">
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

      {/* Escenario del teléfono */}
      <section className="relative flex flex-1 items-start justify-center overflow-hidden bg-grid mask-radial px-4 py-10 lg:py-14">
        {/* Anotaciones académicas a los lados (solo desktop) */}
        <Tag
          className="left-[8%] top-[10%]"
          mono="// origen"
          texto="Ubicación del usuario o dirección elegida"
        />
        <Tag
          className="left-[6%] top-[44%]"
          mono="// función de costo"
          texto="f(e) = α·d + β·t  ·  α=0,4  β=0,6"
        />
        <Tag
          className="left-[10%] bottom-[8%]"
          mono="// algoritmo"
          texto="A* explora menos nodos gracias a la heurística"
        />
        <Tag
          className="right-[8%] top-[12%]"
          mono="// destino"
          texto="UFPS · Edificio CREAD, campus principal"
          acento
        />
        <Tag
          className="right-[6%] top-[46%]"
          mono="// telemetría"
          texto="Botón inferior despliega métricas Dijkstra vs A*"
        />
        <Tag
          className="right-[10%] bottom-[8%]"
          mono="// tráfico"
          texto="Pesos dinámicos por hora pico, datos meteorológicos"
        />

        <PhoneFrame className="relative z-10 shrink-0">
          <PantallaCelular />
        </PhoneFrame>
      </section>

      <footer className="border-t border-border bg-surface px-6 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-muted lg:px-10">
        Aplicaciones prácticas de teoría de grafos · 1155616 · Universidad
        Francisco de Paula Santander · 2026
      </footer>
    </main>
  );
};

function Tag({
  className,
  mono,
  texto,
  acento,
}: {
  className?: string;
  mono: string;
  texto: string;
  acento?: boolean;
}) {
  return (
    <div
      className={
        "absolute hidden max-w-[210px] rounded-md border border-border bg-surface/95 px-3 py-2 shadow-card backdrop-blur xl:block " +
        (className ?? "")
      }
    >
      <p
        className={
          "font-mono text-[10px] font-semibold uppercase tracking-widest " +
          (acento ? "text-primary" : "text-ink-muted")
        }
      >
        {mono}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-ink">{texto}</p>
    </div>
  );
}

export default Index;
