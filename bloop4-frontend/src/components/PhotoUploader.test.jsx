import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import PhotoUploader from './PhotoUploader';
import { deleteImage, uploadImage } from '../api/sellerApi';
import { ApiRequestError } from '../api/http';

vi.mock('../api/sellerApi', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
}));

function Harness({ initial = [] }) {
  const [images, setImages] = useState(initial);
  return <PhotoUploader productId="p1" images={images} onChange={setImages} />;
}

const file = (name, type = 'image/jpeg', size = 1000) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const choose = (...files) => fireEvent.change(screen.getByLabelText('Añadir fotos'), { target: { files } });

beforeEach(() => {
  uploadImage.mockReset();
  deleteImage.mockReset();
});

describe('PhotoUploader', () => {
  it('rebutja al navegador els formats no admesos i les fotos de més de 10 MB', () => {
    render(<Harness />);
    choose(file('doc.pdf', 'application/pdf'), file('gran.jpg', 'image/jpeg', 11 * 1024 * 1024));
    expect(screen.getByRole('alert').textContent).toMatch(/doc\.pdf.*no es una foto/);
    expect(screen.getByRole('alert').textContent).toMatch(/gran\.jpg.*10 MB/);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('puja la foto i l\'afegeix a la llista', async () => {
    uploadImage.mockResolvedValue({ id: 'i1', path: '/uploads/products/p1/a.jpg', altText: 'Barra' });
    render(<Harness />);
    choose(file('a.jpg'));
    expect(await screen.findByRole('img', { name: 'Barra' })).toBeTruthy();
    expect(uploadImage.mock.calls[0][0]).toBe('p1');
  });

  it('si falla una pujada es pot reintentar només aquella foto', async () => {
    uploadImage
      .mockRejectedValueOnce(new ApiRequestError('No se pudo conectar con el servidor'))
      .mockResolvedValueOnce({ id: 'i1', path: '/uploads/products/p1/a.jpg', altText: 'Barra' });
    render(<Harness />);
    choose(file('a.jpg'));
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('img', { name: 'Barra' })).toBeTruthy();
    expect(uploadImage).toHaveBeenCalledTimes(2);
  });

  it('eliminar una foto la treu de la llista', async () => {
    deleteImage.mockResolvedValue(null);
    render(<Harness initial={[{ id: 'i1', path: '/uploads/products/p1/a.jpg', altText: 'Barra' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar a.jpg' }));
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Barra' })).toBeNull());
    expect(deleteImage).toHaveBeenCalledWith('p1', 'i1');
  });
});
