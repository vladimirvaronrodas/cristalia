import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EMPRESA } from '../config/empresa';
import { formatearBs } from './formato';

function formatearTelefonoMostrar(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (digitos.startsWith('591') && digitos.length === 11) {
    return `+591 ${digitos.slice(3)}`;
  }
  return digitos ? `+${digitos}` : '';
}

function obtenerFechaCortaArchivo(fecha = new Date()) {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}`;
}

function limpiarTextoParaArchivo(texto = '') {
  return String(texto)
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function construirNombreArchivoPdf({
  modo,
  categoriasSeleccionadas = [],
  mapaCats = new Map(),
}) {
  const fechaCorta = obtenerFechaCortaArchivo();
  const base = `Catalogo ${EMPRESA.nombre}`;

  if (modo === 'CATEGORIAS' && categoriasSeleccionadas.length > 0) {
    const nombresCat = categoriasSeleccionadas
      .map((id) => limpiarTextoParaArchivo(mapaCats.get(id)))
      .filter(Boolean);

    if (nombresCat.length > 0 && nombresCat.length <= 3) {
      return `${base} - ${nombresCat.join(', ')} ${fechaCorta}.pdf`;
    }
    if (nombresCat.length > 3) {
      return `${base} - Varias categorias ${fechaCorta}.pdf`;
    }
  }

  if (modo === 'SELECCION') {
    return `${base} - Seleccion ${fechaCorta}.pdf`;
  }

  return `${base} ${fechaCorta}.pdf`;
}

async function decodificarImagenDesdeBlob(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Carga el logo de portada o firma conservando transparencia PNG real y nitidez.
 */
async function cargarLogoTransparentePng(url, urlRespaldo = '', maxLado = 700) {
  const intentar = async (ruta) => {
    if (!ruta) return null;
    try {
      const resp = await fetch(ruta, { mode: 'cors' });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/')) return null;

      const img = await decodificarImagenDesdeBlob(blob);
      const origW = img.naturalWidth || 400;
      const origH = img.naturalHeight || 400;
      const escala = Math.min(1, maxLado / Math.max(origW, origH));
      const ancho = Math.max(1, Math.round(origW * escala));
      const alto = Math.max(1, Math.round(origH * escala));

      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, ancho, alto);
      ctx.drawImage(img, 0, 0, ancho, alto);

      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: ancho,
        height: alto,
      };
    } catch {
      return null;
    }
  };

  const principal = await intentar(url);
  if (principal) return principal;
  if (urlRespaldo && urlRespaldo !== url) {
    return await intentar(urlRespaldo);
  }
  return null;
}

/**
 * Optimiza miniaturas de productos para tabla (300 px = >500 DPI en celda de 14 mm),
 * sobre fondo blanco limpio y JPEG al 90% para evitar PDFs pesados sin perder nitidez.
 */
async function cargarMiniaturaProducto(url, maxLado = 300) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) return null;

    const img = await decodificarImagenDesdeBlob(blob);
    const origW = img.naturalWidth || 300;
    const origH = img.naturalHeight || 300;
    const escala = Math.min(1, maxLado / Math.max(origW, origH));
    const ancho = Math.max(1, Math.round(origW * escala));
    const alto = Math.max(1, Math.round(origH * escala));

    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);

    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.9),
      width: ancho,
      height: alto,
    };
  } catch {
    return null;
  }
}

function crearIconoWhatsAppPng() {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Burbuja verde WhatsApp
  ctx.fillStyle = '#25D366';
  ctx.beginPath();
  ctx.arc(50, 46, 38, 0, Math.PI * 2);
  ctx.fill();

  // Cola inferior izquierda
  ctx.beginPath();
  ctx.moveTo(22, 68);
  ctx.lineTo(12, 86);
  ctx.lineTo(34, 78);
  ctx.closePath();
  ctx.fill();

  // Aro blanco interno
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(50, 46, 28, 0, Math.PI * 2);
  ctx.stroke();

  // Auricular telefónico blanco
  ctx.fillStyle = '#FFFFFF';
  ctx.save();
  ctx.translate(50, 46);
  ctx.rotate((-38 * Math.PI) / 180);
  ctx.beginPath();
  ctx.roundRect(-14, -5, 28, 10, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-15, -8, 8, 12, 3);
  ctx.roundRect(7, -8, 8, 12, 3);
  ctx.fill();
  ctx.restore();

  return canvas.toDataURL('image/png');
}

function dibujarPieDePagina(doc, logoDev) {
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();
  const yLinea = altoPagina - 16;
  const yTexto = altoPagina - 10;

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, yLinea, anchoPagina - 14, yLinea);

  // Izquierda: Cristalia + enlace web clicable
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const prefijoWeb = `${EMPRESA.nombre} — `;
  doc.text(prefijoWeb, 14, yTexto);

  const anchoPrefijo = doc.getTextWidth(prefijoWeb);
  const textoWeb = EMPRESA.sitioWebTexto || 'cristalia.pages.dev';
  const urlWeb = EMPRESA.sitioWeb || 'https://cristalia.pages.dev';

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(textoWeb, 14 + anchoPrefijo, yTexto);
  const anchoUrlWeb = doc.getTextWidth(textoWeb);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.2);
  doc.line(
    14 + anchoPrefijo,
    yTexto + 0.8,
    14 + anchoPrefijo + anchoUrlWeb,
    yTexto + 0.8
  );
  doc.link(14 + anchoPrefijo, yTexto - 3.5, anchoUrlWeb, 5, { url: urlWeb });

  // Derecha: Desarrollado por ARTECH TECHNOLOGY + WhatsApp clicable
  const telDevMostrar = formatearTelefonoMostrar(EMPRESA.desarrollador.whatsappSoporte);
  const textoDev = `${EMPRESA.desarrollador.texto} · ${telDevMostrar}`;
  const urlDev = `https://wa.me/${EMPRESA.desarrollador.whatsappSoporte}?text=${encodeURIComponent(
    `Hola ${EMPRESA.desarrollador.texto}, vi su contacto en el catálogo de ${EMPRESA.nombre}.`
  )}`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const anchoTextoDev = doc.getTextWidth(textoDev);
  const xTextoDev = anchoPagina - 14 - anchoTextoDev;

  if (logoDev?.dataUrl) {
    try {
      doc.addImage(logoDev.dataUrl, 'PNG', xTextoDev - 5.2, yTexto - 3.2, 3.8, 3.8);
    } catch {
      // Ignora el mini-logo si no se puede dibujar
    }
  }

  doc.text(textoDev, xTextoDev, yTexto);
  doc.link(xTextoDev - 6, yTexto - 3.5, anchoTextoDev + 6, 5, { url: urlDev });
}

export async function generarCatalogoPdf({
  productos = [],
  categorias = [],
  relacionesCategoria = [],
  modo = 'COMPLETO', // 'COMPLETO' | 'CATEGORIAS' | 'SELECCION'
  categoriasSeleccionadas = [],
  idsProductosSeleccionados = [],
  nombreArchivo = '',
}) {
  const mapaCats = new Map(categorias.map((c) => [c.id, c.name]));
  const catsPorProducto = new Map();

  relacionesCategoria.forEach((rel) => {
    const nombre = mapaCats.get(rel.category_id);
    if (!nombre) return;
    if (!catsPorProducto.has(rel.product_id)) {
      catsPorProducto.set(rel.product_id, []);
    }
    catsPorProducto.get(rel.product_id).push({
      id: rel.category_id,
      name: nombre,
    });
  });

  let filtrados = productos.filter((p) => p.is_visible);

  if (modo === 'CATEGORIAS' && categoriasSeleccionadas.length > 0) {
    filtrados = filtrados.filter((p) => {
      const cats = catsPorProducto.get(p.id) || [];
      return cats.some((c) => categoriasSeleccionadas.includes(c.id));
    });
  } else if (modo === 'SELECCION') {
    filtrados = filtrados.filter((p) => idsProductosSeleccionados.includes(p.id));
  }

  const nombreArchivoFinal =
    nombreArchivo ||
    construirNombreArchivoPdf({
      modo,
      categoriasSeleccionadas,
      mapaCats,
    });

  const doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const centroX = anchoPagina / 2;

  const [logoInfo, logoDevInfo] = await Promise.all([
    cargarLogoTransparentePng(EMPRESA.logoPdfUrl, EMPRESA.logoUrl, 700),
    cargarLogoTransparentePng(EMPRESA.desarrollador.logoUrl, '', 96),
  ]);
  const iconoWaData = crearIconoWhatsAppPng();

  // --- PORTADA (PÁGINA 1 — LOGO TRANSPARENTE Y TIPOGRAFÍA EDITORIAL SUAVE) ---
  let cursorY = 26;
  if (logoInfo?.dataUrl) {
    try {
      const maxAncho = 58;
      const maxAlto = 44;
      const ratio = Math.min(maxAncho / logoInfo.width, maxAlto / logoInfo.height);
      const wLogo = logoInfo.width * ratio;
      const hLogo = logoInfo.height * ratio;
      doc.addImage(
        logoInfo.dataUrl,
        'PNG',
        centroX - wLogo / 2,
        cursorY,
        wLogo,
        hLogo
      );
      cursorY += hLogo + 14;
    } catch {
      cursorY = 58;
    }
  } else {
    cursorY = 58;
  }

  // Título principal en fuente serif suave
  doc.setFont('times', 'bold');
  doc.setFontSize(33);
  doc.setTextColor(30, 41, 59);
  doc.text(EMPRESA.nombre, centroX, cursorY, { align: 'center' });

  // Eslogan en itálica elegante
  cursorY += 10;
  doc.setFont('times', 'italic');
  doc.setFontSize(14.5);
  doc.setTextColor(100, 116, 139);
  doc.text(EMPRESA.eslogan, centroX, cursorY, { align: 'center' });

  // Línea decorativa sutil
  cursorY += 8;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.line(centroX - 24, cursorY, centroX + 24, cursorY);

  let subtituloFiltro = 'Catálogo General Visible';
  if (modo === 'CATEGORIAS') {
    const nombresCat = categoriasSeleccionadas
      .map((id) => mapaCats.get(id))
      .filter(Boolean);
    subtituloFiltro = `Categorías: ${nombresCat.join(', ') || 'Todas'}`;
  } else if (modo === 'SELECCION') {
    subtituloFiltro = `Selección personalizada (${filtrados.length} piezas)`;
  }

  cursorY += 11;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(51, 65, 85);
  doc.text(subtituloFiltro, centroX, cursorY, { align: 'center' });

  cursorY += 7;
  doc.setFontSize(10.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Emitido: ${new Date().toLocaleDateString('es-BO')}`,
    centroX,
    cursorY,
    { align: 'center' }
  );

  // Bloque de los 2 contactos principales de WhatsApp en la portada
  const contactosPortada = [
    {
      etiqueta: 'Ventas',
      telefono: EMPRESA.whatsappVentas,
      mensaje: `Hola ${EMPRESA.nombre}, vi su catálogo PDF y quisiera hacer una consulta.`,
    },
    {
      etiqueta: 'Dirección General',
      telefono: EMPRESA.direccionGeneral.telefono,
      mensaje: `Hola ${EMPRESA.nombre}, me comunico desde su catálogo PDF.`,
    },
  ].filter((c) => c.telefono);

  if (contactosPortada.length > 0) {
    const anchoCaja = 136;
    const altoCaja = 41;
    const xCaja = centroX - anchoCaja / 2;
    const yCaja = cursorY + 15;

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(xCaja, yCaja, anchoCaja, altoCaja, 3.5, 3.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('PEDIDOS Y CONSULTAS POR WHATSAPP', centroX, yCaja + 8.5, {
      align: 'center',
    });

    contactosPortada.forEach((contacto, idx) => {
      const yFila = yCaja + 18.5 + idx * 12;
      const telMostrar = formatearTelefonoMostrar(contacto.telefono);
      const lineaTexto = `${contacto.etiqueta}: ${telMostrar}`;
      const urlWa = `https://wa.me/${contacto.telefono}?text=${encodeURIComponent(
        contacto.mensaje
      )}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      const anchoTexto = doc.getTextWidth(lineaTexto);
      const anchoIcono = 5;
      const separacion = 2.6;
      const anchoTotalFila = anchoIcono + separacion + anchoTexto;
      const xInicioFila = centroX - anchoTotalFila / 2;

      doc.addImage(
        iconoWaData,
        'PNG',
        xInicioFila,
        yFila - 3.9,
        anchoIcono,
        anchoIcono
      );

      doc.setTextColor(30, 41, 59);
      doc.text(lineaTexto, xInicioFila + anchoIcono + separacion, yFila);

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(
        xInicioFila + anchoIcono + separacion,
        yFila + 1,
        xInicioFila + anchoIcono + separacion + anchoTexto,
        yFila + 1
      );

      doc.link(xInicioFila - 2, yFila - 5, anchoTotalFila + 4, 7.5, {
        url: urlWa,
      });
    });
  }

  dibujarPieDePagina(doc, logoDevInfo);

  // --- PÁGINAS DE CATÁLOGO (PÁGINA 2 EN ADELANTE — DISEÑO INTACTO Y LIGERO) ---
  doc.addPage();
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text(`${EMPRESA.nombre} — Catálogo de Productos`, 14, 16);

  const filas = [];
  const imagenesPorFila = [];

  for (let i = 0; i < filtrados.length; i++) {
    const prod = filtrados[i];
    const cats = (catsPorProducto.get(prod.id) || []).map((c) => c.name).join(', ');
    const miniatura = await cargarMiniaturaProducto(prod.image_url, 300);
    imagenesPorFila.push(miniatura);

    filas.push([
      '',
      `${prod.name}${cats ? `\n${cats}` : ''}`,
      formatearBs(prod.price_bs),
    ]);
  }

  autoTable(doc, {
    startY: 22,
    margin: { top: 22, bottom: 22 },
    head: [['Foto', 'Producto', 'Precio']],
    body: filas,
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 3,
      valign: 'middle',
      textColor: [30, 41, 59],
      minCellHeight: 18,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const miniatura = imagenesPorFila[data.row.index];
        if (miniatura?.dataUrl) {
          try {
            const boxSize = 14;
            const ratio = Math.min(
              boxSize / miniatura.width,
              boxSize / miniatura.height
            );
            const wImg = miniatura.width * ratio;
            const hImg = miniatura.height * ratio;
            const offsetX = (boxSize - wImg) / 2;
            const offsetY = (boxSize - hImg) / 2;

            doc.addImage(
              miniatura.dataUrl,
              'JPEG',
              data.cell.x + 3 + offsetX,
              data.cell.y + 2 + offsetY,
              wImg,
              hImg
            );
          } catch {
            // Ignora imagen si no se puede incrustar
          }
        }
      }
    },
    didDrawPage: () => {
      dibujarPieDePagina(doc, logoDevInfo);
    },
  });

  doc.save(nombreArchivoFinal);
}