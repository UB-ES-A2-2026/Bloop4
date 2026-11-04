import { useState } from 'react';
import SlotPicker from './SlotPicker';
import { saveDelivery } from '../api/cartApi';

// Dia (hora de Madrid) d'un instant, en format 'AAAA-MM-DD' per a <input type="date">.
const madridDay = (value) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

/** Adreça i franges de lliurament i recollida de la cistella. `onSaved()` recarrega la cistella. */
export default function DeliveryForm({ cart, onSaved }) {
  const saved = cart.delivery;
  const [form, setForm] = useState({
    street: saved?.address.street ?? '',
    postalCode: saved?.address.postalCode ?? '',
    city: saved?.address.city ?? 'Valencia',
    accessInstructions: saved?.address.accessInstructions ?? '',
  });
  const [deliveryDate, setDeliveryDate] = useState(madridDay(cart.startsAt));
  const [pickupDate, setPickupDate] = useState(madridDay(cart.endsAt));
  const [deliveryStartsAt, setDeliveryStartsAt] = useState(saved?.valid ? saved.deliveryWindow.startsAt : null);
  const [pickupStartsAt, setPickupStartsAt] = useState(saved?.valid ? saved.pickupWindow.startsAt : null);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const change = (event) => setForm((f) => ({ ...f, [event.target.name]: event.target.value }));
  const postalCode = form.postalCode.trim();

  async function submit(event) {
    event.preventDefault();
    if (!form.street.trim() || !/^[0-9]{5}$/.test(postalCode) || !form.city.trim()) {
      return setError('Escribe la dirección, un código postal de 5 dígitos y la ciudad.');
    }
    if (!deliveryStartsAt || !pickupStartsAt) return setError('Elige una franja de entrega y una de recogida.');
    setSending(true);
    setError(null);
    try {
      await saveDelivery({ ...form, postalCode, deliveryStartsAt, pickupStartsAt });
      onSaved();
    } catch (err) {
      setError(err.details?.sellers ? `${err.message} (${err.details.sellers.join(', ')}).` : err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="form delivery" onSubmit={submit} noValidate aria-labelledby="delivery-title">
      <h2 id="delivery-title" className="detail__subtitle">Entrega y recogida</h2>
      {saved && !saved.valid && (
        <p className="form__error" role="alert">Las fechas del evento han cambiado: elige de nuevo las franjas.</p>
      )}
      <label className="form__field">
        <span className="form__label">Dirección del evento</span>
        <input className="form__input" name="street" autoComplete="street-address" value={form.street} onChange={change} maxLength={200} />
      </label>
      <div className="form__row">
        <label className="form__field">
          <span className="form__label">Código postal</span>
          <input className="form__input" name="postalCode" inputMode="numeric" autoComplete="postal-code" maxLength={5} value={form.postalCode} onChange={change} />
        </label>
        <label className="form__field">
          <span className="form__label">Ciudad</span>
          <input className="form__input" name="city" autoComplete="address-level2" value={form.city} onChange={change} />
        </label>
      </div>
      <label className="form__field">
        <span className="form__label">Instrucciones de acceso (opcional)</span>
        <textarea
          className="form__input"
          name="accessInstructions"
          rows="2"
          maxLength={500}
          placeholder="Planta, montacargas, persona de contacto en el lugar…"
          value={form.accessInstructions}
          onChange={change}
        />
      </label>

      <SlotPicker
        label="Entrega"
        postalCode={postalCode}
        date={deliveryDate}
        onDateChange={setDeliveryDate}
        value={deliveryStartsAt}
        onChange={setDeliveryStartsAt}
        allowed={(slot) => new Date(slot.endsAt) <= new Date(cart.startsAt)}
      />
      <SlotPicker
        label="Recogida"
        postalCode={postalCode}
        date={pickupDate}
        onDateChange={setPickupDate}
        value={pickupStartsAt}
        onChange={setPickupStartsAt}
        allowed={(slot) => new Date(slot.startsAt) >= new Date(cart.endsAt)}
      />
      <p className="form__hint">
        La entrega termina antes de que empiece el evento y la recogida empieza cuando termina. Se piden con al menos 24 h de antelación.
      </p>

      {error && <p className="form__error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={sending}>
        {saved ? 'Actualizar entrega' : 'Guardar entrega'}
      </button>
    </form>
  );
}
