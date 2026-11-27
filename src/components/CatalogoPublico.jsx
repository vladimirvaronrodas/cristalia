import { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Minus,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatearBs } from '../utils/formato';

export default function CatalogoPublico({
  categorias = [],
  productos = [],
  relacionesCategoria = [],
  onAgregarAlCarrito,
}) {
  const [categoriaActiva, setCategoriaActiva] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [cantidadesPorProducto, setCantidadesPorProducto] = useState({});
  const [slidePorProducto, setSlidePorProducto] = useState({});
  const [inicioToqueX, setInicioToqueX] = useState(null);

  const mapaCategoriasPorNombre = useMemo(() => {
    const porId = new Map(categorias.map((c) => [c.id, c.name]));
    const porProducto = new Map();

    relacionesCategoria.forEach((rel) => {
      const nombreCat = porId.get(rel.category_id);
      if (!nombreCat) return;
      if (!porProducto.has(rel.product_id)) {
        porProducto.set(rel.product_id, []);
      }
      porProducto.get(rel.product_id).push({
        id: rel.category_id,
        name: nombreCat,
      });
    });

    return porProducto;
  }, [categorias, relacionesCategoria]);

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return productos.filter((prod) => {
      const catsProd = mapaCategoriasPorNombre.get(prod.id) || [];
      const coincideCategoria =
        categoriaActiva === 'TODOS' ||
        catsProd.some((c) => c.id === categoriaActiva);

      const coincideBusqueda =
        !termino || prod.name.toLowerCase().includes(termino);

      return coincideCategoria && coincideBusqueda;
    });
  }, [productos, mapaCategoriasPorNombre, categoriaActiva, busqueda]);

  const obtenerCantidad = (id) => cantidadesPorProducto[id] || 1;

  const cambiarCantidad = (id, delta) => {
    setCantidadesPorProducto((prev) => {
      const actual = prev[id] || 1;
      const siguiente = Math.max(1, actual + delta);
      return { ...prev, [id]: siguiente };
    });
  };

  const cambiarSlide = (prodId, totalSlides, delta) => {
    setSlidePorProducto((prev) => {
      const actual = prev[prodId] || 0;
      const siguiente = (actual + delta + totalSlides) % totalSlides;
      return { ...prev, [prodId]: siguiente };
    });
  };

  return (
    <section className="space-y-6">
      {/* Buscador y barra horizontal deslizable de categorías */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar juegos de mesa, copas, platos..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-800 shadow-2xs outline-none transition focus:border-slate-400"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCategoriaActiva('TODOS')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer ${
              categoriaActiva === 'TODOS'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            Todos
          </button>

          {categorias.map((cat) => {
            const activa = categoriaActiva === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaActiva(cat.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer ${
                  activa
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No hay piezas visibles en esta selección
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Prueba cambiando de categoría o limpiando el buscador.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {productosFiltrados.map((prod) => {
            const catsProd = mapaCategoriasPorNombre.get(prod.id) || [];
            const cant = obtenerCantidad(prod.id);
            const imagenes = [prod.image_url, prod.image_url_2].filter(Boolean);
            const tieneCarrusel = imagenes.length > 1;
            const indiceSlide = tieneCarrusel
              ? Math.min(slidePorProducto[prod.id] || 0, imagenes.length - 1)
              : 0;

            return (
              <article
                key={prod.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition hover:border-slate-300 hover:shadow-sm"
              >
                <div>
                  <div
                    onTouchStart={(e) => {
                      if (tieneCarrusel) {
                        setInicioToqueX(e.touches[0].clientX);
                      }
                    }}
                    onTouchEnd={(e) => {
                      if (!tieneCarrusel || inicioToqueX === null) return;
                      const deltaX = e.changedTouches[0].clientX - inicioToqueX;
                      if (Math.abs(deltaX) > 35) {
                        cambiarSlide(prod.id, imagenes.length, deltaX < 0 ? 1 : -1);
                      }
                      setInicioToqueX(null);
                    }}
                    className="relative aspect-square w-full overflow-hidden bg-[#FAFAFA]"
                  >
                    {imagenes.length === 0 ? (
                      <div className="flex h-full w-full items-center justify-center p-4">
                        <span className="text-xs text-slate-400">Sin imagen</span>
                      </div>
                    ) : !tieneCarrusel ? (
                      <div className="flex h-full w-full items-center justify-center p-4">
                        <img
                          src={imagenes[0]}
                          alt={prod.name}
                          loading="lazy"
                          className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
                        />
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex h-full w-full transition-transform duration-300 ease-out"
                          style={{ transform: `translateX(-${indiceSlide * 100}%)` }}
                        >
                          {imagenes.map((src, idx) => (
                            <div
                              key={idx}
                              className="flex h-full w-full shrink-0 items-center justify-center p-4"
                            >
                              <img
                                src={src}
                                alt={`${prod.name} (${idx + 1})`}
                                loading="lazy"
                                className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
                              />
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => cambiarSlide(prod.id, imagenes.length, -1)}
                          aria-label="Foto anterior"
                          className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white/85 p-1 text-slate-700 shadow-2xs backdrop-blur-[2px] transition hover:bg-white hover:text-slate-900 cursor-pointer"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => cambiarSlide(prod.id, imagenes.length, 1)}
                          aria-label="Siguiente foto"
                          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white/85 p-1 text-slate-700 shadow-2xs backdrop-blur-[2px] transition hover:bg-white hover:text-slate-900 cursor-pointer"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>

                        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/80 px-2 py-0.5 backdrop-blur-[2px]">
                          {imagenes.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              aria-label={`Ver foto ${idx + 1}`}
                              onClick={() =>
                                setSlidePorProducto((prev) => ({
                                  ...prev,
                                  [prod.id]: idx,
                                }))
                              }
                              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                indiceSlide === idx
                                  ? 'w-3.5 bg-slate-800'
                                  : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="p-4 pb-2">
                    {catsProd.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {catsProd.map((c) => (
                          <span
                            key={c.id}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <h2 className="line-clamp-2 text-sm font-semibold text-slate-900">
                      {prod.name}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {formatearBs(prod.price_bs)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-4 pt-2">
                  <div className="flex items-center rounded-lg border border-slate-200 bg-[#FAFAFA]">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(prod.id, -1)}
                      aria-label="Restar cantidad"
                      className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-6 text-center text-xs font-semibold text-slate-800">
                      {cant}
                    </span>
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(prod.id, 1)}
                      aria-label="Sumar cantidad"
                      className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onAgregarAlCarrito(prod, cant);
                      setCantidadesPorProducto((prev) => ({ ...prev, [prod.id]: 1 }));
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Añadir</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}