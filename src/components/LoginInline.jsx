import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EMPRESA } from '../config/empresa';

export default function LoginInline({
  tituloAcceso,
  rolesPermitidos = [],
  onCerrar,
  onLoginExitoso,
}) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const nickLimpio = usuario.trim().toLowerCase();
    if (!nickLimpio || !password) {
      setErrorMsg('Ingresa tu usuario y contraseña.');
      return;
    }

    setCargando(true);
    try {
      const { data: emailResuelto, error: rpcError } = await supabase.rpc(
        'resolve_login_email',
        { p_username: nickLimpio }
      );

      if (rpcError) throw rpcError;

      const emailLogin =
        emailResuelto || (nickLimpio.includes('@') ? nickLimpio : null);

      if (!emailLogin) {
        throw new Error('Usuario no encontrado o cuenta inactiva.');
      }

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: emailLogin,
          password,
        });

      if (authError) {
        throw new Error('Credenciales incorrectas.');
      }

      const userId = authData.user?.id;
      const { data: rolData, error: rolError } = await supabase
        .from('user_roles')
        .select('user_id, username, email, role, active')
        .eq('user_id', userId)
        .single();

      if (rolError || !rolData || !rolData.active) {
        await supabase.auth.signOut();
        throw new Error('Tu usuario no tiene permisos activos en el sistema.');
      }

      if (
        rolesPermitidos.length > 0 &&
        !rolesPermitidos.includes(rolData.role)
      ) {
        await supabase.auth.signOut();
        throw new Error(
          `Tu rol actual (${rolData.role}) no tiene acceso a este panel.`
        );
      }

      setUsuario('');
      setPassword('');
      onLoginExitoso(rolData);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Lock className="h-4 w-4 text-sky-200" />
          </span>
          <div>
            <p className="text-[11px] font-medium text-slate-400">
              {EMPRESA.nombre} · Acceso autorizado
            </p>
            <h2 className="text-sm font-semibold text-slate-900">
              {tituloAcceso}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar acceso"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={manejarEnvio} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            Usuario
          </label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Ej. artech"
            autoComplete="username"
            className="w-full rounded-xl border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-[#FAFAFA] px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            {cargando ? 'Validando...' : 'Ingresar'}
          </button>
        </div>
      </form>
    </div>
  );
}