import { formatPrice } from '../lib/format';
import { formatDateTime } from '../lib/dates';

/** Resum d'una reserva: productes per venedor, dates, lliurament i imports. */
export default function BookingSummary({ booking }) {
  const { delivery, totals, currency } = booking;
  return (
    <div className="booking__summary">
      <p className="form__hint">
        Evento del {formatDateTime(booking.startsAt)} al {formatDateTime(booking.endsAt)} · {booking.billableDays}{' '}
        {booking.billableDays === 1 ? 'día' : 'días'}
      </p>

      {booking.sellers.map((group) => (
        <section key={group.seller.id} className="cart__seller" aria-label={group.seller.legalName}>
          <h2 className="detail__subtitle">
            {group.seller.legalName} · {group.seller.city}
          </h2>
          <ul className="cart__lines">
            {group.items.map((item) => (
              <li key={item.id} className="booking__line">
                <span>
                  {item.quantity} × {item.product.name}
                </span>
                <strong>{formatPrice(item.rentalSubtotal, item.currency)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {delivery && (
        <section aria-labelledby="booking-delivery">
          <h2 id="booking-delivery" className="detail__subtitle">Entrega y recogida</h2>
          <p className="auth-page__text">
            {delivery.address.street}, {delivery.address.postalCode} {delivery.address.city}
          </p>
          <p className="form__hint">
            Entrega: {formatDateTime(delivery.deliveryWindow.startsAt)} · Recogida: {formatDateTime(delivery.pickupWindow.startsAt)}
          </p>
        </section>
      )}

      <dl className="detail__prices cart__totals">
        <div>
          <dt>Alquiler</dt>
          <dd>{formatPrice(totals.rental, currency)}</dd>
        </div>
        <div>
          <dt>Transporte</dt>
          <dd>{formatPrice(totals.transport, currency)}</dd>
        </div>
        <div>
          <dt>Fianza (se retiene, no se cobra)</dt>
          <dd>{formatPrice(totals.deposit, currency)}</dd>
        </div>
        <div>
          <dt>Total a pagar</dt>
          <dd className="detail__price">{formatPrice(totals.toPay, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}
