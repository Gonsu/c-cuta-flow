/**
 * PhoneFrame
 * Carcasa de smartphone para mostrar el mockup móvil.
 */
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function PhoneFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative mx-auto h-[760px] w-[380px] rounded-[44px] border-[10px] border-ink bg-ink p-0 shadow-phone",
        className
      )}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-2 z-30 h-6 w-32 -translate-x-1/2 rounded-full bg-ink" />
      <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-surface">
        {/* Status bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-7 pt-3 font-mono text-[11px] font-semibold tracking-tight text-ink">
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <span className="text-[9px] tracking-wider">5G</span>
            <span className="block h-2.5 w-4 rounded-sm border border-ink">
              <span className="block h-full w-3/4 bg-ink" />
            </span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
