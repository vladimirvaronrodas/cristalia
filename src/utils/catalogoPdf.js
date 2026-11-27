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

async function convertirBlobAPngTransparente(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const imagen = new Image();
      imagen.onload = () => resolve(imagen);
      imagen.onerror = reject;
      imagen.src = objectUrl;
    });

    const ancho = img.naturalWidth || 400;
    const alto = img.naturalHeight || 400;
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
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function cargarImagenConDimensiones(url, urlRespaldo = '') {
  const intentar = async (ruta) => {
    if (!ruta) return null;
    try {
      const resp = await fetch(ruta, { mode: 'cors' });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/')) return null;

      if (blob.type === 'image/png') {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (!dataUrl) return null;

        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve({
              width: img.naturalWidth || 400,
              height: img.naturalHeight || 400,
            });
          img.onerror = () => resolve({ width: 400, height: 400 });
          img.src = dataUrl;
        });

        return { dataUrl, width: dims.width, height: dims.height };
      }

      return await convertirBlobAPngTransparente(blob);
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

  // Cola inferior izquierda de la burbuja
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

  // Izquierda: Cristalia + enlace a la web
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const prefijoWeb = `${EMPRESA.nombre} — `;
  doc.text(prefijoWeb, 14, yTexto);

  const anchoPrefijo = doc.getTextWidth(prefijoWeb);
  const textoWeb = EMPRESA.sitioWebTexto || 'cristalia.pages.dev';
  const urlWeb = EMPRESA.sitioWeb || 'https://cristalia.pages.dev';

  doc.setTextColor(15, 23, 42);
  doc.text(textoWeb, 14 + anchoPrefijo, yTexto);
  const anchoUrlWeb = doc.getTextWidth(textoWeb);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.2);
  doc.line(14 + anchoPrefijo, yTexto + 0.8, 14 + anchoPrefijo + anchoUrlWeb, yTexto + 0.8);
  doc.link(14 + anchoPrefijo, yTexto - 3.5, anchoUrlWeb, 5, { url: urlWeb });

  // Derecha: Desarrollado por ARTECH TECHNOLOGY + WhatsApp clicable
  const telDevMostrar = formatearTelefonoMostrar(EMPRESA.desarrollador.whatsappSoporte);
  const textoDev = `${EMPRESA.desarrollador.texto} · ${telDevMostrar}`;
  const urlDev = `https://wa.me/${EMPRESA.desarrollador.whatsappSoporte}?text=${encodeURIComponent(
    `Hola ${EMPRESA.desarrollador.texto}, vi su contacto en el catálogo de ${EMPRESA.nombre}.`
  )}`;

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
  nombreArchivo = 'catalogo-cristalia.pdf',
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

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const centroX = anchoPagina / 2;

  const [logoInfo, logoDevInfo] = await Promise.all([
    cargarImagenConDimensiones(EMPRESA.logoPdfUrl, EMPRESA.logoUrl),
    cargarImagenConDimensiones(EMPRESA.desarrollador.logoUrl),
  ]);
  const iconoWaData = crearIconoWhatsAppPng();

  // --- PORTADA (PÁGINA 1) ---
  let cursorY = 30;
  if (logoInfo?.dataUrl) {
    try {
      const maxAncho = 44;
      const maxAlto = 34;
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
      cursorY += hLogo + 12;
    } catch {
      cursorY = 55;
    }
  } else {
    cursorY = 55;
  }

  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text(EMPRESA.nombre, centroX, cursorY, { align: 'center' });

  cursorY += 9;
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(EMPRESA.eslogan, centroX, cursorY, { align: 'center' });

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
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(subtituloFiltro, centroX, cursorY, { align: 'center' });

  cursorY += 6;
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
    const anchoCaja = 118;
    const altoCaja = 34;
    const xCaja = centroX - anchoCaja / 2;
    const yCaja = cursorY + 14;

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(xCaja, yCaja, anchoCaja, altoCaja, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('PEDIDOS Y CONSULTAS POR WHATSAPP', centroX, yCaja + 7, {
      align: 'center',
    });

    contactosPortada.forEach((contacto, idx) => {
      const yFila = yCaja + 15.5 + idx * 10;
      const telMostrar = formatearTelefonoMostrar(contacto.telefono);
      const lineaTexto = `${contacto.etiqueta}: ${telMostrar}`;
      const urlWa = `https://wa.me/${contacto.telefono}?text=${encodeURIComponent(
        contacto.mensaje
      )}`;

      doc.setFontSize(10);
      const anchoTexto = doc.getTextWidth(lineaTexto);
      const anchoTotalFila = 4.5 + 2.2 + anchoTexto;
      const xInicioFila = centroX - anchoTotalFila / 2;

      doc.addImage(iconoWaData, 'PNG', xInicioFila, yFila - 3.4, 4.3, 4.3);

      doc.setTextColor(15, 23, 42);
      doc.text(lineaTexto, xInicioFila + 6.7, yFila);

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.line(
        xInicioFila + 6.7,
        yFila + 0.9,
        xInicioFila + 6.7 + anchoTexto,
        yFila + 0.9
      );

      doc.link(xInicioFila - 2, yFila - 4.5, anchoTotalFila + 4, 6.5, {
        url: urlWa,
      });
    });
  }

  dibujarPieDePagina(doc, logoDevInfo);

  // --- PÁGINAS DE CATÁLOGO (PÁGINA 2 EN ADELANTE — DISEÑO ORIGINAL) ---
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${EMPRESA.nombre} — Catálogo de Productos`, 14, 16);

  const filas = [];
  const imagenesPorFila = [];

  for (let i = 0; i < filtrados.length; i++) {
    const prod = filtrados[i];
    const cats = (catsPorProducto.get(prod.id) || []).map((c) => c.name).join(', ');
    const imgInfo = await cargarImagenConDimensiones(prod.image_url);
    imagenesPorFila.push(imgInfo?.dataUrl || null);

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
      fontSize: 10,
      cellPadding: 3,
      valign: 'middle',
      textColor: [30, 41, 59],
      minCellHeight: 18,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 36, fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const imgBase64 = imagenesPorFila[data.row.index];
        if (imgBase64) {
          try {
            doc.addImage(
              imgBase64,
              'PNG',
              data.cell.x + 3,
              data.cell.y + 2,
              14,
              14
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

  doc.save(nombreArchivo);
}