function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function transformKeys(obj, fn) {
  if (Array.isArray(obj)) return obj.map(item => transformKeys(item, fn));
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [fn(key), value])
    );
  }
  return obj;
}

function toCamelCase(obj) { return transformKeys(obj, snakeToCamel); }
function toSnakeCase(obj) { return transformKeys(obj, camelToSnake); }

module.exports = { toCamelCase, toSnakeCase };
