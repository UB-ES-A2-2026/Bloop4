import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { addCartItem, fetchCart, setCartDates } from '../api/cartApi';
import { useAuth } from '../auth/AuthContext';
import { formatDateTime } from '../lib/dates';

const sameInstant = (a, b) => a && b && new Date(a).getTime() === new Date(b).getTime();

/**
 * Botó «Añadir a la reserva» de la fitxa. Totes les línies de la cistella comparteixen les
 * dates de l'esdeveniment: si la cistella ja en té unes altres, es demana confirmació abans de
 * canviar-les (l'API revalida la disponibilitat de totes les línies).
 */
export default function AddToCart({ product, range }) {
  const { user } = useAuth();
  const location = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState({ status: 'idle', message: null, cartDates: null });

  if (!user) {
    return (
      <p className="form__hint">
        <Link to="/iniciar-sesion" state={{ from: location.pathname }}>Inicia sesión</Link> para añadir este producto a tu reserva.
      </p>
    );
  }
  if (!user.roles.includes('customer')) return null;

  async function add({ changeDates = false } = {}) {
    setState({ status: 'sending', message: null, cartDates: null });
    try {
      const cart = await fetchCart();
      if (cart.startsAt && !(sameInstant(cart.startsAt, range.from) && sameInstant(cart.endsAt, range.to)) && !changeDates) {
        setState({ status: 'confirm', message: null, cartDates: { from: cart.startsAt, to: cart.endsAt } });
        return;
      }
      if (!cart.startsAt || changeDates) await setCartDates(range);
      await addCartItem(product.id, quantity);
      setState({ status: 'added', message: null, cartDates: null });
    } catch (err) {
      setState({ status: 'error', message: err.message, cartDates: null });
    }
  }

  return (
    <div className="add-to-cart">
      <div className="form__row">
        <label className="form__field add-to-cart__quantity">
          <span className="form__label">Cantidad</span>
          <input
            className="form__input"
            type="number"
            min="1"
            max="500"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={!range || state.status === 'sending'}
          onClick={() => add()}
        >
          Añadir a la reserva
        </button>
      </div>
      {!range && <p className="form__hint">Elige las fechas del evento para añadirlo a tu reserva.</p>}
      {state.status === 'confirm' && (
        <div className="banner" role="alert">
          <p>
            Tu reserva es del {formatDateTime(state.cartDates.from)} al {formatDateTime(state.cartDates.to)}. Todos los
            productos comparten las fechas del evento.
          </p>
          <button type="button" className="link-button" onClick={() => add({ changeDates: true })}>
            Cambiar la reserva a las nuevas fechas y añadir
          </button>
        </div>
      )}
      {state.status === 'added' && (
        <p className="auth-page__text" role="status">
          Añadido a tu reserva. <Link to="/reserva">Ver la reserva</Link>
        </p>
      )}
      {state.status === 'error' && <p className="form__error" role="alert">{state.message}</p>}
    </div>
  );
}
