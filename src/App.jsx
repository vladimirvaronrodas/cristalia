import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';
import { EMPRESA } from './config/empresa';
import Header from './components/Header';
import Footer from './components/Footer';
import CatalogoPublico from './components/CatalogoPublico';
import CarritoDrawer from './components/CarritoDrawer';
import LoginInline from './components/LoginInline';
import PanelCatalogo from './components/PanelCatalogo';
import PanelVentas from './components/PanelVentas';
import PanelAdminTotal from './components/PanelAdminTotal';

const ROLES_CATALOGO = ['catalogo', 'catalogo_ventas', 'admin_total'];
const ROLES_VENTAS = ['ventas', 'catalogo_ventas', 'admin_total'];
const ROLES_ADMIN_TOTAL = ['admin_total'];

export default function App() {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [relacionesCategoria, setRelacionesCategoria] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [avisoTemporal, setAvisoTemporal] = useState('');

  // Sesión y vistas
  const [usuarioRol, setUsuarioRol] = useState(null);
  const [loginSolicitado, setLoginSolicitado] = useState(null); // null | 'CATALOGO' | 'VENTAS' | 'ADMIN_TOTAL'
  const [vistaActiva, setVistaActiva] = useState('CATALOGO_PUBLICO'); // 'CATALOGO_PUBLICO' | 'PANEL_CATALOGO' | 'PANEL_VENTAS' | 'PANEL_ADMIN_TOTAL'

  const cargarTodoCatalogo = useCallback(async () => {
    setCargando(true);
    setErrorMsg('');

    const [catRes, prodRes, relRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('product_categories').select('product_id, category_id'),
    ]);

    if (catRes.error || prodRes.error || relRes.error) {
      setErrorMsg(
        catRes.error?.message ||
          prodRes.error?.message ||
          relRes.error?.message ||
          'Error al cargar datos.'
      );
    } else {
      setCategorias(catRes.data || []);
      setProductos(prodRes.data || []);
      setRelacionesCategoria(relRes.data || []);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarTodoCatalogo();
  }, [cargarTodoCatalogo]);

  useEffect(() => {
    async function restaurarSesion() {
      const { data } = await supabase.auth.getSession();
      const uid = data?.session?.user?.id;
      if (!uid) return;

      const { data: rol } = await supabase
        .from('user_roles')
        .select('user_id, username, email, role, active')
        .eq('user_id', uid)
        .single();

      if (rol && rol.active) {
        setUsuarioRol(rol);
      }
    }
    restaurarSesion();
  }, []);

  const mostrarAviso = (texto) => {
    setAvisoTemporal(texto);
    setTimeout(() => setAvisoTemporal(''), 2500);
  };

  const abrirAccesoCatalogo = useCallback(() => {
    if (usuarioRol && ROLES_CATALOGO.includes(usuarioRol.role)) {
      setLoginSolicitado(null);
      setVistaActiva('PANEL_CATALOGO');
      return;
    }
    setLoginSolicitado('CATALOGO');
  }, [usuarioRol]);

  const abrirAccesoVentas = useCallback(() => {
    if (usuarioRol && ROLES_VENTAS.includes(usuarioRol.role)) {
      setLoginSolicitado(null);
      setVistaActiva('PANEL_VENTAS');
      return;
    }
    setLoginSolicitado('VENTAS');
  }, [usuarioRol]);

  const abrirAccesoAdminTotal = useCallback(() => {
    if (usuarioRol && ROLES_ADMIN_TOTAL.includes(usuarioRol.role)) {
      setLoginSolicitado(null);
      setVistaActiva('PANEL_ADMIN_TOTAL');
      return;
    }
    setLoginSolicitado('ADMIN_TOTAL');
  }, [usuarioRol]);

  const manejarLoginExitoso = (rolData) => {
    setUsuarioRol(rolData);
    const destino = loginSolicitado;
    setLoginSolicitado(null);

    if (destino === 'ADMIN_TOTAL' && ROLES_ADMIN_TOTAL.includes(rolData.role)) {
      setVistaActiva('PANEL_ADMIN_TOTAL');
    } else if (destino === 'VENTAS' && ROLES_VENTAS.includes(rolData.role)) {
      setVistaActiva('PANEL_VENTAS');
    } else if (destino === 'CATALOGO' && ROLES_CATALOGO.includes(rolData.role)) {
      setVistaActiva('PANEL_CATALOGO');
    } else if (ROLES_ADMIN_TOTAL.includes(rolData.role)) {
      setVistaActiva('PANEL_ADMIN_TOTAL');
    } else if (ROLES_VENTAS.includes(rolData.role)) {
      setVistaActiva('PANEL_VENTAS');
    } else {
      setVistaActiva('PANEL_CATALOGO');
    }
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setUsuarioRol(null);
    setVistaActiva('CATALOGO_PUBLICO');
    mostrarAviso('Sesión cerrada.');
  };

  const productosVisibles = useMemo(
    () => productos.filter((p) => p.is_visible),
    [productos]
  );

  const agregarAlCarrito = (producto, cantidad = 1) => {
    setCarrito((prev) => {
      const existente = prev.find((i) => i.id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.id === producto.id ? { ...i, quantity: i.quantity + cantidad } : i
        );
      }
      return [...prev, { ...producto, quantity: cantidad }];
    });
    mostrarAviso(`Añadido: ${producto.name}`);
  };

  const actualizarCantidadCarrito = (id, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      setCarrito((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setCarrito((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: nuevaCantidad } : i))
    );
  };

  const quitarDelCarrito = (id) => {
    setCarrito((prev) => prev.filter((i) => i.id !== id));
  };

  const limpiarCarrito = () => {
    setCarrito([]);
  };

  const totalArticulosCarrito = useMemo(
    () => carrito.reduce((acc, item) => acc + Number(item.quantity || 0), 0),
    [carrito]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] text-slate-800">
      <Header
        totalArticulosCarrito={totalArticulosCarrito}
        onAbrirCarrito={() => setCarritoAbierto(true)}
        onTriggerCatalogo={abrirAccesoCatalogo}
        onTriggerVentas={abrirAccesoVentas}
        panelActivo={vistaActiva !== 'CATALOGO_PUBLICO'}
        onVolverCatalogo={() => {
          setLoginSolicitado(null);
          setVistaActiva('CATALOGO_PUBLICO');
        }}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-7 sm:px-6">
        {vistaActiva === 'CATALOGO_PUBLICO' && (
          <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-2xs">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {EMPRESA.nombre}
            </p>
            <h1 className="mt-0.5 font-serif text-xl sm:text-2xl text-slate-900">
              {EMPRESA.eslogan}
            </h1>
          </div>
        )}

        {avisoTemporal && (
          <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900">
            {avisoTemporal}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        {loginSolicitado === 'CATALOGO' && (
          <LoginInline
            tituloAcceso="Panel de Catálogo y PDFs"
            rolesPermitidos={ROLES_CATALOGO}
            onCerrar={() => setLoginSolicitado(null)}
            onLoginExitoso={manejarLoginExitoso}
          />
        )}

        {loginSolicitado === 'VENTAS' && (
          <LoginInline
            tituloAcceso="Panel de Ventas y Pedidos"
            rolesPermitidos={ROLES_VENTAS}
            onCerrar={() => setLoginSolicitado(null)}
            onLoginExitoso={manejarLoginExitoso}
          />
        )}

        {loginSolicitado === 'ADMIN_TOTAL' && (
          <LoginInline
            tituloAcceso="Panel de Administrador Total"
            rolesPermitidos={ROLES_ADMIN_TOTAL}
            onCerrar={() => setLoginSolicitado(null)}
            onLoginExitoso={manejarLoginExitoso}
          />
        )}

        {vistaActiva === 'PANEL_ADMIN_TOTAL' &&
        usuarioRol &&
        ROLES_ADMIN_TOTAL.includes(usuarioRol.role) ? (
          <PanelAdminTotal
            usuarioActual={usuarioRol}
            categorias={categorias}
            productos={productos}
            relacionesCategoria={relacionesCategoria}
            onRecargarCatalogo={cargarTodoCatalogo}
            onCerrarSesion={cerrarSesion}
          />
        ) : vistaActiva === 'PANEL_VENTAS' &&
          usuarioRol &&
          ROLES_VENTAS.includes(usuarioRol.role) ? (
          <PanelVentas
            usuarioActual={usuarioRol}
            onCerrarSesion={cerrarSesion}
          />
        ) : vistaActiva === 'PANEL_CATALOGO' &&
          usuarioRol &&
          ROLES_CATALOGO.includes(usuarioRol.role) ? (
          <PanelCatalogo
            usuarioActual={usuarioRol}
            categorias={categorias}
            productos={productos}
            relacionesCategoria={relacionesCategoria}
            onRecargarTodo={cargarTodoCatalogo}
            onCerrarSesion={cerrarSesion}
          />
        ) : cargando ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-72 animate-pulse rounded-2xl border border-slate-200/70 bg-white"
              />
            ))}
          </div>
        ) : (
          <CatalogoPublico
            categorias={categorias}
            productos={productosVisibles}
            relacionesCategoria={relacionesCategoria}
            onAgregarAlCarrito={agregarAlCarrito}
          />
        )}
      </main>

      <Footer onTriggerAdminTotal={abrirAccesoAdminTotal} />

      <CarritoDrawer
        abierto={carritoAbierto}
        onCerrar={() => setCarritoAbierto(false)}
        items={carrito}
        onActualizarCantidad={actualizarCantidadCarrito}
        onQuitarItem={quitarDelCarrito}
        onLimpiarCarrito={limpiarCarrito}
      />
    </div>
  );
}