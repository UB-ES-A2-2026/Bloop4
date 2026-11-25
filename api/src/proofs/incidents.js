/**
 * Incidències i fiança (US-11). Una incidència s'avisa a l'administrador i al venedor; mentre n'hi
 * ha cap d'oberta, la fiança de la reserva no s'allibera. Quan totes les recollides s'han fet i no
 * en queda cap d'oberta, s'allibera: `releaseDeposit` fa saber `bookingSettled`, i el pagament
 * (US-08) allibera la retenció a la passarel·la.
 */
const TYPE = { delivery: 'entrega', pickup: 'recogida' };

export function createIncidentService({ incidentRepository, notificationRepository, releaseDeposit, logger = console }) {
  async function notify(incident) {
    try {
      const to = await incidentRepository.recipients(incident.serviceId);
      const title = `Incidencia en la ${TYPE[to.type]} de la reserva ${to.bookingNumber}`;
      const body = incident.description.slice(0, 1000);
      for (const adminId of to.adminIds) {
        await notificationRepository.create(adminId, { kind: 'incident', title, body });
      }
      if (to.sellerUserId) {
        await notificationRepository.create(to.sellerUserId, { kind: 'incident', title, body, link: '/vendedor/servicios' });
      }
    } catch (err) {
      logger.error({ err }, 'No se pudo avisar de la incidencia');
    }
  }

  /** Tanca la reserva si toca i allibera la fiança si no hi ha incidències obertes. */
  async function settle(eventId) {
    const { completed, openIncidents } = await incidentRepository.settle(eventId);
    if (completed && openIncidents === 0) {
      try {
        await releaseDeposit?.(eventId);
      } catch (err) {
        // Es tornarà a intentar quan es resolgui una altra incidència o manualment.
        logger.error({ err }, 'No se pudo liberar la fianza');
      }
    }
    return { completed, openIncidents };
  }

  return {
    settle,

    /** Després de completar un servei: incidència si el checklist té problemes, i tancament. */
    async afterCompletion({ service, problems }) {
      if (problems.length) await notify(await incidentRepository.createFromChecklist(service.id, problems));
      await settle(service.event_id);
    },

    /** El rider registra una incidència (client absent, etc.) en lloc de completar el servei. */
    async report(serviceId, riderId, details) {
      const incident = await incidentRepository.report(serviceId, riderId, details);
      await notify(incident);
      return incident;
    },

    /** Un administrador resol una incidència; si era l'última, s'allibera la fiança. */
    async resolve(incidentId, adminId, note) {
      const eventId = await incidentRepository.resolve(incidentId, adminId, note);
      return settle(eventId);
    },
  };
}
