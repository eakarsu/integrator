function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function transformKeys(obj, fn, opaqueKeys = new Set()) {
  if (Array.isArray(obj)) return obj.map(item => transformKeys(item, fn, opaqueKeys));
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        fn(key),
        opaqueKeys.has(key) ? value : transformKeys(value, fn, opaqueKeys),
      ])
    );
  }
  return obj;
}

function toCamelCase(obj) {
  return transformKeys(obj, snakeToCamel, new Set(['input', 'output', 'details', 'error']));
}
function toSnakeCase(obj) {
  return transformKeys(obj, camelToSnake, new Set(['input']));
}

module.exports = { toCamelCase, toSnakeCase };
