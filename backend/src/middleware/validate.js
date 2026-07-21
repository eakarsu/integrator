const { HttpError } = require('../errors');

function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', result.error.flatten()));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
