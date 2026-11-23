import { Router } from 'express';
import { ApiError, validationError } from '../errors.js';
import { requireActive, requireRole } from '../auth/middleware.js';
import { PaymentDeclinedError, WebhookSignatureError } from '../payments/gateway.js';

/**
 * POST /api/payments/webhook: avisos de la passarel·la. No té sessió: l'autentica la signatura,
 * que es calcula sobre el cos tal com arriba (per això es munta abans d'express.json()).
 */
export function paymentsWebhook(paymentService) {
  return async (req, res) => {
    // Sense cos en cru no hi ha res a verificar (per exemple, una petició sense Content-Type).
    if (!Buffer.isBuffer(req.body)) throw new ApiError(400, 'INVALID_SIGNATURE', 'Firma del webhook no válida');
    try {
      const outcome = await paymentService.handleWebhook(req.body, req.headers);
      res.json({ received: true, outcome });
    } catch (err) {
      if (err instanceof WebhookSignatureError) throw new ApiError(400, 'INVALID_SIGNATURE', 'Firma del webhook no válida');
      throw err;
    }
  };
}

/**
 * POST /api/bookings/:id/payment (inicia el pagament), GET /api/bookings/:id/payment (estat) i,
 * només amb la passarel·la simulada, POST /api/payments/mock/complete (pàgina de pagament de proves).
 * `ownBooking` és dels fonaments (bookings/access.js).
 */
export function paymentsRouter({ paymentService, gateway, ownBooking }) {
  const router = Router();

  router.post('/bookings/:id/payment', requireRole('customer'), requireActive, async (req, res) => {
    const booking = await ownBooking(req);
    const payment = await paymentService.start(booking, req.user);
    res.status(201).json({ data: { status: payment.status, amount: payment.amount, currency: payment.currency, checkoutUrl: payment.checkoutUrl } });
  });

  router.get('/bookings/:id/payment', requireRole('customer'), async (req, res) => {
    const booking = await ownBooking(req);
    res.json({ data: await paymentService.status(booking.id) });
  });

  if (gateway.name === 'mock') {
    // La pàgina de proves envia la targeta de test; el servidor signa l'avís i el fa passar pel
    // mateix camí que un webhook real. Amb PAYMENT_PROVIDER=stripe aquesta ruta no existeix.
    router.post('/payments/mock/complete', requireRole('customer'), async (req, res) => {
      const { ref, cardNumber } = req.body ?? {};
      if (typeof ref !== 'string' || !ref.startsWith('mock_cs_')) throw validationError('"ref" no es una sesión de pago válida', { field: 'ref' });
      let event;
      try {
        event = gateway.buildEvent({ ref, cardNumber });
      } catch (err) {
        if (err instanceof PaymentDeclinedError) throw validationError(err.message, { field: 'cardNumber' });
        throw err;
      }
      await paymentService.handleWebhook(event.body, event.headers);
      res.json({ data: { result: event.type === 'checkout.succeeded' ? 'succeeded' : 'failed' } });
    });
  }

  return router;
}
