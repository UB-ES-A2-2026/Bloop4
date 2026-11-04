import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusPanel from '../components/StatusPanel';
import { fetchCart, removeCartItem, setCartDates, updateCartItem } from '../api/cartApi';
import { formatPrice } from '../lib/format';
import { formatDateTime, fromInputValue, toInputValue } from '../lib/dates';

function Warning({ warning, item, onFix }) {
  if (warning.code === 'UNPUBLISHED') {
    return <p className="form__error">Este producto ya no está disponible en el catálogo. Elimínalo para continuar.</p>;
  }
  if (warning.code === 'PRICE_CHANGED') {
    return (
      <p className="form__error">
        El precio ha cambiado a {formatPrice(warning.currentDailyPrice, item.currency)}/día.{' '}
        <button type="button" className="link-button" onClick={() => onFix(item.quantity)}>Aceptar el nuevo precio</button>
      </p>
    );
  }
  return (
    <p className="form__error">
      {warning.availableUnits === 0
        ? 'No quedan unidades libres en estas fechas.'
        : `Solo quedan ${warning.availableUnits} ${warning.availableUnits === 1 ? 'unidad libre' : 'unidades libres'} en estas fechas.`}{' '}
      {warning.availableUnits > 0 && (
        <button type="button" className="link-button" onClick={() => onFix(warning.availableUnits)}>
          Ajustar a {warning.availableUnits}
        </button>
      )}
    </p>
  );
}

function CartLine({ item, onChange, onRemove }) {
  const [quantity, setQuantity] = useState(item.quantity);
  useEffect(() => setQuantity(item.quantity), [item.quantity]);

  return (
    <li className={`cart-line${item.warnings?.length ? ' cart-line--warning' : ''}`}>
      <div className="cart-line__main">
        <Link to={`/productos/${item.product.id}`} className="cart-line__name">{item.product.name}</Link>
        <span className="form__hint">
          {formatPrice(item.dailyPrice, item.currency)}/día · Fianza {formatPrice(item.depositAmount, item.currency)}/ud. ·{' '}
          {item.insurance ? `Seguro: ${item.insurance}` : 'Sin seguro'}
        </span>
        {item.warnings?.map((w) => (
          <Warning key={w.code} warning={w} item={item} onFix={(q) => onChange(item, q)} />
        ))}
      </div>
      <label className="cart-line__quantity">
        <span className="form__label">Cantidad</span>
        <input
          className="form__input"
          type="number"
          min="1"
          max="500"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={() => {
            const q = Number.parseInt(quantity, 10);
            if (q >= 1 && q !== item.quantity) onChange(item, q);
            else setQuantity(item.quantity);
          }}
        />
      </label>
      <strong className="cart-line__subtotal">{formatPrice(item.rentalSubtotal, item.currency)}</strong>
      <button type="button" className="link-button" onClick={() => onRemove(item)} aria-label={`Eliminar ${item.product.name}`}>
        Eliminar
      </button>
    </li>
  );
}

/** Pàgina /reserva: la cistella agrupada per venedor amb els totals. */
export default function CartPage() {
  const [cart, setCart] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [dates, setDates] = useState({ from: '', to: '' });

  const load = () => {
    setStatus('loading');
    fetchCart()
      .then((data) => {
        setCart(data);
        setDates({
          from: data.startsAt ? toInputValue(new Date(data.startsAt)) : '',
          to: data.endsAt ? toInputValue(new Date(data.endsAt)) : '',
        });
        setStatus('success');
      })
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  };
  useEffect(load, []);

  async function run(action) {
    setError(null);
    try {
      const updated = await action();
      if (updated) setCart(updated);
      else load();
    } catch (err) {
      setError(err.details?.availableUnits !== undefined ? `${err.message}.` : err.message);
    }
  }

  if (status === 'loading' && !cart) return <div className="skeleton detail__skeleton" aria-busy="true" aria-label="Cargando la reserva" />;
  if (status === 'error' && !cart) {
    return <StatusPanel role="alert" title="No se pudo cargar tu reserva" text={error} actionLabel="Reintentar" onAction={load} />;
  }

  const empty = cart.sellers.length === 0;
  return (
    <section className="detail-page" aria-labelledby="cart-title">
      <h1 id="cart-title" className="detail__title">Mi reserva</h1>

      <form
        className="form__row cart__dates"
        onSubmit={(e) => {
          e.preventDefault();
          const from = fromInputValue(dates.from);
          const to = fromInputValue(dates.to);
          if (from && to) run(() => setCartDates({ from, to }));
        }}
      >
        <label className="form__field">
          <span className="form__label">Inicio del evento</span>
          <input className="form__input" type="datetime-local" value={dates.from} onChange={(e) => setDates((d) => ({ ...d, from: e.target.value }))} />
        </label>
        <label className="form__field">
          <span className="form__label">Fin del evento</span>
          <input className="form__input" type="datetime-local" value={dates.to} onChange={(e) => setDates((d) => ({ ...d, to: e.target.value }))} />
        </label>
        <button type="submit" className="btn-outline">Cambiar fechas</button>
      </form>
      {cart.startsAt && (
        <p className="form__hint">
          Del {formatDateTime(cart.startsAt)} al {formatDateTime(cart.endsAt)} · {cart.billableDays} {cart.billableDays === 1 ? 'día' : 'días'}
        </p>
      )}
      {error && <p className="form__error" role="alert">{error}</p>}

      {empty ? (
        <StatusPanel title="Tu reserva está vacía" text="Busca material en el catálogo y añádelo para tu evento." />
      ) : (
        <>
          {cart.sellers.map((group) => (
            <section key={group.seller.id} className="cart__seller" aria-label={group.seller.legalName}>
              <h2 className="detail__subtitle">
                {group.seller.legalName} · {group.seller.city}
              </h2>
              <ul className="cart__lines">
                {group.items.map((item) => (
                  <CartLine
                    key={item.id}
                    item={item}
                    onChange={(it, q) => run(() => updateCartItem(it.id, q))}
                    onRemove={(it) => run(async () => { await removeCartItem(it.id); return null; })}
                  />
                ))}
              </ul>
              <p className="cart__subtotal">
                Subtotal: {formatPrice(group.rentalSubtotal, cart.currency)} · Fianza: {formatPrice(group.depositSubtotal, cart.currency)}
              </p>
            </section>
          ))}

          <dl className="detail__prices cart__totals">
            <div>
              <dt>Alquiler</dt>
              <dd>{formatPrice(cart.totals.rental, cart.currency)}</dd>
            </div>
            <div>
              <dt>Fianza (se retiene, no se cobra)</dt>
              <dd>{formatPrice(cart.totals.deposit, cart.currency)}</dd>
            </div>
            <div>
              <dt>Total a pagar</dt>
              <dd className="detail__price">{formatPrice(cart.totals.toPay, cart.currency)}</dd>
            </div>
          </dl>
          {cart.canCheckout ? (
            <p className="auth-page__text" role="status">Tu reserva está lista.</p>
          ) : (
            <p className="form__error" role="status">Revisa las líneas marcadas antes de continuar.</p>
          )}
        </>
      )}
    </section>
  );
}
