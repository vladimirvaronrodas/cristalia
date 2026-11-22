import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EMPRESA } from '../config/empresa';
import { formatearBs } from './formato';

async function cargarImagenComoDataUrl(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: 'cors' });
    const blob = await resp.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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

  // Portada minimalista
  const logoData = await cargarImagenComoDataUrl(EMPRESA.logoUrl);
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', 93, 28, 30, 30);
    } catch {
      // Si el formato no admite addImage directo, continúa con el texto
    }
  }

  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text(EMPRESA.nombre, 108, logoData ? 72 : 55, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(EMPRESA.eslogan, 108, logoData ? 81 : 64, { align: 'center' });

  let subtituloFiltro = 'Catálogo General Visible';
  if (modo === 'CATEGORIAS') {
    const nombresCat = categoriasSeleccionadas
      .map((id) => mapaCats.get(id))
      .filter(Boolean);
    subtituloFiltro = `Categorías: ${nombresCat.join(', ') || 'Todas'}`;
  } else if (modo === 'SELECCION') {
    subtituloFiltro = `Selección personalizada (${filtrados.length} piezas)`;
  }

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(subtituloFiltro, 108, logoData ? 92 : 75, { align: 'center' });
  doc.text(
    `Emitido: ${new Date().toLocaleDateString('es-BO')}`,
    108,
    logoData ? 98 : 81,
    { align: 'center' }
  );

  // Página de catálogo con tabla + miniaturas
  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${EMPRESA.nombre} — Catálogo de Productos`, 14, 16);

  const filas = [];
  const imagenesPorFila = [];

  for (let i = 0; i < filtrados.length; i++) {
    const prod = filtrados[i];
    const cats = (catsPorProducto.get(prod.id) || []).map((c) => c.name).join(', ');
    const imgData = await cargarImagenComoDataUrl(prod.image_url);
    imagenesPorFila.push(imgData);

    filas.push([
      '',
      `${prod.name}${cats ? `\n${cats}` : ''}`,
      formatearBs(prod.price_bs),
    ]);
  }

  autoTable(doc, {
    startY: 22,
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
              'JPEG',
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
  });

  doc.save(nombreArchivo);
}