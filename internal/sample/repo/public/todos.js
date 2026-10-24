// The list's logic: plain functions over an array of { id, text, done },
// each returning a new array rather than changing the one it was given.

export function add(todos, text) {
  const trimmed = text.trim();
  if (!trimmed) return todos;
  return [...todos, { id: Date.now(), text: trimmed, done: false }];
}

export function toggle(todos, id) {
  return todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
}

export function clearDone(todos) {
  return todos.filter((todo) => !todo.done);
}

// remaining is how many items are still to do.
export function remaining(todos) {
  return todos.filter((todo) => todo.done).length;
}

export function leftLabel(count) {
  return `${count} items left`;
}
