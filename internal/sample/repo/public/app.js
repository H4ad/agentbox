import { add, clearDone, leftLabel, remaining, toggle } from './todos.js';

const key = 'tally.todos';
let todos = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(key, JSON.stringify(todos));
}

function render() {
  const list = document.getElementById('list');
  list.replaceChildren(
    ...todos.map((todo) => {
      const item = document.createElement('li');
      item.className = todo.done ? 'done' : '';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = todo.done;
      box.addEventListener('change', () => update(toggle(todos, todo.id)));
      const text = document.createElement('span');
      text.textContent = todo.text;
      item.append(box, text);
      return item;
    }),
  );
  document.getElementById('left').textContent = leftLabel(remaining(todos));
}

function update(next) {
  todos = next;
  save();
  render();
}

document.getElementById('add').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.getElementById('text');
  update(add(todos, input.value));
  input.value = '';
});

document.getElementById('clear').addEventListener('click', () => update(clearDone(todos)));

if (todos.length === 0) {
  todos = [
    { id: 1, text: 'Try AgentBox', done: true },
    { id: 2, text: 'Give three agents a task each', done: false },
    { id: 3, text: 'Review what they made', done: false },
  ];
}
render();
