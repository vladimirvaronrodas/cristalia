import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EMPRESA } from '../config/empresa';
import { formatearBs } from './formato';

export async function capturarElementoComoPng(elemento, nombreArchivo = 'cotizacion-cristalia.png') {
  if (!elemento) return null;
  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#FFFFFF',
  });
  const dataUrl = canvas.toDataURL('image/png');
  const enlace = document.createElement('a');
  enlace.href = dataUrl;
  enlace.download = nombreArchivo;
  enlace.click();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { dataUrl, blob, nombreArchivo };
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

export async function compartirComprobante({ elemento, titulo, texto, nombreArchivo = 'recibo-cristalia.png' }) {
  let blob = null;
  if (elemento) {
    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF',
    });
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  if (navigator.share) {
    try {
      if (blob && typeof File !== 'undefined') {
        const archivo = new File([blob], nombreArchivo, { type: 'image/png' });
        if (!navigator.canShare || navigator.canShare({ files: [archivo] })) {
          await navigator.share({
            title: titulo || EMPRESA.nombre,
            text: texto || '',
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return { compartido: false, descargado: true };
}