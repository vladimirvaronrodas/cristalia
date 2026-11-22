import React, { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { EMPRESA } from '../config/empresa';
import { crearDetectorToques, crearUrlWhatsApp } from '../utils/formato';

export default function Footer({ onTriggerAdminTotal }) {
  const manejarToquesAdmin = useMemo(
    () => crearDetectorToques(5, 2000, onTriggerAdminTotal),
    [onTriggerAdminTotal]
  );

  const urlSoporte = crearUrlWhatsApp(
    EMPRESA.desarrollador.whatsappSoporte,
    `Hola ${EMPRESA.desarrollador.texto}, consulta desde ${EMPRESA.nombre}.`
  );

  return (
    <footer className="mt-16 border-t border-slate-200/80 bg-[#FAFAFA] py-5 text-xs text-slate-500">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6">
        <p className="text-center sm:text-left">
          <span className="font-medium text-slate-700">{EMPRESA.nombre}</span> — {EMPRESA.eslogan}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={manejarToquesAdmin}
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 transition hover:text-slate-700 cursor-pointer select-none"
          >
            <img
              src={EMPRESA.desarrollador.logoUrl}
              alt={EMPRESA.desarrollador.texto}
              className="h-4 w-4 object-contain"
            />
            <span>{EMPRESA.desarrollador.texto}</span>
          </button>

          <a
            href={urlSoporte}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp soporte técnico"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}