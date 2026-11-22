const TAMANO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB de entrada antes de optimizar
const LADO_MAXIMO_PX = 1200;

export function validarArchivoImagen(archivo) {
  if (!archivo) {
    return { valido: false, error: 'No se seleccionó ningún archivo.' };
  }
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
  if (!tiposPermitidos.includes(archivo.type)) {
    return {
      valido: false,
      error: 'Solo se admiten imágenes en formato JPG, PNG o WebP.',
    };
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    return {
      valido: false,
      error: 'La imagen supera el límite permitido (máx. 8 MB antes de optimizar).',
    };
  }
  return { valido: true, error: null };
}

export function optimizarImagenEnNavegador(archivo, calidad = 0.84) {
  return new Promise((resolve, reject) => {
    const validacion = validarArchivoImagen(archivo);
    if (!validacion.valido) {
      reject(new Error(validacion.error));
      return;
    }

    const urlTemporal = URL.createObjectURL(archivo);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(urlTemporal);

      let { width, height } = img;
      if (width > LADO_MAXIMO_PX || height > LADO_MAXIMO_PX) {
        if (width >= height) {
          height = Math.round((height * LADO_MAXIMO_PX) / width);
          width = LADO_MAXIMO_PX;
        } else {
          width = Math.round((width * LADO_MAXIMO_PX) / height);
          height = LADO_MAXIMO_PX;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('No se pudo procesar la imagen.'));
            return;
          }
          const nombreBase = archivo.name.replace(/\.[^/.]+$/, '');
          const archivoOptimizado = new File([blob], `${nombreBase}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(archivoOptimizado);
        },
        'image/webp',
        calidad
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(urlTemporal);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };

    img.src = urlTemporal;
  });
}