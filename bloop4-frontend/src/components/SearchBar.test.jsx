import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchBar from './SearchBar';

describe('SearchBar', () => {
  it('avisa quan el text té menys de 2 caràcters', () => {
    render(<SearchBar value="a" onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByText('Escribe al menos 2 caracteres.')).toBeTruthy();
  });

  it('el botó de borrar només surt si hi ha text i crida onClear', () => {
    const onClear = vi.fn();
    const { rerender } = render(<SearchBar value="" onChange={() => {}} onClear={onClear} />);
    expect(screen.queryByRole('button', { name: 'Borrar búsqueda' })).toBeNull();

    rerender(<SearchBar value="carpa" onChange={() => {}} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('limita el text a 100 caràcters', () => {
    render(<SearchBar value="" onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('searchbox', { name: 'Buscar productos' }).getAttribute('maxlength')).toBe('100');
  });
});
