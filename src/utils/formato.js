import { EMPRESA } from '../config/empresa';

export function formatearBs(monto) {
  const numero = Number(monto || 0);
  return `${EMPRESA.moneda} ${numero.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function limpiarTelefono(telefono) {
  const soloDigitos = String(telefono || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
  if (!soloDigitos) return '';
  if (soloDigitos.length === 8) {
    return `591${soloDigitos}`;
  }
  return soloDigitos;
}

export function crearUrlWhatsApp(telefono, mensaje) {
  const limpio = limpiarTelefono(telefono);
  if (!limpio) return '#';
  const texto = encodeURIComponent(mensaje || '');
  return `https://wa.me/${limpio}?text=${texto}`;
}

/**
 * Crea un manejador de toques/clics múltiples rápidos.
 * @param {number} cantidadRequerida - Ej. 3 o 5 toques
 * @param {number} ventanaMs - Tiempo máximo entre primer y último toque (ej. 1500 o 2000 ms)
 * @param {Function} onAlcanzado - Acción al completar los toques
 */
export function crearDetectorToques(cantidadRequerida, ventanaMs, onAlcanzado) {
  let marcasTiempo = [];

  return (evento) => {
    if (evento?.stopPropagation) evento.stopPropagation();
    const ahora = Date.now();
    marcasTiempo = marcasTiempo.filter((t) => ahora - t <= ventanaMs);
    marcasTiempo.push(ahora);

    if (marcasTiempo.length >= cantidadRequerida) {
      marcasTiempo = [];
      onAlcanzado();
    }
  };
}