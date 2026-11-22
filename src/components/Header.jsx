import React, { useMemo } from 'react';
import { ShoppingBag } from 'lucide-react';
import { EMPRESA } from '../config/empresa';
import { crearDetectorToques } from '../utils/formato';

export default function Header({
  totalArticulosCarrito,
  onAbrirCarrito,
  onTriggerCatalogo,
  onTriggerVentas,
  panelActivo,
  onVolverCatalogo,
}) {
  const manejarToquesLogo = useMemo(
    () => crearDetectorToques(3, 1500, onTriggerCatalogo),
    [onTriggerCatalogo]
  );

  const manejarToquesNombre = useMemo(
    () => crearDetectorToques(3, 1500, onTriggerVentas),
    [onTriggerVentas]
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={manejarToquesLogo}
            aria-label={EMPRESA.nombre}
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-[#FAFAFA] shadow-2xs transition hover:border-slate-300 cursor-pointer"
          >
            <img
              src={EMPRESA.logoUrl}
              alt={EMPRESA.nombre}
              className="h-full w-full object-contain p-1"
            />
          </button>

          <div className="min-w-0">
            <button
              type="button"
              onClick={manejarToquesNombre}
              className="block truncate text-left font-serif text-lg sm:text-xl font-semibold tracking-wide text-slate-900 cursor-pointer select-none"
            >
              {EMPRESA.nombre}
            </button>
            <p className="hidden sm:block truncate text-xs text-slate-500">
              {EMPRESA.eslogan}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {panelActivo && (
            <button
              type="button"
              onClick={onVolverCatalogo}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 cursor-pointer"
            >
              Ver catálogo
            </button>
          )}

          <button
            type="button"
            onClick={onAbrirCarrito}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3.5 py-2 text-xs sm:text-sm font-medium text-white shadow-xs transition hover:bg-slate-800 cursor-pointer"
          >
            <ShoppingBag className="h-4 w-4 text-sky-200" />
            <span>Cotización</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/15 px-1.5 text-xs font-semibold text-white">
              {totalArticulosCarrito}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}