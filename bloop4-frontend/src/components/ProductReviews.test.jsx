import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductReviews from './ProductReviews';
import { createReview, fetchReviewEligibility, fetchReviews, hideReview } from '../api/reviewApi';
import { fetchProduct } from '../api/catalogApi';
import { ApiRequestError } from '../api/http';
import { useAuth } from '../auth/AuthContext';

vi.mock('../api/reviewApi', () => ({ fetchReviews: vi.fn(), fetchReviewEligibility: vi.fn(), createReview: vi.fn(), hideReview: vi.fn() }));
vi.mock('../api/catalogApi', () => ({ fetchProduct: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));

const review = (id, rating, comment = null) => ({ id, rating, comment, author: 'Laura C.', createdAt: '2026-10-12T09:00:00.000Z' });
const page = (reviews, pageNumber = 1, totalPages = 1) => ({ reviews, pagination: { page: pageNumber, totalPages, totalItems: reviews.length } });
const product = (rating = { average: '4.5', count: 2 }) => ({ id: 'p1', rating });
const renderReviews = (p = product()) => render(<ProductReviews product={p} />, { wrapper: MemoryRouter });

beforeEach(() => {
  for (const fn of [fetchReviews, fetchReviewEligibility, createReview, hideReview, fetchProduct]) fn.mockReset();
  useAuth.mockReturnValue({ user: { id: 'u1', roles: ['customer'] } });
  fetchReviewEligibility.mockResolvedValue({ canReview: false, reason: 'NOT_RENTED', bookings: [] });
});

describe('ProductReviews', () => {
  it('mostra la mitjana amb un decimal, el nombre de valoracions i els comentaris', async () => {
    fetchReviews.mockResolvedValue(page([review('r1', 5, 'Sonó genial'), review('r2', 4)]));
    renderReviews();
    expect(screen.getByText('4,5')).toBeTruthy();
    expect(screen.getByText(/2 valoraciones/)).toBeTruthy();
    const items = await screen.findAllByRole('listitem');
    expect(within(items[0]).getByLabelText('5 de 5 estrellas').textContent).toBe('★★★★★');
    expect(within(items[0]).getByText('Sonó genial')).toBeTruthy();
    expect(within(items[1]).getByLabelText('4 de 5 estrellas').textContent).toBe('★★★★☆');
  });

  it('sense valoracions diu «Todavía sin valoraciones» en lloc d\'una puntuació', async () => {
    fetchReviews.mockResolvedValue(page([]));
    renderReviews(product({ average: null, count: 0 }));
    expect(screen.getByText('Todavía sin valoraciones')).toBeTruthy();
    expect(screen.queryByText(/de 5/)).toBeNull();
  });

  it('«Cargar más» demana la pàgina següent i l\'afegeix a la llista', async () => {
    fetchReviews.mockResolvedValueOnce(page([review('r1', 5)], 1, 2)).mockResolvedValueOnce(page([review('r2', 3)], 2, 2));
    renderReviews();
    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(fetchReviews).toHaveBeenLastCalledWith('p1', 2);
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('un comentari amb HTML es mostra com a text', async () => {
    fetchReviews.mockResolvedValue(page([review('r1', 1, '<img src=x onerror=alert(1)>')]));
    const { container } = renderReviews();
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('el client amb una reserva finalitzada valora el producte i la mitjana s\'actualitza', async () => {
    fetchReviews.mockResolvedValue(page([]));
    fetchReviewEligibility
      .mockResolvedValueOnce({ canReview: true, reason: null, bookings: [{ bookingId: 'b1', bookingNumber: 'B4-2026-000002' }] })
      .mockResolvedValueOnce({ canReview: false, reason: 'ALREADY_REVIEWED', reviewAgainLater: false, bookings: [] });
    createReview.mockResolvedValue(review('r9', 4, 'Muy bien'));
    fetchProduct.mockResolvedValue({ rating: { average: '4.0', count: 1 } });
    renderReviews(product({ average: null, count: 0 }));

    fireEvent.click(await screen.findByRole('button', { name: 'Publicar valoración' }));
    expect(screen.getByRole('alert').textContent).toBe('Elige una puntuación de 1 a 5 estrellas.');
    fireEvent.click(screen.getByLabelText('4 estrellas'));
    fireEvent.change(screen.getByLabelText('Comentario (opcional)'), { target: { value: 'Muy bien' } });
    expect(screen.getByText('8/1000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar valoración' }));

    expect(await screen.findByText('¡Gracias! Tu valoración ya está publicada.')).toBeTruthy();
    expect(createReview).toHaveBeenCalledWith('p1', { bookingId: 'b1', rating: 4, comment: 'Muy bien' });
    expect(await screen.findByText('4,0')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Publicar valoración' })).toBeNull());
  });

  it('amb una altra reserva finalitzada sense valorar, el formulari hi torna a sortir', async () => {
    fetchReviews.mockResolvedValue(page([]));
    fetchProduct.mockResolvedValue({ rating: { average: '5.0', count: 1 } });
    fetchReviewEligibility
      .mockResolvedValueOnce({ canReview: true, reason: null, bookings: [{ bookingId: 'b1', bookingNumber: 'B4-1' }, { bookingId: 'b2', bookingNumber: 'B4-2' }] })
      .mockResolvedValueOnce({ canReview: true, reason: null, bookings: [{ bookingId: 'b2', bookingNumber: 'B4-2' }] });
    createReview.mockResolvedValue(review('r9', 5));
    renderReviews(product({ average: null, count: 0 }));

    fireEvent.click(await screen.findByLabelText('5 estrellas'));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar valoración' }));
    await waitFor(() => expect(fetchReviewEligibility).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Publicar valoración' })).toBeTruthy();
    expect(createReview).toHaveBeenCalledWith('p1', { bookingId: 'b1', rating: 5, comment: '' });
  });

  it('si ja l\'ha valorat i té una altra reserva en curs, li diu que podrà tornar-hi', async () => {
    fetchReviews.mockResolvedValue(page([]));
    fetchReviewEligibility.mockResolvedValue({ canReview: false, reason: 'ALREADY_REVIEWED', reviewAgainLater: true, bookings: [] });
    renderReviews();
    expect((await screen.findByText(/Ya has valorado este producto/)).textContent).toBe(
      'Ya has valorado este producto. ¡Gracias! Podrás volver a valorarlo cuando termine tu otra reserva con él.',
    );
  });

  it('explica per què no es pot valorar', async () => {
    fetchReviews.mockResolvedValue(page([]));
    fetchReviewEligibility.mockResolvedValueOnce({ canReview: false, reason: 'NOT_FINISHED', bookings: [] });
    const { unmount } = renderReviews();
    expect(await screen.findByText(/cuando termine tu reserva y se recoja el material/)).toBeTruthy();
    unmount();

    useAuth.mockReturnValue({ user: null });
    fetchReviewEligibility.mockResolvedValueOnce({ canReview: false, reason: 'LOGIN', bookings: [] });
    renderReviews();
    expect((await screen.findByRole('link', { name: 'Inicia sesión' })).getAttribute('href')).toBe('/iniciar-sesion');
  });

  it('si l\'API rebutja la valoració, ho mostra i es pot tornar a provar', async () => {
    fetchReviews.mockResolvedValue(page([]));
    fetchReviewEligibility.mockResolvedValue({ canReview: true, reason: null, bookings: [{ bookingId: 'b1', bookingNumber: 'B4' }] });
    createReview.mockImplementation(async () => {
      throw new ApiRequestError('Ya has valorado este producto', { status: 409 });
    });
    renderReviews();
    fireEvent.click(await screen.findByLabelText('5 estrellas'));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar valoración' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Ya has valorado este producto');
    expect(screen.getByRole('button', { name: 'Publicar valoración' }).disabled).toBe(false);
  });

  it('l\'administrador pot ocultar una valoració; un client no veu el botó', async () => {
    fetchReviews.mockResolvedValueOnce(page([review('r1', 1, 'Insulto')])).mockResolvedValueOnce(page([]));
    fetchProduct.mockResolvedValue({ rating: { average: null, count: 0 } });
    useAuth.mockReturnValue({ user: { id: 'a1', roles: ['admin'] } });
    hideReview.mockResolvedValue(null);
    renderReviews(product({ average: '1.0', count: 1 }));

    fireEvent.click(await screen.findByRole('button', { name: 'Ocultar' }));
    expect(await screen.findByText('Todavía sin valoraciones')).toBeTruthy();
    expect(hideReview).toHaveBeenCalledWith('r1');
  });
});
