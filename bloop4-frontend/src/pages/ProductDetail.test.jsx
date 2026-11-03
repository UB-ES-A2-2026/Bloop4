import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductDetail from './ProductDetail';
import { ApiRequestError, fetchProduct, fetchProducts } from '../api/catalogApi';
import { makePage, makeProduct } from '../test/fixtures';

vi.mock('../api/catalogApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProduct: vi.fn(),
  fetchProducts: vi.fn(),
}));

const ID = 'd0000000-0000-4000-8000-000000000014';

function makeDetail(overrides = {}) {
  return makeProduct({
    id: ID,
    name: 'Carpa jaima 5x5 m',
    dailyPrice: '180.00',
    description: 'Carpa de lona blanca para bodas.',
    depositAmount: '400.00',
    insurance: 'Cubre daños por viento y lluvia.',
    specs: { Medidas: '5 x 5 m', Peso: '120 kg', Color: '' },
    images: [
      { path: '/images/products/carpa-jaima.svg', altText: 'Carpa jaima blanca' },
      { path: '/images/products/carpa-jaima-interior.svg', altText: 'Interior de la carpa' },
    ],
    ...overrides,
  });
}

function renderDetail(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/productos/${ID}`, state }]}>
      <Routes>
        <Route path="/productos/:id" element={<ProductDetail />} />
        <Route path="/" element={<p>Catálogo</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchProduct.mockReset();
  fetchProducts.mockReset().mockResolvedValue(makePage(2));
});

describe('ProductDetail', () => {
  it('mostra la fitxa completa amb els imports en format es-ES', async () => {
    fetchProduct.mockResolvedValue(makeDetail());
    renderDetail();

    expect(await screen.findByRole('heading', { level: 1, name: 'Carpa jaima 5x5 m' })).toBeTruthy();
    expect(fetchProduct.mock.calls[0][0]).toBe(ID);
    expect(screen.getByText(/^180\s€$/)).toBeTruthy();
    expect(screen.getByText(/^400\s€$/)).toBeTruthy();
    expect(screen.getByText('Cubre daños por viento y lluvia.')).toBeTruthy();
    expect(screen.getByText('Carpa de lona blanca para bodas.')).toBeTruthy();
    expect(screen.getByText('Sonido Levante S.L. · Valencia')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Carpa jaima blanca' }).getAttribute('loading')).toBe('lazy');
  });

  it('amaga les especificacions buides', async () => {
    fetchProduct.mockResolvedValue(makeDetail());
    renderDetail();

    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).queryByText('Color')).toBeNull();
  });

  it('sense especificacions no mostra la taula; sense assegurança ni fiança ho diu', async () => {
    fetchProduct.mockResolvedValue(makeDetail({ specs: {}, insurance: null, depositAmount: '0.00' }));
    renderDetail();

    expect(await screen.findByText('Sin seguro')).toBeTruthy();
    expect(screen.getByText('Sin fianza')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('si la imatge no carrega mostra la següent i, si no n\'hi ha, la il·lustració de la categoria', async () => {
    fetchProduct.mockResolvedValue(makeDetail());
    renderDetail();

    fireEvent.error(await screen.findByRole('img', { name: 'Carpa jaima blanca' }));
    fireEvent.error(screen.getByRole('img', { name: 'Interior de la carpa' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Altavoces')).toBeTruthy(); // etiqueta de la il·lustració
  });

  it('404: "Producto no disponible" amb productes de la mateixa categoria', async () => {
    fetchProduct.mockRejectedValue(new ApiRequestError('Producto no encontrado', { status: 404, code: 'NOT_FOUND' }));
    renderDetail({ categoryId: 'c-carpas' });

    expect(await screen.findByText('Producto no disponible')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toBeTruthy();
    expect(await screen.findByRole('list', { name: 'Productos relacionados' })).toBeTruthy();
    expect(fetchProducts.mock.calls[0][0].categoryIds).toEqual(['c-carpas']);
  });

  it('error de l\'API: missatge i "Reintentar"', async () => {
    fetchProduct
      .mockRejectedValueOnce(new ApiRequestError('No se pudo conectar con el servidor'))
      .mockResolvedValueOnce(makeDetail());
    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Carpa jaima 5x5 m' })).toBeTruthy();
  });

  it('"Volver al catálogo" conserva la cerca i els filtres', async () => {
    fetchProduct.mockResolvedValue(makeDetail());
    renderDetail({ catalogSearch: '?categorias=c-carpas&q=carpa' });

    const back = await screen.findByRole('link', { name: '← Volver al catálogo' });
    expect(back.getAttribute('href')).toBe('/?categorias=c-carpas&q=carpa');
  });
});
