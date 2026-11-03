import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createImageStore, detectImageType } from '../src/uploads/images.js';

describe('detectImageType', () => {
  it('reconeix JPEG, PNG i WebP pels primers bytes', () => {
    assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xdb])), 'jpg');
    assert.equal(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png');
    assert.equal(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  });

  it('rebutja la resta (GIF, SVG, text, buit)', () => {
    for (const data of ['GIF89a', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'hola', '']) {
      assert.equal(detectImageType(Buffer.from(data)), null, data);
    }
  });
});

describe('createImageStore', () => {
  it('desa el fitxer amb un nom generat i retorna la ruta pública', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'uploads-'));
    const store = createImageStore(dir);
    const publicPath = await store.save('p1', Buffer.from('abc'), 'png');
    assert.match(publicPath, /^\/uploads\/products\/p1\/[0-9a-f-]{36}\.png$/);
    assert.equal(await readFile(path.join(dir, publicPath.slice('/uploads/'.length)), 'utf8'), 'abc');
    await store.remove(publicPath);
    await assert.rejects(stat(path.join(dir, publicPath.slice('/uploads/'.length))));
  });

  it('no esborra mai fitxers de fora de la carpeta de fotos', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'uploads-'));
    const outside = path.join(path.dirname(dir), `outside-${Date.now()}.txt`);
    await writeFile(outside, 'no em toquis');
    await createImageStore(dir).remove(`/uploads/products/../../${path.basename(outside)}`);
    assert.equal(await readFile(outside, 'utf8'), 'no em toquis');
  });
});
