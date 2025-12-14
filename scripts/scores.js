import { loadHighScores, clearHighScores } from './storage.js';

const tbody = document.querySelector('#scores-table tbody');
const clearBtn = document.getElementById('clear-btn');

function render() {
  const scores = loadHighScores();
  tbody.innerHTML = '';
  if (!scores.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'Пока нет результатов. Сыграй первым!';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }

  const difficultyNames = { 1: 'Легкий', 2: 'Средний', 3: 'Сложный' };
  const gameLevelNames = { 1: 'Уровень 1', 2: 'Уровень 2', 3: 'Уровень 3' };

  scores.forEach((entry, index) => {
    const tr = document.createElement('tr');
    const difficulty = difficultyNames[entry.difficultyLevel] || entry.difficultyLevel || entry.level || '-';
    const gameLevel = gameLevelNames[entry.gameLevel] || entry.gameLevel || '-';
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${entry.name}</td>
      <td>${entry.score}</td>
      <td>${difficulty}</td>
      <td>${gameLevel}</td>
      <td>${entry.date}</td>
    `;
    tbody.appendChild(tr);
  });
}

clearBtn.addEventListener('click', () => {
  if (confirm('Очистить таблицу рейтинга?')) {
    clearHighScores();
    render();
  }
});

render();

