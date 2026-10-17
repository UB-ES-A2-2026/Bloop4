/** Error amb codi HTTP i un codi llegible per màquina per al cos de la resposta. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (message, details) =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);

// Totes les respostes d'error tenen la forma { error: { code, message, details? } }.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` } });
}

export function errorHandler(logger) {
  // Express reconeix el gestor d'errors perquè declara 4 arguments.
  return (err, req, res, next) => {
    if (err instanceof ApiError) {
      const body = { code: err.code, message: err.message };
      if (err.details !== undefined) body.details = err.details;
      return res.status(err.status).json({ error: body });
    }
    logger.error({ err, method: req.method, path: req.originalUrl }, 'Error no controlado');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
  };
}
