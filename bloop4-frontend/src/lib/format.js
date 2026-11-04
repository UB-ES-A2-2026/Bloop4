const formatters = new Map();

/**
 * Formata un import en format es-ES: 45 € · 3,50 €. L'API l'envia com a string decimal
 * ("3.50") per no perdre precisió; aquí només es formata, mai s'hi fan càlculs.
 */
export function formatPrice(amount, currency) {
  const value = Number(amount);
  const decimals = Number.isInteger(value) ? 0 : 2;
  const key = `${currency}:${decimals}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat('es-ES', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    );
  }
  return formatters.get(key).format(value);
}
