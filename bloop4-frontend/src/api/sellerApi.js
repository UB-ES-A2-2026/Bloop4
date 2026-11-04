/** Client de les rutes /api/seller (productes del venedor). */
import { ApiRequestError, request } from './http';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function fetchMyProducts({ signal } = {}) {
  const { data } = await request('/seller/products', { signal });
  return data;
}

export async function fetchMyProduct(id, { signal } = {}) {
  const { data } = await request(`/seller/products/${encodeURIComponent(id)}`, { signal, shape: 'object' });
  return data;
}

export async function createProduct(fields) {
  const { data } = await request('/seller/products', { method: 'POST', body: fields, shape: 'object' });
  return data;
}

export async function updateProduct(id, fields) {
  const { data } = await request(`/seller/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: fields, shape: 'object' });
  return data;
}

export async function publishProduct(id) {
  const { data } = await request(`/seller/products/${encodeURIComponent(id)}/publish`, { method: 'POST', shape: 'object' });
  return data;
}

export function deleteImage(productId, imageId) {
  return request(`/seller/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, {
    method: 'DELETE',
    shape: 'none',
  });
}

/**
 * Puja una foto amb XMLHttpRequest, perquè fetch no informa del progrés de pujada.
 * `onProgress(0..1)`. @returns la foto creada { id, path, altText }
 */
export function uploadImage(productId, file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/seller/products/${encodeURIComponent(productId)}/images`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // resposta sense JSON: es tracta com a error genèric
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.data) return resolve(body.data);
      reject(new ApiRequestError(body?.error?.message ?? `Error HTTP ${xhr.status}`, { status: xhr.status, code: body?.error?.code }));
    };
    xhr.onerror = () => reject(new ApiRequestError('No se pudo conectar con el servidor'));
    const form = new FormData();
    form.append('photo', file);
    xhr.send(form);
  });
}

/** Missatge d'error si el fitxer no es pot pujar; null si és correcte. */
export function checkPhoto(file) {
  if (!PHOTO_TYPES.includes(file.type)) return `«${file.name}» no es una foto JPEG, PNG o WebP.`;
  if (file.size > MAX_PHOTO_BYTES) return `«${file.name}» supera el máximo de 10 MB.`;
  return null;
}
