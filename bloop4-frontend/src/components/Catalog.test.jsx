import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Catalog from './Catalog';
import { ApiRequestError, fetchProducts } from '../api/catalogApi';
import { makePage } from '../test/fixtures';

vi.mock('../api/catalogApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchProducts: vi.fn(),
}));

beforeEach(() => fetchProducts.mockReset());

describe('Catalog', () => {
  it('mostra el skeleton mentre carrega i després els productes', async () => {
    fetchProducts.mockResolvedValue(makePage(3));
    render(<Catalog />);

    expect(screen.getByLabelText('Cargando productos')).toBeTruthy();
    expect(await screen.findByText('Producto 1')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('3 productos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('mostra l\'estat buit si no hi ha productes', async () => {
    fetchProducts.mockResolvedValue(makePage(0));
    render(<Catalog />);

    expect(await screen.findByText('Todavía no hay productos en el catálogo')).toBeTruthy();
  });

  it('mostra l\'error de l\'API i torna a provar amb "Reintentar"', async () => {
    fetchProducts
      .mockRejectedValueOnce(new ApiRequestError('No se pudo conectar con el servidor'))
      .mockResolvedValueOnce(makePage(1));
    render(<Catalog />);

    expect(await screen.findByText('No se pudo cargar el catálogo')).toBeTruthy();
    expect(screen.getByText('No se pudo conectar con el servidor')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Producto 1')).toBeTruthy();
    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });

  it('"Cargar más" afegeix la pàgina següent a la llista', async () => {
    fetchProducts
      .mockResolvedValueOnce(makePage(24, { totalItems: 30 }))
      .mockResolvedValueOnce(makePage(6, { page: 2, totalItems: 30, firstIndex: 24 }));
    render(<Catalog />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByText('Producto 30')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(30);
    expect(fetchProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 24 }),
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('si falla la pàgina següent conserva els productes ja carregats', async () => {
    fetchProducts
      .mockResolvedValueOnce(makePage(24, { totalItems: 30 }))
      .mockRejectedValueOnce(new ApiRequestError('Error HTTP 500'));
    render(<Catalog />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByText(/No se pudo cargar la página siguiente/)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(24);
  });
});
