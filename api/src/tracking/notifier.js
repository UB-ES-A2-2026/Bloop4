/**
 * Avisa el client quan canvia l'estat d'un lliurament o d'una recollida de la seva reserva
 * (US-09). Un avís que no es pot desar no desfà el canvi d'estat.
 */
const MESSAGES = {
  delivery: {
    in_transit: (seller) => ['Tu entrega está en camino', `${seller} va hacia la dirección del evento.`],
    delivered: (seller) => ['Material entregado', `${seller} ha entregado el material de tu reserva.`],
    incident: (seller) => ['Incidencia en la entrega', `Ha habido una incidencia en la entrega de ${seller}. Te contactaremos.`],
    cancelled: (seller) => ['Entrega cancelada', `La entrega de ${seller} se ha cancelado.`],
  },
  pickup: {
    in_transit: (seller) => ['La recogida ha empezado', `${seller} va a recoger el material.`],
    delivered: (seller) => ['Material recogido', `${seller} ha recogido el material. ¡Gracias!`],
    incident: (seller) => ['Incidencia en la recogida', `Ha habido una incidencia en la recogida de ${seller}. Te contactaremos.`],
    cancelled: (seller) => ['Recogida cancelada', `La recogida de ${seller} se ha cancelado.`],
  },
};

export function createServiceNotifier({ trackingRepository, notificationRepository, logger = console }) {
  return {
    async statusChanged(serviceId) {
      try {
        const ctx = await trackingRepository.serviceContext(serviceId);
        const message = ctx && MESSAGES[ctx.type]?.[ctx.status];
        if (!message) return;
        const [title, body] = message(ctx.sellerLegalName);
        await notificationRepository.create(ctx.customerId, { kind: 'service_status', title, body, link: `/reservas/${ctx.bookingId}` });
      } catch (err) {
        logger.error({ err }, 'No se pudo crear el aviso del cambio de estado');
      }
    },
  };
}
