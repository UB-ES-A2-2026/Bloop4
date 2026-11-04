import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SellerProductForm from './SellerProductForm';
import { createProduct, fetchMyProduct, publishProduct, updateProduct } from '../api/sellerApi';
import { fetchCategories } from '../api/catalogApi';
import { ApiRequestError } from '../api/http';
import { makeCategories } from '../test/fixtures';

vi.mock('../api/sellerApi', async (importOriginal) => ({
  ...(await importOriginal()),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  publishProduct: vi.fn(),
  fetchMyProduct: vi.fn(),
}));
vi.mock('../api/catalogApi', async (importOriginal) => ({ ...(await importOriginal()), fetchCategories: vi.fn() }));

const PRODUCT = {
  id: 'p1', name: 'Barra LED', status: 'draft', category: { id: 'c-altavoces' }, dailyPrice: '10.00', depositAmount: '0.00',
  currency: 'EUR', insurance: null, description: null, specs: {}, units: 2, weightKg: null, lengthCm: null, widthCm: null, heightCm: null, images: [],
};

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/vendedor/productos/nuevo" element={<SellerProductForm />} />
        <Route path="/vendedor/productos/:id" element={<SellerProductForm />} />
      </Routes>
    </MemoryRouter>,
  );
}
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  fetchCategories.mockReset().mockResolvedValue(makeCategories());
  createProduct.mockReset();
  updateProduct.mockReset();
  publishProduct.mockReset();
  fetchMyProduct.mockReset().mockResolvedValue(PRODUCT);
});

describe('SellerProductForm', () => {
  it('desa l\'esborrany i passa a la seva URL per poder pujar les fotos', async () => {
    createProduct.mockResolvedValue(PRODUCT);
    renderAt('/vendedor/productos/nuevo');
    await screen.findByRole('option', { name: 'Altavoces' });
    type('Nombre', 'Barra LED');
    type('Categoría', 'c-altavoces');
    type('Precio por día (€)', '10,5');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(await screen.findByText('Borrador guardado. Ahora puedes añadir las fotos.')).toBeTruthy();
    expect(createProduct.mock.calls[0][0]).toMatchObject({ name: 'Barra LED', categoryId: 'c-altavoces', dailyPrice: '10.5', units: 1, weightKg: null });
    expect(screen.getByText('Añadir fotos')).toBeTruthy();
  });

  it('en publicar sense dades suficients explica què falta, sense perdre el formulari', async () => {
    updateProduct.mockResolvedValue(PRODUCT);
    publishProduct.mockRejectedValue(
      new ApiRequestError('Faltan datos para publicar el producto', { status: 400, details: { missing: ['images', 'weightKg'] } }),
    );
    renderAt('/vendedor/productos/p1');
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Para publicar falta: al menos una foto, peso.');
    expect(screen.getByLabelText('Nombre').value).toBe('Barra LED');
  });

  it('un cop publicat ho indica', async () => {
    updateProduct.mockResolvedValue(PRODUCT);
    publishProduct.mockResolvedValue({ ...PRODUCT, status: 'published' });
    renderAt('/vendedor/productos/p1');
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText('Producto publicado: ya aparece en el catálogo.')).toBeTruthy();
  });
});
