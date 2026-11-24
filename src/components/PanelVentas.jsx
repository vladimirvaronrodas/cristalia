import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileImage,
  FileText,
  LogOut,
  MessageCircle,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  X,
  XCircle,
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

export default function PanelVentas({
  usuarioActual,
  onCerrarSesion,
  incrustado = false,
}) {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [avisoOk, setAvisoOk] = useState('');

  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // 'TODOS' | 'PENDIENTE' | 'DECLINADO' | 'DESPACHADO'
  const [busqueda, setBusqueda] = useState('');
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);

  const comprobanteRef = useRef(null);
  const esAdminTotal = usuarioActual?.role === 'admin_total';

  const cargarPedidos = useCallback(async () => {
    setCargando(true);
    setErrorMsg('');

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMsg(error.message || 'No se pudieron cargar los pedidos.');
    } else {
      setPedidos(data || []);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const pedidosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return pedidos.filter((ped) => {
      const coincideEstado =
        filtroEstado === 'TODOS' || ped.status === filtroEstado;

      const coincideTexto =
        !q ||
        String(ped.order_code || '').toLowerCase().includes(q) ||
        String(ped.customer_name || '').toLowerCase().includes(q) ||
        String(ped.customer_phone || '').toLowerCase().includes(q);

      return coincideEstado && coincideTexto;
    });
  }, [pedidos, filtroEstado, busqueda]);

  const marcarComoDespachado = async (pedido) => {
    setErrorMsg('');
    setAvisoOk('');
    setProcesandoId(pedido.id);

    try {
      const fechaDespacho = new Date().toISOString();
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'DESPACHADO',
          dispatched_at: fechaDespacho,
        })
        .eq('id', pedido.id);

      if (error) throw error;

      const actualizado = {
        ...pedido,
        status: 'DESPACHADO',
        dispatched_at: fechaDespacho,
      };

      setPedidos((prev) =>
        prev.map((p) => (p.id === pedido.id ? actualizado : p))
      );
      if (pedidoSeleccionado?.id === pedido.id) {
        setPedidoSeleccionado(actualizado);
      }
      setAvisoOk(`Pedido ${pedido.order_code} marcado como DESPACHADO.`);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo actualizar el estado del pedido.');
    } finally {
      setProcesandoId(null);
    }
  };

  const marcarComoDeclinado = async (pedido) => {
    if (
      !window.confirm(
        `¿Marcar el pedido ${pedido.order_code} de ${pedido.customer_name} como DECLINADO?`
      )
    ) {
      return;
    }

    setErrorMsg('');
    setAvisoOk('');
    setProcesandoId(pedido.id);

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'DECLINADO',
        })
        .eq('id', pedido.id);

      if (error) throw error;

      const actualizado = {
        ...pedido,
        status: 'DECLINADO',
      };

      setPedidos((prev) =>
        prev.map((p) => (p.id === pedido.id ? actualizado : p))
      );
      if (pedidoSeleccionado?.id === pedido.id) {
        setPedidoSeleccionado(actualizado);
      }
      setAvisoOk(`Pedido ${pedido.order_code} marcado como DECLINADO.`);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo declinar el pedido.');
    } finally {
      setProcesandoId(null);
    }
  };

  const eliminarPedido = async (pedido) => {
    if (!esAdminTotal) return;
    if (
      !window.confirm(
        `¿Eliminar permanentemente el pedido ${pedido.order_code} de ${pedido.customer_name}?`
      )
    ) {
      return;
    }

    setErrorMsg('');
    setAvisoOk('');
    setProcesandoId(pedido.id);

    try {
      const { error } = await supabase.from('orders').delete().eq('id', pedido.id);
      if (error) throw error;

      setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
      if (pedidoSeleccionado?.id === pedido.id) {
        setPedidoSeleccionado(null);
      }
      setAvisoOk(`Pedido ${pedido.order_code} eliminado.`);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo eliminar el pedido.');
    } finally {
      setProcesandoId(null);
    }
  };

  const construirMensajeCliente = (pedido) => {
    const itemsLista = Array.isArray(pedido.items) ? pedido.items : [];
    const lineas = itemsLista.map(
      (i) =>
        `• ${i.name} (${i.quantity} x ${formatearBs(i.price_bs)}) = ${formatearBs(
          Number(i.price_bs) * Number(i.quantity)
        )}`
    );

    return [
      `*${EMPRESA.nombre}* — ${EMPRESA.eslogan}`,
      `Recibo de pedido: *${pedido.order_code}*`,
      `Estado: *${pedido.status}*`,
      `Cliente: ${pedido.customer_name}`,
      '',
      '*Detalle:*',
      ...lineas,
      '',
      `*Total General:* ${formatearBs(pedido.total_bs)}`,
    ].join('\n');
  };

  const enviarWhatsAppCliente = (pedido) => {
    const mensaje = construirMensajeCliente(pedido);
    const url = crearUrlWhatsApp(pedido.customer_phone, mensaje);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const descargarPngPedido = async (pedido) => {
    setPedidoSeleccionado(pedido);
    setTimeout(async () => {
      const despachado = pedido.status === 'DESPACHADO';
      const declinado = pedido.status === 'DECLINADO';
      const sufijo = despachado ? '-despachado' : declinado ? '-declinado' : '';
      await capturarElementoComoPng(
        comprobanteRef.current,
        `${String(pedido.order_code || 'recibo').toLowerCase()}${sufijo}-cristalia.png`
      );
    }, 80);
  };

  const descargarPdfPedido = (pedido) => {
    const despachado = pedido.status === 'DESPACHADO';
    const declinado = pedido.status === 'DECLINADO';
    const sufijo = despachado ? '-despachado' : declinado ? '-declinado' : '';
    generarPdfComprobante({
      codigo: pedido.order_code,
      fechaTexto: pedido.created_at
        ? new Date(pedido.created_at).toLocaleString('es-BO')
        : '',
      clienteNombre: pedido.customer_name,
      clienteTelefono: pedido.customer_phone,
      items: Array.isArray(pedido.items) ? pedido.items : [],
      totalBs: pedido.total_bs,
      esDespachado: despachado,
      nombreArchivo: `${String(pedido.order_code || 'recibo').toLowerCase()}${sufijo}-cristalia.pdf`,
    });
  };

  const compartirPedido = async (pedido) => {
    setPedidoSeleccionado(pedido);
    setTimeout(async () => {
      await compartirComprobante({
        elemento: comprobanteRef.current,
        titulo: `${EMPRESA.nombre} — ${pedido.order_code}`,
        texto: construirMensajeCliente(pedido),
        nombreArchivo: `${String(pedido.order_code || 'recibo').toLowerCase()}-cristalia.png`,
      });
    }, 80);
  };

  return (
    <section
      className={
        incrustado
          ? 'space-y-5'
          : 'space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs'
      }
    >
      {!incrustado && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {EMPRESA.nombre} · Gestión Comercial
            </p>
            <h1 className="font-serif text-xl font-semibold text-slate-900">
              Panel de Ventas y Pedidos
            </h1>
            <p className="text-xs text-slate-500">
              Sesión: <strong>{usuarioActual?.username}</strong> ({usuarioActual?.role})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cargarPedidos}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={onCerrarSesion}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      )}

      {incrustado && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={cargarPedidos}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualizar pedidos</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      {avisoOk && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          {avisoOk}
        </div>
      )}

      {/* Buscador y filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por PED-XXXX, nombre de cliente o celular..."
            className="w-full rounded-xl border border-slate-200 bg-[#FAFAFA] py-2 pr-3 pl-9 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'PENDIENTE', label: 'Pendientes' },
            { id: 'DECLINADO', label: 'Declinados' },
            { id: 'DESPACHADO', label: 'Despachados' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroEstado(tab.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                filtroEstado === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-[#FAFAFA] text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modal / vista previa de comprobante para captura PNG limpia */}
      {pedidoSeleccionado && (
        <div className="rounded-2xl border border-slate-200 bg-[#FAFAFA] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Vista previa de comprobante — {pedidoSeleccionado.order_code}
            </span>
            <button
              type="button"
              onClick={() => setPedidoSeleccionado(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mx-auto max-w-md">
            <ComprobanteTarjeta
              tarjetaRef={comprobanteRef}
              tituloDocumento="Recibo de Venta"
              codigo={pedidoSeleccionado.order_code}
              fechaTexto={
                pedidoSeleccionado.created_at
                  ? new Date(pedidoSeleccionado.created_at).toLocaleString('es-BO')
                  : ''
              }
              clienteNombre={pedidoSeleccionado.customer_name}
              clienteTelefono={pedidoSeleccionado.customer_phone}
              items={Array.isArray(pedidoSeleccionado.items) ? pedidoSeleccionado.items : []}
              totalBs={pedidoSeleccionado.total_bs}
              selloDespachado={pedidoSeleccionado.status === 'DESPACHADO'}
              selloDeclinado={pedidoSeleccionado.status === 'DECLINADO'}
            />
          </div>
        </div>
      )}

      {/* Listado de pedidos */}
      {cargando ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-28 animate-pulse rounded-2xl border border-slate-200/70 bg-[#FAFAFA]"
            />
          ))}
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-[#FAFAFA] p-8 text-center text-xs text-slate-500">
          No hay pedidos que coincidan con el filtro actual.
        </div>
      ) : (
        <div className="space-y-3">
          {pedidosFiltrados.map((ped) => {
            const estaDespachado = ped.status === 'DESPACHADO';
            const estaDeclinado = ped.status === 'DECLINADO';
            const estaPendiente = !estaDespachado && !estaDeclinado;
            const itemsLista = Array.isArray(ped.items) ? ped.items : [];
            const ocupado = procesandoId === ped.id;

            return (
              <div
                key={ped.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {ped.order_code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          estaDespachado
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : estaDeclinado
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {estaDespachado ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : estaDeclinado ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {ped.status}
                      </span>
                    </div>

                    <p className="mt-1 text-xs font-medium text-slate-800">
                      Cliente: {ped.customer_name} · Celular/WhatsApp:{' '}
                      <span className="font-semibold">{ped.customer_phone}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Creado:{' '}
                      {ped.created_at
                        ? new Date(ped.created_at).toLocaleString('es-BO')
                        : '-'}
                      {ped.dispatched_at
                        ? ` · Despachado: ${new Date(
                            ped.dispatched_at
                          ).toLocaleString('es-BO')}`
                        : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">Total</p>
                    <p className="text-base font-bold text-slate-900">
                      {formatearBs(ped.total_bs)}
                    </p>
                  </div>
                </div>

                {/* Detalle resumido de artículos */}
                <div className="mt-2.5 space-y-1 text-xs text-slate-600">
                  {itemsLista.map((item, idx) => (
                    <div
                      key={`${item.product_id || idx}`}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">
                        {item.quantity} × {item.name} ({formatearBs(item.price_bs)})
                      </span>
                      <span className="shrink-0 font-medium text-slate-800">
                        {formatearBs(Number(item.price_bs) * Number(item.quantity))}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Acciones */}
                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {estaPendiente && (
                    <>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => marcarComoDespachado(ped)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Marcar como DESPACHADO</span>
                      </button>

                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => marcarComoDeclinado(ped)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Declinar</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => enviarWhatsAppCliente(ped)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-300" />
                    <span>WhatsApp cliente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => descargarPngPedido(ped)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <FileImage className="h-3.5 w-3.5" />
                    <span>PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => descargarPdfPedido(ped)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => compartirPedido(ped)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Compartir</span>
                  </button>

                  {esAdminTotal && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => eliminarPedido(ped)}
                      className="ml-auto inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}