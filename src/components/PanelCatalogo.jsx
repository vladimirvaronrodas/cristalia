import React, { useMemo, useState } from 'react';
import {
  FolderPlus,
  PackagePlus,
  FileDown,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  LogOut,
  Check,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EMPRESA } from '../config/empresa';
import { formatearBs } from '../utils/formato';
import { optimizarImagenEnNavegador } from '../utils/imagen';
import { generarCatalogoPdf } from '../utils/catalogoPdf';

export default function PanelCatalogo({
  usuarioActual,
  categorias = [],
  productos = [],
  relacionesCategoria = [],
  onRecargarTodo,
  onCerrarSesion,
}) {
  const [pestana, setPestana] = useState('PRODUCTOS'); // 'PRODUCTOS' | 'CATEGORIAS' | 'PDF'

  // Estado categorías
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [guardandoCat, setGuardandoCat] = useState(false);

  // Estado formulario producto (crear / editar)
  const [editandoId, setEditandoId] = useState(null);
  const [nombreProd, setNombreProd] = useState('');
  const [precioProd, setPrecioProd] = useState('');
  const [visibleProd, setVisibleProd] = useState(true);
  const [catsSeleccionadasProd, setCatsSeleccionadasProd] = useState([]);
  const [archivoImagen, setArchivoImagen] = useState(null);
  const [urlImagenActual, setUrlImagenActual] = useState('');
  const [guardandoProd, setGuardandoProd] = useState(false);

  // Filtros en tabla de productos
  const [filtroCat, setFiltroCat] = useState('TODOS');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');

  // Generador PDF
  const [modoPdf, setModoPdf] = useState('COMPLETO'); // 'COMPLETO' | 'CATEGORIAS' | 'SELECCION'
  const [catsPdf, setCatsPdf] = useState([]);
  const [idsPdf, setIdsPdf] = useState([]);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const notificar = (tipo, texto) => {
    setMensaje({ tipo, texto });
  };

  const mapaCats = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.name])),
    [categorias]
  );

  const catsIdsPorProducto = useMemo(() => {
    const map = new Map();
    relacionesCategoria.forEach((rel) => {
      if (!map.has(rel.product_id)) map.set(rel.product_id, []);
      map.get(rel.product_id).push(rel.category_id);
    });
    return map;
  }, [relacionesCategoria]);

  const productosFiltradosAdmin = useMemo(() => {
    const q = busquedaAdmin.trim().toLowerCase();
    return productos.filter((p) => {
      const cats = catsIdsPorProducto.get(p.id) || [];
      const okCat = filtroCat === 'TODOS' || cats.includes(filtroCat);
      const okBusq = !q || p.name.toLowerCase().includes(q);
      return okCat && okBusq;
    });
  }, [productos, catsIdsPorProducto, filtroCat, busquedaAdmin]);

  // --- CATEGORÍAS ---
  const crearCategoria = async (e) => {
    e.preventDefault();
    const limpio = nuevaCategoria.trim();
    if (!limpio) return;
    setGuardandoCat(true);
    notificar('', '');
    try {
      const { error } = await supabase.from('categories').insert({
        name: limpio,
        sort_order: categorias.length + 1,
      });
      if (error) throw error;
      setNuevaCategoria('');
      await onRecargarTodo();
      notificar('ok', `Categoría "${limpio}" creada.`);
    } catch (err) {
      notificar('error', err.message || 'No se pudo crear la categoría.');
    } finally {
      setGuardandoCat(false);
    }
  };

  const eliminarCategoria = async (cat) => {
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    notificar('', '');
    try {
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      if (error) throw error;
      await onRecargarTodo();
      notificar('ok', `Categoría "${cat.name}" eliminada.`);
    } catch (err) {
      notificar('error', err.message || 'No se pudo eliminar la categoría.');
    }
  };

  // --- PRODUCTOS ---
  const limpiarFormularioProducto = () => {
    setEditandoId(null);
    setNombreProd('');
    setPrecioProd('');
    setVisibleProd(true);
    setCatsSeleccionadasProd([]);
    setArchivoImagen(null);
    setUrlImagenActual('');
  };

  const cargarProductoParaEditar = (prod) => {
    setPestana('PRODUCTOS');
    setEditandoId(prod.id);
    setNombreProd(prod.name);
    setPrecioProd(String(prod.price_bs));
    setVisibleProd(Boolean(prod.is_visible));
    setCatsSeleccionadasProd(catsIdsPorProducto.get(prod.id) || []);
    setUrlImagenActual(prod.image_url || '');
    setArchivoImagen(null);
    notificar('', '');
  };

  const alternarCategoriaProducto = (catId) => {
    setCatsSeleccionadasProd((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const manejarSeleccionArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    notificar('', '');
    try {
      const optimizada = await optimizarImagenEnNavegador(file);
      setArchivoImagen(optimizada);
      notificar(
        'ok',
        `Imagen lista (${(optimizada.size / 1024).toFixed(0)} KB en WebP).`
      );
    } catch (err) {
      setArchivoImagen(null);
      notificar('error', err.message);
    }
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    notificar('', '');

    const nombreLimpio = nombreProd.trim();
    const precioNumero = Number(precioProd);

    if (!nombreLimpio || Number.isNaN(precioNumero) || precioNumero < 0) {
      notificar('error', 'Ingresa un nombre válido y un precio en Bs. igual o mayor a 0.');
      return;
    }

    setGuardandoProd(true);
    try {
      let imageUrlFinal = urlImagenActual || null;

      if (archivoImagen) {
        const rutaArchivo = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.webp`;

        const { error: uploadError } = await supabase.storage
          .from('productos')
          .upload(rutaArchivo, archivoImagen, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('productos')
          .getPublicUrl(rutaArchivo);

        imageUrlFinal = publicData.publicUrl;
      }

      let productoId = editandoId;

      if (editandoId) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: nombreLimpio,
            price_bs: precioNumero,
            is_visible: visibleProd,
            image_url: imageUrlFinal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editandoId);

        if (updateError) throw updateError;
      } else {
        const { data: creado, error: insertError } = await supabase
          .from('products')
          .insert({
            name: nombreLimpio,
            price_bs: precioNumero,
            is_visible: visibleProd,
            image_url: imageUrlFinal,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        productoId = creado.id;
      }

      // Sincronizar multicategoría
      const { error: delRelError } = await supabase
        .from('product_categories')
        .delete()
        .eq('product_id', productoId);

      if (delRelError) throw delRelError;

      if (catsSeleccionadasProd.length > 0) {
        const filasRel = catsSeleccionadasProd.map((catId) => ({
          product_id: productoId,
          category_id: catId,
        }));
        const { error: insRelError } = await supabase
          .from('product_categories')
          .insert(filasRel);
        if (insRelError) throw insRelError;
      }

      await onRecargarTodo();
      limpiarFormularioProducto();
      notificar(
        'ok',
        editandoId ? 'Producto actualizado.' : 'Producto agregado al catálogo.'
      );
    } catch (err) {
      notificar('error', err.message || 'No se pudo guardar el producto.');
    } finally {
      setGuardandoProd(false);
    }
  };

  const alternarVisibilidad = async (prod) => {
    notificar('', '');
    const { error } = await supabase
      .from('products')
      .update({ is_visible: !prod.is_visible, updated_at: new Date().toISOString() })
      .eq('id', prod.id);

    if (error) {
      notificar('error', error.message);
      return;
    }
    await onRecargarTodo();
  };

  const eliminarProducto = async (prod) => {
    if (!window.confirm(`¿Eliminar "${prod.name}" del catálogo?`)) return;
    notificar('', '');
    const { error } = await supabase.from('products').delete().eq('id', prod.id);
    if (error) {
      notificar('error', error.message);
      return;
    }
    await onRecargarTodo();
    notificar('ok', 'Producto eliminado.');
  };

  // --- PDF ---
  const descargarPdfCatalogo = async () => {
    setGenerandoPdf(true);
    notificar('', '');
    try {
      await generarCatalogoPdf({
        productos,
        categorias,
        relacionesCategoria,
        modo: modoPdf,
        categoriasSeleccionadas: catsPdf,
        idsProductosSeleccionados: idsPdf,
      });
      notificar('ok', 'Catálogo PDF generado y descargado.');
    } catch (err) {
      notificar('error', err.message || 'No se pudo generar el PDF.');
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {EMPRESA.nombre} · Gestión de Catálogo
          </p>
          <h1 className="font-serif text-xl font-semibold text-slate-900">
            Panel de Catálogo y PDFs
          </h1>
          <p className="text-xs text-slate-500">
            Sesión: <strong>{usuarioActual?.username}</strong> ({usuarioActual?.role})
          </p>
        </div>

        <button
          type="button"
          onClick={onCerrarSesion}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Salir</span>
        </button>
      </div>

      {/* Pestañas internas */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPestana('PRODUCTOS')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
            pestana === 'PRODUCTOS'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-[#FAFAFA] text-slate-700 hover:bg-slate-100'
          }`}
        >
          <PackagePlus className="h-3.5 w-3.5" />
          <span>Productos ({productos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setPestana('CATEGORIAS')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
            pestana === 'CATEGORIAS'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-[#FAFAFA] text-slate-700 hover:bg-slate-100'
          }`}
        >
          <FolderPlus className="h-3.5 w-3.5" />
          <span>Categorías ({categorias.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setPestana('PDF')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
            pestana === 'PDF'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-[#FAFAFA] text-slate-700 hover:bg-slate-100'
          }`}
        >
          <FileDown className="h-3.5 w-3.5" />
          <span>Generar Catálogo PDF</span>
        </button>
      </div>

      {mensaje.texto && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-xs ${
            mensaje.tipo === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {/* --- PESTAÑA PRODUCTOS --- */}
      {pestana === 'PRODUCTOS' && (
        <div className="space-y-6">
          <form
            onSubmit={guardarProducto}
            className="space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAFAFA] p-4 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {editandoId ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarFormularioProducto}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  value={nombreProd}
                  onChange={(e) => setNombreProd(e.target.value)}
                  placeholder="Ej. Juego de 6 copas de cristal tallado"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Precio en Bs. *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precioProd}
                  onChange={(e) => setPrecioProd(e.target.value)}
                  placeholder="Ej. 180.00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Imagen (JPG, PNG o WebP — optimización automática)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={manejarSeleccionArchivo}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                />
                {urlImagenActual && !archivoImagen && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Conservando imagen actual del producto.
                  </p>
                )}
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleProd}
                    onChange={(e) => setVisibleProd(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Visible en el catálogo público</span>
                </label>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-slate-600">
                Categorías (puedes marcar una o varias)
              </p>
              <div className="flex flex-wrap gap-2">
                {categorias.map((cat) => {
                  const marcada = catsSeleccionadasProd.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => alternarCategoriaProducto(cat.id)}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                        marcada
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {marcada && <Check className="h-3 w-3" />}
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={guardandoProd}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {guardandoProd
                ? 'Guardando...'
                : editandoId
                ? 'Guardar cambios'
                : 'Publicar producto'}
            </button>
          </form>

          {/* Filtros y listado */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={busquedaAdmin}
                onChange={(e) => setBusquedaAdmin(e.target.value)}
                placeholder="Buscar en productos..."
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
              />
              <select
                value={filtroCat}
                onChange={(e) => setFiltroCat(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none"
              >
                <option value="TODOS">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
              {productosFiltradosAdmin.map((prod) => {
                const nombresCats = (catsIdsPorProducto.get(prod.id) || [])
                  .map((id) => mapaCats.get(id))
                  .filter(Boolean);

                return (
                  <div
                    key={prod.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={prod.image_url || EMPRESA.logoUrl}
                        alt={prod.name}
                        className="h-12 w-12 shrink-0 rounded-xl border border-slate-100 bg-[#FAFAFA] object-contain p-1"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {prod.name}
                        </p>
                        <p className="text-xs font-medium text-slate-700">
                          {formatearBs(prod.price_bs)} ·{' '}
                          <span
                            className={
                              prod.is_visible ? 'text-emerald-700' : 'text-amber-700'
                            }
                          >
                            {prod.is_visible ? 'Visible' : 'Oculto'}
                          </span>
                        </p>
                        {nombresCats.length > 0 && (
                          <p className="text-[11px] text-slate-400">
                            {nombresCats.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => alternarVisibilidad(prod)}
                        title={prod.is_visible ? 'Ocultar' : 'Mostrar'}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        {prod.is_visible ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => cargarProductoParaEditar(prod)}
                        title="Editar"
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => eliminarProducto(prod)}
                        title="Eliminar"
                        className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- PESTAÑA CATEGORÍAS --- */}
      {pestana === 'CATEGORIAS' && (
        <div className="space-y-4">
          <form onSubmit={crearCategoria} className="flex gap-2">
            <input
              type="text"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Nueva categoría (ej. Jarrones y centros de mesa)"
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              disabled={guardandoCat}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              {guardandoCat ? 'Agregando...' : 'Agregar'}
            </button>
          </form>

          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
            {categorias.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-4 py-3 text-xs"
              >
                <span className="font-medium text-slate-800">{cat.name}</span>
                <button
                  type="button"
                  onClick={() => eliminarCategoria(cat)}
                  className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- PESTAÑA PDF --- */}
      {pestana === 'PDF' && (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAFAFA] p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-800">
            Modo de exportación del catálogo PDF
          </p>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'COMPLETO', label: 'Catálogo completo visible' },
              { id: 'CATEGORIAS', label: 'Por categorías específicas' },
              { id: 'SELECCION', label: 'Selección manual con checkboxes' },
            ].map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setModoPdf(op.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-medium cursor-pointer ${
                  modoPdf === op.id
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          {modoPdf === 'CATEGORIAS' && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
              {categorias.map((cat) => {
                const activa = catsPdf.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={activa}
                      onChange={() =>
                        setCatsPdf((prev) =>
                          prev.includes(cat.id)
                            ? prev.filter((id) => id !== cat.id)
                            : [...prev, cat.id]
                        )
                      }
                    />
                    <span>{cat.name}</span>
                  </label>
                );
              })}
            </div>
          )}

          {modoPdf === 'SELECCION' && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
              {productos
                .filter((p) => p.is_visible)
                .map((prod) => {
                  const marcado = idsPdf.includes(prod.id);
                  return (
                    <label
                      key={prod.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50 cursor-pointer"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() =>
                            setIdsPdf((prev) =>
                              prev.includes(prod.id)
                                ? prev.filter((id) => id !== prod.id)
                                : [...prev, prod.id]
                            )
                          }
                        />
                        <span className="truncate font-medium text-slate-800">
                          {prod.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {formatearBs(prod.price_bs)}
                      </span>
                    </label>
                  );
                })}
            </div>
          )}

          <button
            type="button"
            disabled={generandoPdf}
            onClick={descargarPdfCatalogo}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            <span>{generandoPdf ? 'Generando PDF...' : 'Descargar Catálogo PDF'}</span>
          </button>
        </div>
      )}
    </section>
  );
}