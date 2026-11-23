import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_TYPE = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const SAFE_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * Fotos de les proves de lliurament (US-11). Es desen en un directori privat (PROOF_DIR) que Nginx
 * no serveix: només les retorna l'API després de comprovar qui les demana. El nom el genera el
 * servidor; el que envia el client no s'utilitza mai.
 */
export function createProofStore(proofDir) {
  const root = path.resolve(proofDir);
  const absolute = (relative) => {
    if (!SAFE_PATH.test(relative)) throw new Error('Ruta de foto no válida');
    const target = path.join(root, relative);
    if (!target.startsWith(root + path.sep)) throw new Error('Ruta de foto no válida');
    return target;
  };

  return {
    /** @returns { path, contentType } (ruta relativa dins de PROOF_DIR) */
    async save(deliveryId, buffer, extension) {
      const relative = `${deliveryId}/${randomUUID()}.${extension}`;
      const target = absolute(relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, buffer, { flag: 'wx' });
      return { path: relative, contentType: CONTENT_TYPE[extension] };
    },

    async read(relative) {
      return readFile(absolute(relative));
    },

    async remove(relative) {
      await rm(absolute(relative), { force: true });
    },
  };
}
