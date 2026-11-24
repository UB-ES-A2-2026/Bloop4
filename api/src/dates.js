const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Una data 'AAAA-MM-DD' que existeix al calendari. `new Date` no garanteix que el dia existeixi (pot
 * convertir el 31/02 en el 3/03) i PostgreSQL no té l'any 0: si arribessin a la consulta,
 * respondrien 500 en lloc de 400. Per això la data ha de sortir igual després de passar per `Date`.
 */
export function isCalendarDate(raw) {
  if (typeof raw !== 'string' || !DATE.test(raw) || raw.startsWith('0000')) return false;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
}
