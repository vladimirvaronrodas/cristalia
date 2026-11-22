import React, { useCallback, useEffect, useState } from 'react';
import {
  LogOut,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Package,
  ClipboardList,
} from 'lucide-react';
import { supabase, supabaseAdminHelper } from '../lib/supabase';
import { EMPRESA } from '../config/empresa';
import PanelCatalogo from './PanelCatalogo';
import PanelVentas from './PanelVentas';

const ROLES_DISPONIBLES = [
  { value: 'catalogo', label: 'Catálogo (3 toques en logo)' },
  { value: 'ventas', label: 'Ventas (3 toques en nombre)' },
  { value: 'catalogo_ventas', label: 'Catálogo + Ventas' },
  { value: 'admin_total', label: 'Administrador Total' },
];

export default function PanelAdminTotal({
  usuarioActual,
  categorias = [],
  productos = [],
  relacionesCategoria = [],
  onRecargarCatalogo,
  onCerrarSesion,
}) {
  const [moduloActivo, setModuloActivo] = useState('USUARIOS'); // 'USUARIOS' | 'CATALOGO' | 'VENTAS'
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ventas');
  const [creando, setCreando] = useState(false);

  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const notificar = (tipo, texto) => setMensaje({ tipo, texto });

  const cargarUsuarios = useCallback(async () => {
    setCargandoUsuarios(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, username, email, role, active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      notificar('error', error.message || 'No se pudieron cargar los usuarios.');
    } else {
      setUsuarios(data || []);
    }
    setCargandoUsuarios(false);
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const crearUsuario = async (e) => {
    e.preventDefault();
    notificar('', '');

    const nickLimpio = username.trim().toLowerCase();
    const correoLimpio = email.trim().toLowerCase();

    if (!nickLimpio || !correoLimpio || password.length < 6) {
      notificar(
        'error',
        'Completa usuario, correo válido y contraseña (mínimo 6 caracteres).'
      );
      return;
    }

    setCreando(true);
    try {
      const { data: authData, error: signUpError } =
        await supabaseAdminHelper.auth.signUp({
          email: correoLimpio,
          password,
        });

      if (signUpError) throw signUpError;

      const nuevoUserId = authData?.user?.id;
      if (!nuevoUserId) {
        throw new Error(
          'No se obtuvo el ID de usuario. Verifica que "Confirm email" esté desactivado en Supabase.'
        );
      }

      const { error: insertError } = await supabase.from('user_roles').insert({
        user_id: nuevoUserId,
        username: nickLimpio,
        email: correoLimpio,
        role,
        active: true,
      });

      if (insertError) throw insertError;

      setUsername('');
      setEmail('');
      setPassword('');
      setRole('ventas');
      await cargarUsuarios();
      notificar(
        'ok',
        `Usuario "${nickLimpio}" (${role}) creado y listo para iniciar sesión.`
      );
    } catch (err) {
      notificar('error', err.message || 'Error al crear el usuario.');
    } finally {
      setCreando(false);
    }
  };

  const cambiarRolUsuario = async (fila, nuevoRol) => {
    notificar('', '');
    const { error } = await supabase
      .from('user_roles')
      .update({ role: nuevoRol })
      .eq('user_id', fila.user_id);

    if (error) {
      notificar('error', error.message);
      return;
    }
    setUsuarios((prev) =>
      prev.map((u) =>
        u.user_id === fila.user_id ? { ...u, role: nuevoRol } : u
      )
    );
    notificar('ok', `Rol de "${fila.username}" actualizado a ${nuevoRol}.`);
  };

  const alternarActivoUsuario = async (fila) => {
    if (fila.user_id === usuarioActual?.user_id && fila.active) {
      notificar('error', 'No puedes desactivar tu propia cuenta en uso.');
      return;
    }

    notificar('', '');
    const siguienteEstado = !fila.active;
    const { error } = await supabase
      .from('user_roles')
      .update({ active: siguienteEstado })
      .eq('user_id', fila.user_id);

    if (error) {
      notificar('error', error.message);
      return;
    }
    setUsuarios((prev) =>
      prev.map((u) =>
        u.user_id === fila.user_id ? { ...u, active: siguienteEstado } : u
      )
    );
    notificar(
      'ok',
      `Cuenta "${fila.username}" ${siguienteEstado ? 'activada' : 'desactivada'}.`
    );
  };

  const eliminarRegistroRol = async (fila) => {
    if (fila.user_id === usuarioActual?.user_id) {
      notificar('error', 'No puedes eliminar tu propio registro de administrador.');
      return;
    }
    if (
      !window.confirm(
        `¿Quitar acceso de "${fila.username}" (${fila.email}) de user_roles?`
      )
    ) {
      return;
    }

    notificar('', '');
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', fila.user_id);

    if (error) {
      notificar('error', error.message);
      return;
    }
    setUsuarios((prev) => prev.filter((u) => u.user_id !== fila.user_id));
    notificar('ok', `Acceso de "${fila.username}" eliminado.`);
  };

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <ShieldCheck className="h-4 w-4 text-sky-200" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {EMPRESA.nombre} · {EMPRESA.desarrollador.texto}
            </p>
            <h1 className="font-serif text-xl font-semibold text-slate-900">
              Panel de Administrador Total
            </h1>
            <p className="text-xs text-slate-500">
              Sesión: <strong>{usuarioActual?.username}</strong> (admin_total)
            </p>
          </div>
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

      {/* Navegación interna del Administrador Total */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModuloActivo('USUARIOS')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
            moduloActivo === 'USUARIOS'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-[#FAFAFA] text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Usuarios y Roles ({usuarios.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setModuloActivo('CATALOGO')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
            moduloActivo === 'CATALOGO'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-[#FAFAFA] text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Catálogo y PDFs</span>
        </button>

        <button
          type="button"
          onClick={() => setModuloActivo('VENTAS')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer ${
            moduloActivo === 'VENTAS'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-[#FAFAFA] text-slate-700 hover:bg-slate-100'
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          <span>Ventas y Pedidos</span>
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

      {moduloActivo === 'USUARIOS' && (
        <div className="space-y-6">
          <form
            onSubmit={crearUsuario}
            className="space-y-4 rounded-2xl border border-slate-200/80 bg-[#FAFAFA] p-4 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Crear nueva cuenta de acceso
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Usuario (login) *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej. ventas1"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Correo *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ventas1@cristalia.bo"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Contraseña *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600">
                  Rol asignado *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400"
                >
                  {ROLES_DISPONIBLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creando}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              {creando ? 'Creando cuenta...' : 'Crear usuario y asignar rol'}
            </button>
          </form>

          {cargandoUsuarios ? (
            <div className="h-32 animate-pulse rounded-2xl border border-slate-200/70 bg-[#FAFAFA]" />
          ) : (
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80">
              {usuarios.map((u) => (
                <div
                  key={u.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {u.username}{' '}
                      <span className="font-normal text-slate-500">({u.email})</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Estado:{' '}
                      <span
                        className={
                          u.active
                            ? 'font-medium text-emerald-700'
                            : 'font-medium text-amber-700'
                        }
                      >
                        {u.active ? 'Activo' : 'Desactivado'}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={u.role}
                      onChange={(e) => cambiarRolUsuario(u, e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                    >
                      {ROLES_DISPONIBLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.value}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => alternarActivoUsuario(u)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                        u.active
                          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {u.active ? 'Desactivar' : 'Activar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => eliminarRegistroRol(u)}
                      title="Eliminar registro de rol"
                      className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {moduloActivo === 'CATALOGO' && (
        <PanelCatalogo
          usuarioActual={usuarioActual}
          categorias={categorias}
          productos={productos}
          relacionesCategoria={relacionesCategoria}
          onRecargarTodo={onRecargarCatalogo}
          onCerrarSesion={onCerrarSesion}
        />
      )}

      {moduloActivo === 'VENTAS' && (
        <PanelVentas
          usuarioActual={usuarioActual}
          onCerrarSesion={onCerrarSesion}
          incrustado
        />
      )}
    </section>
  );
}