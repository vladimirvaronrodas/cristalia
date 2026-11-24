import React from 'react';
import { EMPRESA } from '../config/empresa';
import { formatearBs } from '../utils/formato';

export default function ComprobanteTarjeta({
  tarjetaRef,
  tituloDocumento = 'Comprobante de Pedido',
  codigo,
  fechaTexto,
  clienteNombre,
  clienteTelefono,
  items = [],
  totalBs = 0,
  selloDespachado = false,
  selloDeclinado = false,
}) {
  return (
    <div
      ref={tarjetaRef}
      className="relative rounded-2xl border border-slate-200 bg-white p-5 text-slate-800"
    >
      {selloDespachado && (
        <div className="pointer-events-none absolute top-4 right-4 rotate-[-8deg] rounded-lg border-2 border-emerald-600/80 bg-emerald-50/90 px-3 py-1 text-[11px] font-bold tracking-wider text-emerald-700 uppercase">
          DESPACHADO / COMPLETADO
        </div>
      )}

      {!selloDespachado && selloDeclinado && (
        <div className="pointer-events-none absolute top-4 right-4 rotate-[-8deg] rounded-lg border-2 border-rose-600/80 bg-rose-50/90 px-3 py-1 text-[11px] font-bold tracking-wider text-rose-700 uppercase">
          DECLINADO
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5 pr-28">
        <img
          src={EMPRESA.logoUrl}
          alt={EMPRESA.nombre}
          className="h-11 w-11 rounded-lg border border-slate-100 object-contain p-1"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {tituloDocumento}
          </p>
          <h3 className="font-serif text-lg font-semibold text-slate-900">{EMPRESA.nombre}</h3>
          <p className="text-[11px] text-slate-500">{EMPRESA.eslogan}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          <strong className="text-slate-800">Código:</strong> {codigo || 'COTIZACIÓN'}
        </span>
        <span>{fechaTexto || new Date().toLocaleString('es-BO')}</span>
      </div>

      {(clienteNombre || clienteTelefono) && (
        <div className="mt-2 rounded-xl bg-[#FAFAFA] px-3 py-2 text-xs text-slate-700">
          {clienteNombre && (
            <p>
              <strong>Cliente:</strong> {clienteNombre}
            </p>
          )}
          {clienteTelefono && (
            <p>
              <strong>Celular / WhatsApp:</strong> {clienteTelefono}
            </p>
          )}
        </div>
      )}

      <div className="mt-3.5 divide-y divide-slate-100 border-t border-b border-slate-100 text-xs">
        {items.map((item, index) => {
          const subtotal = Number(item.price_bs) * Number(item.quantity);
          return (
            <div
              key={`${item.product_id || item.id || index}`}
              className="flex items-start justify-between gap-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="pb-0.5 font-medium leading-normal break-words text-slate-800">
                  {item.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  {item.quantity} × {formatearBs(item.price_bs)}
                </p>
              </div>
              <span className="shrink-0 pt-0.5 font-semibold text-slate-900">
                {formatearBs(subtotal)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Total General</span>
        <span className="text-base font-bold text-slate-900">{formatearBs(totalBs)}</span>
      </div>
    </div>
  );
}