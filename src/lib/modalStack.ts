/**
 * Pila global de modales para que `Escape` cierre únicamente el modal superior
 * cuando hay varios superpuestos.
 */
const stack: symbol[] = [];

export function pushModal(token: symbol): void {
  stack.push(token);
}

export function removeModal(token: symbol): void {
  const index = stack.lastIndexOf(token);
  if (index >= 0) stack.splice(index, 1);
}

export function isTopModal(token: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === token;
}
