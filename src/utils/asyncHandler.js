/**
 * Envuelve un handler async para que cualquier rejection vaya al error middleware
 * sin tener que escribir try/catch en cada controller.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
