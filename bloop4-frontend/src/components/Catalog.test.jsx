import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Catalog from './Catalog';
import { ApiRequestError, fetchCategories, fetchProducts } from '../api/catalogApi';
import { makeCategories, makePage } from '../test/fixtures';

vi.mock('../api/catalogApi', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchCategories: vi.fn(),
  fetchProducts: vi.fn(),
}));

beforeEach(() => {
  fetchProducts.mockReset();
  fetchCategories.mockReset().mockResolvedValue(makeCategories());
});

// Només les targetes de producte (el filtre també té elements de llista).
const productItems = () => within(screen.getByRole('list', { name: 'Productos' })).getAllByRole('listitem');
const lastCategoryIds = () => fetchProducts.mock.lastCall[0].categoryIds;

describe('Catalog', () => {
  it('mostra el skeleton mentre carrega i després els productes', async () => {
    fetchProducts.mockResolvedValue(makePage(3));
    render(<Catalog />);

    expect(screen.getByLabelText('Cargando productos')).toBeTruthy();
    expect(await screen.findByText('Producto 1')).toBeTruthy();
    expect(productItems()).toHaveLength(3);
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
    expect(productItems()).toHaveLength(30);
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
    expect(productItems()).toHaveLength(24);
  });
});

describe('Catalog · filtre per categories', () => {
  it('marcar una categoria pare filtra per totes les seves subcategories', async () => {
    fetchProducts.mockResolvedValueOnce(makePage(6)).mockResolvedValueOnce(makePage(4));
    render(<Catalog />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /^Sonido/ }));

    expect(await screen.findByText('4 productos')).toBeTruthy();
    expect(lastCategoryIds()).toEqual(['c-altavoces', 'c-microfonia']);
    expect(screen.getByRole('heading', { level: 1, name: 'Sonido' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quitar filtro Sonido' })).toBeTruthy();
  });

  it('desmarcar una subcategoria deixa el pare en estat mixt', async () => {
    fetchProducts.mockResolvedValue(makePage(2));
    render(<Catalog />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /^Sonido/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Microfonía/ }));

    expect(screen.getByRole('checkbox', { name: /^Sonido/ }).getAttribute('aria-checked')).toBe('mixed');
    expect(lastCategoryIds()).toEqual(['c-altavoces']);
  });

  it('combina categories de pares diferents (OR)', async () => {
    fetchProducts.mockResolvedValue(makePage(2));
    render(<Catalog />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /^Microfonía/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Sillas/ }));

    expect(lastCategoryIds()).toEqual(['c-microfonia', 'c-sillas']);
    expect(screen.getByRole('heading', { level: 1, name: '2 categorías' })).toBeTruthy();
  });

  it('treure el xip torna al catàleg complet', async () => {
    fetchProducts.mockResolvedValue(makePage(2));
    render(<Catalog />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /^Sonido/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro Sonido' }));

    expect(lastCategoryIds()).toEqual([]);
    expect(screen.getByRole('heading', { level: 1, name: 'Todo el catálogo' })).toBeTruthy();
  });

  it('sense resultats amb filtres, ofereix "Quitar filtros"', async () => {
    fetchProducts.mockResolvedValueOnce(makePage(6)).mockResolvedValueOnce(makePage(0)).mockResolvedValue(makePage(6));
    render(<Catalog />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /^Sillas/ }));
    const empty = (await screen.findByRole('heading', { name: 'No hay productos en estas categorías' })).parentElement;
    fireEvent.click(within(empty).getByRole('button', { name: 'Quitar filtros' }));

    expect(await screen.findByText('6 productos')).toBeTruthy();
    expect(lastCategoryIds()).toEqual([]);
  });

  it('si fallen les categories, els productes es continuen mostrant', async () => {
    fetchCategories.mockReset().mockRejectedValue(new ApiRequestError('Error HTTP 500'));
    fetchProducts.mockResolvedValue(makePage(3));
    render(<Catalog />);

    expect(await screen.findByText('No se pudieron cargar las categorías.')).toBeTruthy();
    expect(await screen.findByText('Producto 1')).toBeTruthy();
    expect(productItems()).toHaveLength(3);
  });
});

describe('Catalog · cerca', () => {
  const lastQuery = () => fetchProducts.mock.lastCall[0].q;
  const type = (text) => fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar productos' }), { target: { value: text } });

  it('envia la cerca després del debounce i mostra el xip', async () => {
    fetchProducts.mockResolvedValueOnce(makePage(6)).mockResolvedValue(makePage(2));
    render(<Catalog />);
    await screen.findByText('6 productos');

    type('  micro ');
    await waitFor(() => expect(lastQuery()).toBe('micro'));
    expect(await screen.findByText('2 productos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quitar búsqueda «micro»' })).toBeTruthy();
  });

  it('amb 1 caràcter no envia la cerca', async () => {
    fetchProducts.mockResolvedValue(makePage(6));
    render(<Catalog />);
    await screen.findByText('6 productos');

    type('m');
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchProducts).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Escribe al menos 2 caracteres.')).toBeTruthy();
  });

  it('sense resultats ofereix treure la cerca i els filtres', async () => {
    fetchProducts.mockResolvedValueOnce(makePage(6)).mockResolvedValueOnce(makePage(0)).mockResolvedValue(makePage(6));
    render(<Catalog />);
    await screen.findByText('6 productos');

    type('zzzz');
    const empty = (await screen.findByRole('heading', { name: 'No hay productos que coincidan con «zzzz»' })).parentElement;
    fireEvent.click(within(empty).getByRole('button', { name: 'Quitar búsqueda y filtros' }));

    expect(await screen.findByText('6 productos')).toBeTruthy();
    expect(lastQuery()).toBe('');
    expect(screen.getByRole('searchbox', { name: 'Buscar productos' }).value).toBe('');
  });
});
