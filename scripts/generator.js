import { generateSquare, rotateSquare, areSquaresEqual } from './game-logic.js';

// Генерирует уникальный набор квадратов с учётом поворотов
export function generateUniqueSquaresSet(count, size, colorsCount) {
  const squares = [];

  const isUnique = (candidate) =>
    squares.every((sq) => !areSquaresEqual(candidate, sq));

  while (squares.length < count) {
    const sq = generateSquare(size, colorsCount);
    if (isUnique(sq)) squares.push(sq);
  }

  const correctIndex = Math.floor(Math.random() * squares.length);
  const correctSquare = squares[correctIndex];

  // Случайный поворот образца
  const turns = Math.floor(Math.random() * 4);
  let target = correctSquare;
  for (let i = 0; i < turns; i++) target = rotateSquare(target);

  return { squares, correctIndex, target };
}

export function renderMatrix(container, matrix) {
  const size = matrix.length;
  container.innerHTML = '';
  container.style.setProperty('grid-template-columns', `repeat(${size}, 1fr)`);
  matrix.forEach((row) => {
    row.forEach((color) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.background = color;
      container.appendChild(cell);
    });
  });
}
