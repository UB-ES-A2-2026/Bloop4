import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductCard from './ProductCard';
import { makeProduct } from '../test/fixtures';

describe('ProductCard', () => {
  it('mostra nom, categoria, venedor i preu per dia', () => {
    render(<ProductCard product={makeProduct()} />);

    expect(screen.getByRole('heading', { name: 'Altavoz activo 12" 1300 W' })).toBeTruthy();
    expect(screen.getByText('Altavoces')).toBeTruthy();
    expect(screen.getByText('Sonido Levante S.L. · Valencia')).toBeTruthy();
    // Intl separa l'import i el símbol amb un espai no separable.
    expect(screen.getByText(/^45\s€$/)).toBeTruthy();
  });

  it('mostra els cèntims només si n\'hi ha', () => {
    render(<ProductCard product={makeProduct({ dailyPrice: '3.50' })} />);

    expect(screen.getByText(/^3,50\s€$/)).toBeTruthy();
  });
});
