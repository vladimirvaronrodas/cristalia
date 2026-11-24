import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EMPRESA } from '../config/empresa';
import { formatearBs } from './formato';

const PROPIEDADES_COLOR = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
];

function convertirColorARgb(valorCss, ctx) {
  if (
    !valorCss ||
    valorCss === 'transparent' ||
    valorCss === 'rgba(0, 0, 0, 0)' ||
    (!valorCss.includes('oklch') && !valorCss.includes('oklab') && !valorCss.includes('color('))
  ) {
    return valorCss;
  }
  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = valorCss;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return 'transparent';
    if (a === 255) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
  } catch {
    return valorCss;
  }
}

async function renderizarCanvasComprobante(elemento) {
  if (!elemento) return null;
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const lienzoAux = document.createElement('canvas');
  lienzoAux.width = 1;
  lienzoAux.height = 1;
  const ctxAux = lienzoAux.getContext('2d', { willReadFrequently: true });

  const nodosOriginales = [elemento, ...elemento.querySelectorAll('*')];
  const mapaEstilos = new Map();

  nodosOriginales.forEach((nodo, idx) => {
    const clave = String(idx);
    nodo.setAttribute('data-h2c-id', clave);
    if (!ctxAux) return;

    const computado = window.getComputedStyle(nodo);
    const coloresConvertidos = {};
    PROPIEDADES_COLOR.forEach((prop) => {
      coloresConvertidos[prop] = convertirColorARgb(computado[prop], ctxAux);
    });
    mapaEstilos.set(clave, coloresConvertidos);
  });

  try {
    return await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('style').forEach((styleTag) => {
          if (styleTag.textContent) {
            styleTag.textContent = styleTag.textContent
              .replace(/oklch\([^)]*\)/gi, 'rgb(15, 23, 42)')
              .replace(/oklab\([^)]*\)/gi, 'rgb(15, 23, 42)');
          }
        });

        clonedDoc.querySelectorAll('[data-h2c-id]').forEach((clon) => {
          const clave = clon.getAttribute('data-h2c-id');
          const estilos = mapaEstilos.get(clave);
          if (estilos) {
            PROPIEDADES_COLOR.forEach((prop) => {
              if (estilos[prop]) {
                clon.style[prop] = estilos[prop];
              }
            });
          }
          clon.style.boxShadow = 'none';
        });
      },
    });
  } finally {
    nodosOriginales.forEach((nodo) => nodo.removeAttribute('data-h2c-id'));
  }
}

function descargarBlobArchivo(blob, nombreArchivo) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function capturarElementoComoPng(elemento, nombreArchivo = 'cotizacion-cristalia.png') {
  if (!elemento) return null;
  const canvas = await renderizarCanvasComprobante(elemento);
  if (!canvas) return null;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) {
    descargarBlobArchivo(blob, nombreArchivo);
  }
  return { blob, nombreArchivo };
}

export function generarPdfComprobante({
  codigo,
  fechaTexto,
  clienteNombre,
  clienteTelefono,
  items,
  totalBs,
  esDespachado = false,
  nombreArchivo = 'cotizacion-cristalia.pdf',
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });

  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(EMPRESA.nombre, 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(EMPRESA.eslogan, 14, 24);

  if (esDespachado) {
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text('DESPACHADO / COMPLETADO', 196, 18, { align: 'right' });
  }

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Código: ${codigo || 'COTIZACION'}`, 14, 34);
  doc.text(`Fecha: ${fechaTexto || new Date().toLocaleString('es-BO')}`, 196, 34, { align: 'right' });

  if (clienteNombre || clienteTelefono) {
    doc.text(`Cliente: ${clienteNombre || '-'}`, 14, 40);
    doc.text(`Teléfono/WhatsApp: ${clienteTelefono || '-'}`, 196, 40, { align: 'right' });
  }

  const filas = (items || []).map((item, idx) => [
    String(idx + 1),
    item.name,
    String(item.quantity),
    formatearBs(item.price_bs),
    formatearBs(Number(item.price_bs) * Number(item.quantity)),
  ]);

  autoTable(doc, {
    startY: clienteNombre || clienteTelefono ? 46 : 40,
    head: [['#', 'Producto', 'Cant.', 'Precio Unit.', 'Subtotal']],
    body: filas,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 34 },
      4: { halign: 'right', cellWidth: 36 },
    },
  });

  const finalY = (doc.lastAutoTable?.finalY || 70) + 8;
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total General: ${formatearBs(totalBs)}`, 196, finalY, { align: 'right' });

  doc.save(nombreArchivo);
  return doc;
}

export async function compartirComprobante({
  elemento,
  titulo,
  texto,
  nombreArchivo = 'cotizacion-cristalia.png',
}) {
  let blob = null;
  if (elemento) {
    const canvas = await renderizarCanvasComprobante(elemento);
    if (canvas) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }
  }

  if (navigator.share) {
    try {
      if (blob && typeof File !== 'undefined') {
        const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
        if (!navigator.canShare || navigator.canShare({ files: [archivo] })) {
          await navigator.share({
            title: titulo || EMPRESA.nombre,
            files: [archivo],
          });
          return { compartido: true, modo: 'archivo' };
        }
      }
      await navigator.share({
        title: titulo || EMPRESA.nombre,
        text: texto || '',
      });
      return { compartido: true, modo: 'texto' };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { compartido: false, cancelado: true };
      }
    }
  }

  if (blob) {
    descargarBlobArchivo(blob, nombreArchivo);
  }
  return { compartido: false, descargado: true };
}