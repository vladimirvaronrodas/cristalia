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
  Upload,
  Plus,
  Layers,
  ImagePlus,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EMPRESA } from '../config/empresa';
import { formatearBs } from '../utils/formato';
import { optimizarImagenEnNavegador } from '../utils/imagen';
import { generarCatalogoPdf } from '../utils/catalogoPdf';

const PALABRAS_IGNORADAS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'para',
  'con',
  'sin',
  'por',
  'en',
  'y',
  'o',
  'a',
  'un',
  'una',
  'bs',
  'bob',
]);

function extraerNombreDesdeArchivo(nombreArchivo = '') {
  const sinExtension = String(nombreArchivo).replace(/\.[^/.]+$/, '');
  const conEspacios = sinExtension
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!conEspacios) return '';
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

function normalizarTextoComparacion(texto = '') {
  return String(texto)
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function obtenerRaizPalabra(palabra = '') {
  if (palabra.length > 4 && palabra.endsWith('es')) {
    return palabra.slice(0, -2);
  }
  if (palabra.length > 3 && palabra.endsWith('s')) {
    return palabra.slice(0, -1);
  }
  return palabra;
}

function extraerTokensClave(texto = '') {
  const limpio = normalizarTextoComparacion(texto);
  if (!limpio) return [];
  return limpio
    .split(' ')
    .filter((tok) => tok && !/^\d+$/.test(tok) && !PALABRAS_IGNORADAS.has(tok))
    .map(obtenerRaizPalabra);
}

function calcularSimilitudProducto(nombreArchivo, nombreProducto) {
  const normArch = normalizarTextoComparacion(nombreArchivo);
  const normProd = normalizarTextoComparacion(nombreProducto);
  if (!normArch || !normProd) return 0;

  if (normArch === normProd) return 1;

  // Coincidencia de prefijo (ej. "postrero liso 2" vs "postrero liso")
  if (
    normProd.length >= 4 &&
    (normArch.startsWith(`${normProd} `) || normProd.startsWith(`${normArch} `))
  ) {
    return 0.94;
  }

  const tokensArch = extraerTokensClave(nombreArchivo);
  const tokensProd = extraerTokensClave(nombreProducto);
  if (tokensArch.length === 0 || tokensProd.length === 0) return 0;

  const setArch = new Set(tokensArch);
  let aciertos = 0;
  for (const tok of tokensProd) {
    if (setArch.has(tok)) aciertos++;
  }

  if (aciertos === 0) return 0;

  const coberturaProd = aciertos / tokensProd.length;
  const coberturaArch = aciertos / tokensArch.length;
  const primeraCoincide = tokensArch[0] === tokensProd[0] ? 0.15 : 0;

  return Math.min(0.93, 0.55 * coberturaProd + 0.3 * coberturaArch + primeraCoincide);
}

function buscarMejorProductoCoincidente(
  nombreArchivo,
  productos = [],
  idsYaAsignados = new Set()
) {
  let mejorProd = null;
  let mejorPuntaje = 0;

  for (const prod of productos) {
    if (idsYaAsignados.has(prod.id)) continue;
    const puntaje = calcularSimilitudProducto(nombreArchivo, prod.name);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorProd = prod;
    }
  }

  if (mejorProd && mejorPuntaje >= 0.55) {
    return mejorProd;
  }
  return null;
}

function crearFilaLoteVacia() {
  return {
    idTemporal: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    archivo: null,
    nombreArchivo: '',
    vistaPrevia: '',
    nombre: '',
    precio: '',
  };
}

function crearBloqueFilas(cantidad = 5) {
  return Array.from({ length: cantidad }, () => crearFilaLoteVacia());
}

export default function PanelCatalogo({
  usuarioActual,
  categorias = [],
  productos = [],
  relacionesCategoria = [],
  onRecargarTodo,
  onCerrarSesion,
}) {
  const [pestana, setPestana] = useState('PRODUCTOS'); // 'PRODUCTOS' | 'CATEGORIAS' | 'PDF'
  const [modoCarga, setModoCarga] = useState('INDIVIDUAL'); // 'INDIVIDUAL' | 'LOTE' | 'REEMPLAZAR'

  // Estado categorías
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [guardandoCat, setGuardandoCat] = useState(false);

  // Estado formulario producto individual (crear / editar)
  const [editandoId, setEditandoId] = useState(null);
  const [nombreProd, setNombreProd] = useState('');
  const [precioProd, setPrecioProd] = useState('');
  const [visibleProd, setVisibleProd] = useState(true);
  const [catsSeleccionadasProd, setCatsSeleccionadasProd] = useState([]);
  const [archivoImagen, setArchivoImagen] = useState(null);
  const [nombreArchivo1, setNombreArchivo1] = useState('');
  const [urlImagenActual, setUrlImagenActual] = useState('');
  const [archivoImagen2, setArchivoImagen2] = useState(null);
  const [nombreArchivo2, setNombreArchivo2] = useState('');
  const [urlImagen2Actual, setUrlImagen2Actual] = useState('');
  const [guardandoProd, setGuardandoProd] = useState(false);

  // Estado carga por lotes
  const [filasLote, setFilasLote] = useState(() => crearBloqueFilas(5));
  const [catsLote, setCatsLote] = useState([]);
  const [visibleLote, setVisibleLote] = useState(true);
  const [arrastrandoSobre, setArrastrandoSobre] = useState(false);
  const [progresoLote, setProgresoLote] = useState('');

  // Estado actualización masiva de fotos (y creación rápida de no encontrados)
  const [filasReemplazo, setFilasReemplazo] = useState([]);
  const [arrastrandoReemplazo, setArrastrandoReemplazo] = useState(false);
  const [visibleNuevosReemplazo, setVisibleNuevosReemplazo] = useState(true);
  const [idsFotosActualizadas, setIdsFotosActualizadas] = useState([]);

  // Filtros en tabla de productos
  const [filtroCat, setFiltroCat] = useState('TODOS');
  const [filtroEstadoActualizacion, setFiltroEstadoActualizacion] = useState('TODOS'); // 'TODOS' | 'ACTUALIZADOS' | 'PENDIENTES'
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

  const mapaProductosPorId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos]
  );

  const setIdsActualizados = useMemo(
    () => new Set(idsFotosActualizadas),
    [idsFotosActualizadas]
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
      const estaActualizado = setIdsActualizados.has(p.id);
      const okEstado =
        filtroEstadoActualizacion === 'TODOS' ||
        (filtroEstadoActualizacion === 'ACTUALIZADOS' && estaActualizado) ||
        (filtroEstadoActualizacion === 'PENDIENTES' && !estaActualizado);
      return okCat && okBusq && okEstado;
    });
  }, [
    productos,
    catsIdsPorProducto,
    filtroCat,
    busquedaAdmin,
    setIdsActualizados,
    filtroEstadoActualizacion,
  ]);

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

  // --- PRODUCTO INDIVIDUAL ---
  const limpiarFormularioProducto = () => {
    setEditandoId(null);
    setNombreProd('');
    setPrecioProd('');
    setVisibleProd(true);
    setCatsSeleccionadasProd([]);
    setArchivoImagen(null);
    setNombreArchivo1('');
    setUrlImagenActual('');
    setArchivoImagen2(null);
    setNombreArchivo2('');
    setUrlImagen2Actual('');
  };

  const cargarProductoParaEditar = (prod) => {
    setPestana('PRODUCTOS');
    setModoCarga('INDIVIDUAL');
    setEditandoId(prod.id);
    setNombreProd(prod.name);
    setPrecioProd(String(prod.price_bs));
    setVisibleProd(Boolean(prod.is_visible));
    setCatsSeleccionadasProd(catsIdsPorProducto.get(prod.id) || []);
    setUrlImagenActual(prod.image_url || '');
    setArchivoImagen(null);
    setNombreArchivo1('');
    setUrlImagen2Actual(prod.image_url_2 || '');
    setArchivoImagen2(null);
    setNombreArchivo2('');
    notificar('', '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      setNombreArchivo1(file.name);
      if (!nombreProd.trim()) {
        setNombreProd(extraerNombreDesdeArchivo(file.name));
      }
      notificar(
        'ok',
        `Foto principal "${file.name}" lista (${(optimizada.size / 1024).toFixed(0)} KB en WebP).`
      );
    } catch (err) {
      setArchivoImagen(null);
      setNombreArchivo1('');
      notificar('error', err.message);
    }
  };

  const manejarSeleccionArchivo2 = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    notificar('', '');
    try {
      const optimizada = await optimizarImagenEnNavegador(file);
      setArchivoImagen2(optimizada);
      setNombreArchivo2(file.name);
      notificar(
        'ok',
        `Segunda foto "${file.name}" lista (${(optimizada.size / 1024).toFixed(0)} KB en WebP).`
      );
    } catch (err) {
      setArchivoImagen2(null);
      setNombreArchivo2('');
      notificar('error', err.message);
    }
  };

  const quitarSegundaFoto = () => {
    setArchivoImagen2(null);
    setNombreArchivo2('');
    setUrlImagen2Actual('');
  };

  const subirArchivoWebp = async (archivoWebp) => {
    const rutaArchivo = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('productos')
      .upload(rutaArchivo, archivoWebp, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage
      .from('productos')
      .getPublicUrl(rutaArchivo);

    return publicData.publicUrl;
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
        imageUrlFinal = await subirArchivoWebp(archivoImagen);
      }

      let imageUrl2Final = urlImagen2Actual || null;
      if (archivoImagen2) {
        imageUrl2Final = await subirArchivoWebp(archivoImagen2);
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
            image_url_2: imageUrl2Final,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editandoId);

        if (updateError) throw updateError;
        if (archivoImagen) {
          setIdsFotosActualizadas((prev) =>
            prev.includes(editandoId) ? prev : [...prev, editandoId]
          );
        }
      } else {
        const { data: creado, error: insertError } = await supabase
          .from('products')
          .insert({
            name: nombreLimpio,
            price_bs: precioNumero,
            is_visible: visibleProd,
            image_url: imageUrlFinal,
            image_url_2: imageUrl2Final,
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

  // --- CARGA POR LOTES ---
  const alternarCategoriaLote = (catId) => {
    setCatsLote((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const procesarArchivosEnLote = async (listaArchivos) => {
    const archivos = Array.from(listaArchivos || []).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    if (archivos.length === 0) {
      notificar('error', 'Selecciona imágenes válidas en formato JPG, PNG o WebP.');
      return;
    }

    notificar('', '');
    const nuevasFilas = [];

    for (const file of archivos) {
      try {
        const optimizada = await optimizarImagenEnNavegador(file);
        nuevasFilas.push({
          idTemporal: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          archivo: optimizada,
          nombreArchivo: file.name,
          vistaPrevia: URL.createObjectURL(optimizada),
          nombre: extraerNombreDesdeArchivo(file.name),
          precio: '',
        });
      } catch (err) {
        notificar('error', `Error en "${file.name}": ${err.message}`);
      }
    }

    if (nuevasFilas.length > 0) {
      setFilasLote((prev) => {
        const filasConDatos = prev.filter(
          (f) => f.archivo || f.nombre.trim() || String(f.precio).trim()
        );
        return [...filasConDatos, ...nuevasFilas];
      });
      notificar(
        'ok',
        `${nuevasFilas.length} foto(s) cargadas con nombre extraído automáticamente.`
      );
    }
  };

  const manejarFotoFilaLote = async (idTemporal, file) => {
    if (!file) return;
    notificar('', '');
    try {
      const optimizada = await optimizarImagenEnNavegador(file);
      const vistaPrevia = URL.createObjectURL(optimizada);
      setFilasLote((prev) =>
        prev.map((fila) => {
          if (fila.idTemporal !== idTemporal) return fila;
          return {
            ...fila,
            archivo: optimizada,
            nombreArchivo: file.name,
            vistaPrevia,
            nombre: fila.nombre.trim()
              ? fila.nombre
              : extraerNombreDesdeArchivo(file.name),
          };
        })
      );
    } catch (err) {
      notificar('error', err.message || 'No se pudo procesar la imagen.');
    }
  };

  const actualizarCampoFilaLote = (idTemporal, campo, valor) => {
    setFilasLote((prev) =>
      prev.map((fila) =>
        fila.idTemporal === idTemporal ? { ...fila, [campo]: valor } : fila
      )
    );
  };

  const eliminarFilaLote = (idTemporal) => {
    setFilasLote((prev) => {
      const restantes = prev.filter((f) => f.idTemporal !== idTemporal);
      return restantes.length > 0 ? restantes : crearBloqueFilas(5);
    });
  };

  const guardarLoteProductos = async (e) => {
    e.preventDefault();
    notificar('', '');

    const filasActivas = filasLote.filter(
      (f) => f.archivo || f.nombre.trim() || String(f.precio).trim() !== ''
    );

    if (filasActivas.length === 0) {
      notificar('error', 'Agrega al menos un producto con foto, nombre y precio.');
      return;
    }

    for (let idx = 0; idx < filasActivas.length; idx++) {
      const fila = filasActivas[idx];
      const precioNum = Number(fila.precio);
      if (!fila.nombre.trim()) {
        notificar('error', `Falta el nombre en el producto #${idx + 1} del lote.`);
        return;
      }
      if (String(fila.precio).trim() === '' || Number.isNaN(precioNum) || precioNum < 0) {
        notificar(
          'error',
          `Ingresa un precio válido en Bs. para "${fila.nombre.trim()}".`
        );
        return;
      }
    }

    setGuardandoProd(true);
    try {
      for (let i = 0; i < filasActivas.length; i++) {
        const fila = filasActivas[i];
        setProgresoLote(`Guardando ${i + 1} de ${filasActivas.length}...`);

        let imageUrl = null;
        if (fila.archivo) {
          imageUrl = await subirArchivoWebp(fila.archivo);
        }

        const { data: creado, error: insertError } = await supabase
          .from('products')
          .insert({
            name: fila.nombre.trim(),
            price_bs: Number(fila.precio),
            is_visible: visibleLote,
            image_url: imageUrl,
            image_url_2: null,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        if (catsLote.length > 0) {
          const filasRel = catsLote.map((catId) => ({
            product_id: creado.id,
            category_id: catId,
          }));
          const { error: relError } = await supabase
            .from('product_categories')
            .insert(filasRel);
          if (relError) throw relError;
        }
      }

      await onRecargarTodo();
      setFilasLote(crearBloqueFilas(5));
      setProgresoLote('');
      notificar(
        'ok',
        `Se publicaron ${filasActivas.length} producto(s) correctamente en el catálogo.`
      );
    } catch (err) {
      notificar('error', err.message || 'Ocurrió un error al guardar el lote.');
    } finally {
      setProgresoLote('');
      setGuardandoProd(false);
    }
  };

  // --- ACTUALIZAR FOTOS EN LOTE (Y CREAR NO ENCONTRADOS) ---
  const procesarArchivosReemplazo = async (listaArchivos) => {
    const archivos = Array.from(listaArchivos || []).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    if (archivos.length === 0) {
      notificar('error', 'Selecciona imágenes válidas en formato JPG, PNG o WebP.');
      return;
    }

    notificar('', '');
    const idsYaAsignados = new Set(
      filasReemplazo
        .filter((f) => f.accion === 'ACTUALIZAR' && f.productoIdDestino)
        .map((f) => f.productoIdDestino)
    );

    const nuevasFilas = [];
    let coincidencias = 0;

    for (const file of archivos) {
      try {
        const optimizada = await optimizarImagenEnNavegador(file);
        const sugerido = buscarMejorProductoCoincidente(
          file.name,
          productos,
          idsYaAsignados
        );

        if (sugerido) {
          idsYaAsignados.add(sugerido.id);
          coincidencias++;
        }

        nuevasFilas.push({
          idTemporal: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          archivo: optimizada,
          nombreArchivo: file.name,
          vistaPrevia: URL.createObjectURL(optimizada),
          accion: sugerido ? 'ACTUALIZAR' : 'CREAR',
          productoIdDestino: sugerido ? sugerido.id : '',
          coincidenciaAuto: Boolean(sugerido),
          nombreNuevo: extraerNombreDesdeArchivo(file.name),
          precioNuevo: '',
          categoriaIdNueva: '',
        });
      } catch (err) {
        notificar('error', `Error en "${file.name}": ${err.message}`);
      }
    }

    if (nuevasFilas.length > 0) {
      setFilasReemplazo((prev) => [...prev, ...nuevasFilas]);
      const noEncontradas = nuevasFilas.length - coincidencias;
      notificar(
        'ok',
        `${nuevasFilas.length} foto(s) analizadas: ${coincidencias} coincidencia(s) encontrada(s) y ${noEncontradas} sin coincidencia.`
      );
    }
  };

  const cambiarDestinoFilaReemplazo = (idTemporal, valorSelect) => {
    setFilasReemplazo((prev) =>
      prev.map((fila) => {
        if (fila.idTemporal !== idTemporal) return fila;
        if (valorSelect === '__CREAR_NUEVO__') {
          return {
            ...fila,
            accion: 'CREAR',
            productoIdDestino: '',
            coincidenciaAuto: false,
          };
        }
        return {
          ...fila,
          accion: 'ACTUALIZAR',
          productoIdDestino: valorSelect,
          coincidenciaAuto: false,
        };
      })
    );
  };

  const actualizarCampoFilaReemplazo = (idTemporal, campo, valor) => {
    setFilasReemplazo((prev) =>
      prev.map((fila) =>
        fila.idTemporal === idTemporal ? { ...fila, [campo]: valor } : fila
      )
    );
  };

  const eliminarFilaReemplazo = (idTemporal) => {
    setFilasReemplazo((prev) => prev.filter((f) => f.idTemporal !== idTemporal));
  };

  const aplicarLoteReemplazo = async (e) => {
    e.preventDefault();
    notificar('', '');

    if (filasReemplazo.length === 0) {
      notificar('error', 'Arrastra o selecciona al menos una imagen primero.');
      return;
    }

    for (let i = 0; i < filasReemplazo.length; i++) {
      const fila = filasReemplazo[i];
      if (fila.accion === 'ACTUALIZAR' && !fila.productoIdDestino) {
        notificar(
          'error',
          `Selecciona un producto destino para "${fila.nombreArchivo}".`
        );
        return;
      }
      if (fila.accion === 'CREAR') {
        const precioNum = Number(fila.precioNuevo);
        if (!fila.nombreNuevo.trim()) {
          notificar(
            'error',
            `Ingresa un nombre para el producto nuevo "${fila.nombreArchivo}".`
          );
          return;
        }
        if (
          String(fila.precioNuevo).trim() === '' ||
          Number.isNaN(precioNum) ||
          precioNum < 0
        ) {
          notificar(
            'error',
            `Ingresa un precio válido en Bs. para "${fila.nombreNuevo.trim()}" o quita la fila si no deseas subirla.`
          );
          return;
        }
      }
    }

    setGuardandoProd(true);
    let totalActualizados = 0;
    let totalCreados = 0;
    const nuevosIdsMarcados = [];

    try {
      for (let i = 0; i < filasReemplazo.length; i++) {
        const fila = filasReemplazo[i];
        setProgresoLote(`Procesando ${i + 1} de ${filasReemplazo.length}...`);

        const imageUrl = await subirArchivoWebp(fila.archivo);

        if (fila.accion === 'ACTUALIZAR') {
          const { error: updateError } = await supabase
            .from('products')
            .update({
              image_url: imageUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', fila.productoIdDestino);

          if (updateError) throw updateError;
          totalActualizados++;
          nuevosIdsMarcados.push(fila.productoIdDestino);
        } else {
          const { data: creado, error: insertError } = await supabase
            .from('products')
            .insert({
              name: fila.nombreNuevo.trim(),
              price_bs: Number(fila.precioNuevo),
              is_visible: visibleNuevosReemplazo,
              image_url: imageUrl,
              image_url_2: null,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          if (fila.categoriaIdNueva) {
            const { error: relError } = await supabase
              .from('product_categories')
              .insert({
                product_id: creado.id,
                category_id: fila.categoriaIdNueva,
              });
            if (relError) throw relError;
          }

          totalCreados++;
          nuevosIdsMarcados.push(creado.id);
        }
      }

      await onRecargarTodo();
      setIdsFotosActualizadas((prev) =>
        Array.from(new Set([...prev, ...nuevosIdsMarcados]))
      );
      setFilasReemplazo([]);
      setProgresoLote('');
      notificar(
        'ok',
        `Listo: ${totalActualizados} foto(s) actualizada(s) y ${totalCreados} producto(s) nuevo(s) publicado(s).`
      );
    } catch (err) {
      notificar(
        'error',
        err.message || 'Ocurrió un error al actualizar las fotos del lote.'
      );
    } finally {
      setProgresoLote('');
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

  const totalPendientes = Math.max(0, productos.length - idsFotosActualizadas.length);

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
          {/* Selector de modo: 1 producto vs Lote nuevo vs Actualizar fotos */}
          {!editandoId && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoCarga('INDIVIDUAL');
                  notificar('', '');
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  modoCarga === 'INDIVIDUAL'
                    ? 'bg-slate-800 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PackagePlus className="h-3.5 w-3.5" />
                <span>Agregar 1 producto</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoCarga('LOTE');
                  notificar('', '');
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  modoCarga === 'LOTE'
                    ? 'bg-slate-800 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Agregar varios productos (por lote)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoCarga('REEMPLAZAR');
                  notificar('', '');
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  modoCarga === 'REEMPLAZAR'
                    ? 'bg-slate-800 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Actualizar fotos (por lote)</span>
              </button>
            </div>
          )}

          {/* MODO INDIVIDUAL */}
          {(modoCarga === 'INDIVIDUAL' || editandoId) && (
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
                    Nombre del producto * (se completa solo al subir la foto)
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
                    Foto 1 — Principal (JPG, PNG o WebP)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={manejarSeleccionArchivo}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                  />
                  {nombreArchivo1 && (
                    <p className="mt-1 truncate text-[11px] font-medium text-emerald-700">
                      Archivo: {nombreArchivo1}
                    </p>
                  )}
                  {urlImagenActual && !archivoImagen && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Conservando foto principal actual.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    Foto 2 — Opcional (para carrusel suave)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={manejarSeleccionArchivo2}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                  />
                  {nombreArchivo2 && (
                    <p className="mt-1 truncate text-[11px] font-medium text-emerald-700">
                      Archivo 2: {nombreArchivo2}
                    </p>
                  )}
                  {(urlImagen2Actual || archivoImagen2) && (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {archivoImagen2 ? 'Segunda foto lista.' : 'Segunda foto activa.'}
                      </span>
                      <button
                        type="button"
                        onClick={quitarSegundaFoto}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Quitar foto 2
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
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
          )}

          {/* MODO LOTE (VARIOS PRODUCTOS A LA VEZ) */}
          {modoCarga === 'LOTE' && !editandoId && (
            <form
              onSubmit={guardarLoteProductos}
              className="space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAFAFA] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Carga rápida por lote
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Elige la categoría del grupo, arrastra varias fotos o carga fila por fila de 5 en 5.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilasLote(crearBloqueFilas(5))}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Limpiar filas
                </button>
              </div>

              {/* Categoría general para todo el lote */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5">
                <p className="mb-1.5 text-[11px] font-semibold text-slate-700">
                  Categoría(s) general(es) para todo este lote:
                </p>
                <div className="flex flex-wrap gap-2">
                  {categorias.map((cat) => {
                    const marcada = catsLote.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => alternarCategoriaLote(cat.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                          marcada
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-[#FAFAFA] text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {marcada && <Check className="h-3 w-3" />}
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>

                <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleLote}
                    onChange={(e) => setVisibleLote(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Publicar todos como visibles en el catálogo público</span>
                </label>
              </div>

              {/* Zona de arrastrar o seleccionar múltiples imágenes */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrandoSobre(true);
                }}
                onDragLeave={() => setArrastrandoSobre(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrandoSobre(false);
                  procesarArchivosEnLote(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
                  arrastrandoSobre
                    ? 'border-slate-900 bg-slate-100'
                    : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
              >
                <Upload className="h-6 w-6 text-slate-500" />
                <p className="mt-1.5 text-xs font-semibold text-slate-800">
                  Arrastra varias fotos aquí o haz clic para seleccionarlas juntas
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Extrae automáticamente el nombre de cada foto (JPG, PNG o WebP)
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    procesarArchivosEnLote(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>

              {/* Filas de productos del lote */}
              <div className="space-y-2.5">
                {filasLote.map((fila, idx) => (
                  <div
                    key={fila.idTemporal}
                    className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-12 sm:items-center"
                  >
                    {/* Foto + nombre de archivo */}
                    <div className="flex items-center gap-2.5 sm:col-span-4">
                      <span className="w-4 shrink-0 text-[11px] font-bold text-slate-400">
                        {idx + 1}.
                      </span>
                      {fila.vistaPrevia ? (
                        <img
                          src={fila.vistaPrevia}
                          alt={fila.nombre || 'Vista previa'}
                          className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-[#FAFAFA] object-contain p-0.5"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[#FAFAFA] text-slate-400">
                          <ImagePlus className="h-4 w-4" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <label className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-[#FAFAFA] px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                          <span>{fila.archivo ? 'Cambiar foto' : 'Subir foto'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              manejarFotoFilaLote(fila.idTemporal, e.target.files?.[0]);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                        </label>
                        {fila.nombreArchivo && (
                          <p
                            title={fila.nombreArchivo}
                            className="mt-1 truncate text-[10px] text-emerald-700"
                          >
                            {fila.nombreArchivo}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Nombre del producto */}
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        value={fila.nombre}
                        onChange={(e) =>
                          actualizarCampoFilaLote(fila.idTemporal, 'nombre', e.target.value)
                        }
                        placeholder="Nombre del producto"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                      />
                    </div>

                    {/* Precio + quitar fila */}
                    <div className="flex items-center gap-2 sm:col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fila.precio}
                        onChange={(e) =>
                          actualizarCampoFilaLote(fila.idTemporal, 'precio', e.target.value)
                        }
                        placeholder="Precio Bs."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => eliminarFilaLote(fila.idTemporal)}
                        title="Quitar fila"
                        className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={guardandoProd}
                  onClick={() => setFilasLote((prev) => [...prev, ...crearBloqueFilas(5)])}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Agregar 5 espacios</span>
                </button>

                <button
                  type="submit"
                  disabled={guardandoProd}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {guardandoProd
                    ? progresoLote || 'Publicando lote...'
                    : 'Publicar lote de productos'}
                </button>
              </div>
            </form>
          )}

          {/* MODO ACTUALIZAR FOTOS POR LOTE (Y CREAR NO ENCONTRADOS) */}
          {modoCarga === 'REEMPLAZAR' && !editandoId && (
            <form
              onSubmit={aplicarLoteReemplazo}
              className="space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAFAFA] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Actualizar fotos existentes por lote
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Arrastra tus fotos mezcladas: empareja automáticamente con productos parecidos (conservando precios y categorías) y te permite crear allí mismo los que no existan.
                  </p>
                </div>
                {filasReemplazo.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilasReemplazo([])}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Limpiar lista
                  </button>
                )}
              </div>

              {/* Zona Dropzone */}
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrandoReemplazo(true);
                }}
                onDragLeave={() => setArrastrandoReemplazo(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrandoReemplazo(false);
                  procesarArchivosReemplazo(e.dataTransfer.files);
                }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
                  arrastrandoReemplazo
                    ? 'border-slate-900 bg-slate-100'
                    : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
              >
                <RefreshCw className="h-6 w-6 text-slate-500" />
                <p className="mt-1.5 text-xs font-semibold text-slate-800">
                  Arrastra aquí todas las fotos nuevas o haz clic para seleccionarlas
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Compara las palabras del nombre de archivo con tus {productos.length} productos publicados
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    procesarArchivosReemplazo(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>

              {filasReemplazo.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5">
                    <span className="text-[11px] font-medium text-slate-600">
                      {
                        filasReemplazo.filter((f) => f.accion === 'ACTUALIZAR')
                          .length
                      }{' '}
                      para actualizar foto ·{' '}
                      {filasReemplazo.filter((f) => f.accion === 'CREAR').length}{' '}
                      sin coincidencia (crear como nuevo)
                    </span>

                    <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleNuevosReemplazo}
                        onChange={(e) =>
                          setVisibleNuevosReemplazo(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      <span>Publicar los nuevos como visibles</span>
                    </label>
                  </div>

                  <div className="space-y-2.5">
                    {filasReemplazo.map((fila, idx) => {
                      const prodDestino =
                        fila.accion === 'ACTUALIZAR'
                          ? mapaProductosPorId.get(fila.productoIdDestino)
                          : null;

                      return (
                        <div
                          key={fila.idTemporal}
                          className={`rounded-xl border p-3 transition ${
                            fila.accion === 'CREAR'
                              ? 'border-amber-300 bg-amber-50/40'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            {/* Foto nueva + archivo */}
                            <div className="flex items-center gap-2.5 min-w-0 lg:w-5/12">
                              <span className="w-4 shrink-0 text-[11px] font-bold text-slate-400">
                                {idx + 1}.
                              </span>
                              <img
                                src={fila.vistaPrevia}
                                alt={fila.nombreArchivo}
                                className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-[#FAFAFA] object-contain p-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  title={fila.nombreArchivo}
                                  className="truncate text-xs font-semibold text-slate-800"
                                >
                                  {fila.nombreArchivo}
                                </p>
                                {fila.accion === 'ACTUALIZAR' ? (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {fila.coincidenciaAuto
                                      ? 'Coincidencia sugerida'
                                      : 'Producto asignado'}
                                  </span>
                                ) : (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                    <AlertCircle className="h-3 w-3" />
                                    Producto no encontrado
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Comparación con foto actual + selector de acción */}
                            <div className="flex flex-1 items-center gap-2.5">
                              {prodDestino && (
                                <>
                                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                                  <img
                                    src={prodDestino.image_url || EMPRESA.logoUrl}
                                    alt={prodDestino.name}
                                    title={`Foto actual: ${prodDestino.name}`}
                                    className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-[#FAFAFA] object-contain p-0.5"
                                  />
                                </>
                              )}

                              <div className="min-w-0 flex-1">
                                <label className="mb-1 block text-[10px] font-medium text-slate-500">
                                  {fila.accion === 'ACTUALIZAR'
                                    ? 'Reemplazar foto de:'
                                    : 'Vincular a producto existente o crear nuevo:'}
                                </label>
                                <select
                                  value={
                                    fila.accion === 'CREAR'
                                      ? '__CREAR_NUEVO__'
                                      : fila.productoIdDestino
                                  }
                                  onChange={(e) =>
                                    cambiarDestinoFilaReemplazo(
                                      fila.idTemporal,
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                                >
                                  <option value="__CREAR_NUEVO__">
                                    + Crear como producto nuevo
                                  </option>
                                  {productos.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({formatearBs(p.price_bs)})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  eliminarFilaReemplazo(fila.idTemporal)
                                }
                                title="Omitir esta foto"
                                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Campos rápidos cuando la foto es un producto nuevo */}
                          {fila.accion === 'CREAR' && (
                            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-amber-200/70 pt-3 sm:grid-cols-12">
                              <div className="sm:col-span-6">
                                <input
                                  type="text"
                                  value={fila.nombreNuevo}
                                  onChange={(e) =>
                                    actualizarCampoFilaReemplazo(
                                      fila.idTemporal,
                                      'nombreNuevo',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Nombre del producto nuevo *"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-400"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={fila.precioNuevo}
                                  onChange={(e) =>
                                    actualizarCampoFilaReemplazo(
                                      fila.idTemporal,
                                      'precioNuevo',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Precio Bs. *"
                                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-slate-400"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <select
                                  value={fila.categoriaIdNueva}
                                  onChange={(e) =>
                                    actualizarCampoFilaReemplazo(
                                      fila.idTemporal,
                                      'categoriaIdNueva',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
                                >
                                  <option value="">Sin categoría</option>
                                  {categorias.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={guardandoProd}
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      {guardandoProd
                        ? progresoLote || 'Aplicando cambios...'
                        : `Aplicar cambios (${filasReemplazo.length})`}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

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
              {idsFotosActualizadas.length > 0 && (
                <select
                  value={filtroEstadoActualizacion}
                  onChange={(e) => setFiltroEstadoActualizacion(e.target.value)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs font-medium text-emerald-900 outline-none"
                >
                  <option value="TODOS">Todos ({productos.length})</option>
                  <option value="ACTUALIZADOS">
                    Foto actualizada ({idsFotosActualizadas.length})
                  </option>
                  <option value="PENDIENTES">
                    Sin actualizar ({totalPendientes})
                  </option>
                </select>
              )}
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
              {productosFiltradosAdmin.map((prod) => {
                const nombresCats = (catsIdsPorProducto.get(prod.id) || [])
                  .map((id) => mapaCats.get(id))
                  .filter(Boolean);
                const fueActualizado = setIdsActualizados.has(prod.id);

                return (
                  <div
                    key={prod.id}
                    className={`flex flex-wrap items-center justify-between gap-3 p-3.5 transition ${
                      fueActualizado
                        ? 'border-l-4 border-l-emerald-500 bg-emerald-50/45'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={prod.image_url || EMPRESA.logoUrl}
                        alt={prod.name}
                        className="h-12 w-12 shrink-0 rounded-xl border border-slate-100 bg-[#FAFAFA] object-contain p-1"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {prod.name}
                          </p>
                          {fueActualizado && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              <Check className="h-2.5 w-2.5" /> Foto actualizada
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-700">
                          {formatearBs(prod.price_bs)} ·{' '}
                          <span
                            className={
                              prod.is_visible ? 'text-emerald-700' : 'text-amber-700'
                            }
                          >
                            {prod.is_visible ? 'Visible' : 'Oculto'}
                          </span>
                          {prod.image_url_2 ? ' · 2 fotos' : ''}
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