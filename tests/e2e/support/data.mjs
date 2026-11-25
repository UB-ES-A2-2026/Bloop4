// Dades de prova: dates de l'esdeveniment i imatges.
import { crc32, deflateSync } from 'node:zlib';

/**
 * Esdeveniment d'un dia d'aquí a ~400 dies (sempre al futur, lluny de les reserves dels seeds del 2030).
 * `offset` separa les proves que s'executen alhora. Valors per als <input type="datetime-local">.
 */
export function eventDates(offset = 0) {
  const day = new Date(Date.now() + (400 + offset) * 24 * 3600 * 1000);
  const ymd = day.toISOString().slice(0, 10);
  const next = new Date(day.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  return { day: ymd, nextDay: next, from: `${ymd}T12:00`, to: `${next}T11:00` };
}

/** PNG de `width`×`height` d'un sol color, per pujar-lo com a foto d'un producte. */
export function pngImage(width = 120, height = 80, [r, g, b] = [74, 144, 226]) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits per canal, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
