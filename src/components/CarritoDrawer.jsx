import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  FileImage,
  FileText,
  Share2,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EMPRESA } from '../config/empresa';
import { crearUrlWhatsApp, formatearBs } from '../utils/formato';
import {
  capturarElementoComoPng,
  compartirComprobante,
  generarPdfComprobante,
} from '../utils/recibos';
import ComprobanteTarjeta from './ComprobanteTarjeta';

export default function CarritoDrawer({
  abierto,
  onCerrar,
  items = [],
  onActualizarCantidad,
  onQuitarItem,
  onLimpiarCarrito,
}) {
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pedidoRegistrado, setPedidoRegistrado] = useState(null);

  const tarjetaRef = useRef(null);

  const totalBs = useMemo(
    () =>
      items.reduce(
        (acc, item) => acc + Number(item.price_bs || 0) * Number(item.quantity || 0),
        0
      ),
    [items]
  );

  if (!abierto) return null;

  const itemsParaComprobante = pedidoRegistrado ? pedidoRegistrado.items : items;
  const totalParaComprobante = pedidoRegistrado ? pedidoRegistrado.total_bs : totalBs;
  const nombreParaComprobante = pedidoRegistrado ? pedidoRegistrado.customer_name : clienteNombre.trim();
  const telefonoParaComprobante = pedidoRegistrado
    ? pedidoRegistrado.customer_phone
    : clienteTelefono.trim();
  const codigoActual = pedidoRegistrado?.order_code || 'COTIZACIÓN';
  const fechaActual = pedidoRegistrado?.created_at
    ? new Date(pedidoRegistrado.created_at).toLocaleString('es-BO')
    : new Date().toLocaleString('es-BO');

  const construirMensajeWhatsApp = (codigoPedido, nombreCli, telCli, listaItems, totalMonto) => {
    const lineas = (listaItems || []).map(
      (i) =>
        `• ${i.name} (${i.quantity} x ${formatearBs(i.price_bs)}) = ${formatearBs(
          Number(i.price_bs) * Number(i.quantity)
        )}`
    );

    return [
      `Hola *${EMPRESA.nombre}*, deseo confirmar este pedido:`,
      codigoPedido ? `*Código:* ${codigoPedido}` : '',
      `*Cliente:* ${nombreCli}`,
      `*Celular/WhatsApp:* ${telCli}`,
      '',
      '*Detalle:*',
      ...lineas,
      '',
      `*Total General:* ${formatearBs(totalMonto)}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const registrarPedidoEnSupabase = async () => {
    setErrorMsg('');
    if (!clienteNombre.trim() || !clienteTelefono.trim()) {
      setErrorMsg('Completa tu nombre completo y tu número de celular/WhatsApp.');
      return null;
    }
    if (items.length === 0 && !pedidoRegistrado) {
      setErrorMsg('Tu carrito está vacío.');
      return null;
    }

    setGuardando(true);
    try {
      const payload = items.map((i) => ({
        product_id: i.id,
        quantity: i.quantity,
      }));

      const { data, error } = await supabase.rpc('create_verified_order', {
        p_customer_name: clienteNombre.trim(),
        p_customer_phone: clienteTelefono.trim(),
        p_items: payload,
      });

      if (error) throw error;

      setPedidoRegistrado(data);
      onLimpiarCarrito();
      return data;
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo registrar el pedido.');
      return null;
    } finally {
      setGuardando(false);
    }
  };

  const manejarEnviarWhatsApp = async () => {
    let pedido = pedidoRegistrado;
    if (!pedido) {
      pedido = await registrarPedidoEnSupabase();
      if (!pedido) return;
    }

    const mensaje = construirMensajeWhatsApp(
      pedido.order_code,
      pedido.customer_name,
      pedido.customer_phone,
      pedido.items,
      pedido.total_bs
    );
    const url = crearUrlWhatsApp(EMPRESA.whatsappVentas, mensaje);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const manejarDescargarPng = async () => {
    setErrorMsg('');
    let pedido = pedidoRegistrado;
    if (!pedido && clienteNombre.trim() && clienteTelefono.trim() && items.length > 0) {
      pedido = await registrarPedidoEnSupabase();
    }
    const cod = pedido?.order_code || 'cotizacion';
    await capturarElementoComoPng(tarjetaRef.current, `${cod.toLowerCase()}-cristalia.png`);
  };

  const manejarDescargarPdf = async () => {
    setErrorMsg('');
    let pedido = pedidoRegistrado;
    if (!pedido && clienteNombre.trim() && clienteTelefono.trim() && items.length > 0) {
      pedido = await registrarPedidoEnSupabase();
    }
    const lista = pedido?.items || items;
    const totalVal = pedido?.total_bs ?? totalBs;
    const cod = pedido?.order_code || 'COTIZACION';

    generarPdfComprobante({
      codigo: cod,
      fechaTexto: fechaActual,
      clienteNombre: pedido?.customer_name || clienteNombre.trim(),
      clienteTelefono: pedido?.customer_phone || clienteTelefono.trim(),
      items: lista,
      totalBs: totalVal,
      nombreArchivo: `${cod.toLowerCase()}-cristalia.pdf`,
    });
  };

  const manejarCompartir = async () => {
    setErrorMsg('');
    const textoResumen = construirMensajeWhatsApp(
      codigoActual,
      nombreParaComprobante || 'Cliente',
      telefonoParaComprobante || '-',
      itemsParaComprobante,
      totalParaComprobante
    );
    await compartirComprobante({
      elemento: tarjetaRef.current,
      titulo: `${EMPRESA.nombre} — ${codigoActual}`,
      texto: textoResumen,
      nombreArchivo: `${codigoActual.toLowerCase()}-cristalia.png`,
    });
  };

  const iniciarNuevaCotizacion = () => {
    setPedidoRegistrado(null);
    setClienteNombre('');
    setClienteTelefono('');
    setErrorMsg('');
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/35 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold text-slate-900">
              {pedidoRegistrado ? `Pedido ${pedidoRegistrado.order_code}` : 'Tu Cotización'}
            </h2>
            <p className="text-xs text-slate-500">{EMPRESA.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar carrito"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {pedidoRegistrado ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-semibold">
                    Pedido registrado con código {pedidoRegistrado.order_code}
                  </p>
                  <p className="mt-0.5 text-emerald-800">
                    Ya puedes descargar tu comprobante en PNG/PDF, compartirlo o enviarlo por WhatsApp.
                  </p>
                </div>
              </div>

              <ComprobanteTarjeta
                tarjetaRef={tarjetaRef}
                tituloDocumento="Comprobante de Pedido"
                codigo={pedidoRegistrado.order_code}
                fechaTexto={new Date(pedidoRegistrado.created_at).toLocaleString('es-BO')}
                clienteNombre={pedidoRegistrado.customer_name}
                clienteTelefono={pedidoRegistrado.customer_phone}
                items={pedidoRegistrado.items}
                totalBs={pedidoRegistrado.total_bs}
              />

              <button
                type="button"
                onClick={iniciarNuevaCotizacion}
                className="w-full rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Crear otra cotización
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Aún no añadiste productos a tu cotización.
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-[#FAFAFA] px-3.5">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatearBs(item.price_bs)} c/u · Subtotal:{' '}
                        <strong className="text-slate-700">
                          {formatearBs(Number(item.price_bs) * Number(item.quantity))}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onActualizarCantidad(item.id, item.quantity - 1)}
                        className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-5 text-center text-xs font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onActualizarCantidad(item.id, item.quantity + 1)}
                        className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuitarItem(item.id)}
                        aria-label="Eliminar producto"
                        className="ml-1 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <p className="text-xs font-semibold text-slate-800">Datos para registrar tu pedido</p>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Ej. Ana María Gómez"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Número de celular / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    placeholder="Ej. 70012345"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              {/* Vista oculta/previa limpia para captura PNG */}
              <div className="sr-only" aria-hidden="true">
                <ComprobanteTarjeta
                  tarjetaRef={tarjetaRef}
                  tituloDocumento="Cotización / Pedido"
                  codigo={codigoActual}
                  fechaTexto={fechaActual}
                  clienteNombre={clienteNombre}
                  clienteTelefono={clienteTelefono}
                  items={items}
                  totalBs={totalBs}
                />
              </div>
            </>
          )}
        </div>

        {(items.length > 0 || pedidoRegistrado) && (
          <div className="space-y-2.5 border-t border-slate-200 bg-[#FAFAFA] px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">Total General</span>
              <span className="text-base font-bold text-slate-900">
                {formatearBs(totalParaComprobante)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={guardando}
                onClick={manejarDescargarPng}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <FileImage className="h-3.5 w-3.5" />
                <span>PNG</span>
              </button>

              <button
                type="button"
                disabled={guardando}
                onClick={manejarDescargarPdf}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>PDF</span>
              </button>

              <button
                type="button"
                disabled={guardando}
                onClick={manejarCompartir}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Compartir</span>
              </button>
            </div>

            {!pedidoRegistrado && (
              <button
                type="button"
                disabled={guardando}
                onClick={registrarPedidoEnSupabase}
                className="w-full rounded-xl border border-slate-900 bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
              >
                {guardando ? 'Registrando pedido...' : 'Generar código PED-XXXX'}
              </button>
            )}

            <button
              type="button"
              disabled={guardando}
              onClick={manejarEnviarWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <MessageCircle className="h-4 w-4 text-emerald-300" />
              <span>{guardando ? 'Procesando...' : 'Enviar pedido por WhatsApp'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}