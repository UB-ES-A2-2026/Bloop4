import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 10;

/**
 * Tipus d'imatge segons els primers bytes del fitxer (no segons l'extensió ni el
 * Content-Type, que els decideix el client). @returns 'jpg' | 'png' | 'webp' | null
 */
export function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}

/**
 * Desa les fotos dins d'`uploadDir`. El nom del fitxer el genera el servidor (UUID): el que
 * envia el client no s'utilitza mai, així que no hi pot haver rutes amb `..`.
 */
export function createImageStore(uploadDir) {
  return {
    /** @returns la ruta pública (/uploads/products/<producte>/<uuid>.<ext>) */
    async save(productId, buffer, extension) {
      const relative = path.posix.join('products', productId, `${randomUUID()}.${extension}`);
      const target = path.join(uploadDir, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, buffer, { flag: 'wx' });
      return `/uploads/${relative}`;
    },

    async remove(publicPath) {
      if (!publicPath.startsWith('/uploads/products/')) return;
      const target = path.join(uploadDir, publicPath.slice('/uploads/'.length));
      if (!target.startsWith(path.resolve(uploadDir) + path.sep)) return;
      await rm(target, { force: true });
    },
  };
}
