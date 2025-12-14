// Базовые константы уровней и палитры
export const COLOR_PALETTES = {
  2: ['#af11e9ff', '#fa9cedff'],
  3: ['#af11e9ff', '#fa9cedff', '#837ffdff'],
  4: ['#af11e9ff', '#fa9cedff', '#837ffdff', '#abcaf8ff']
};

// Конфигурация уровней сложности (определяет размер квадратов)
export const DIFFICULTY_CONFIG = {
  1: {
    name: 'Легкий',
    sizes: [3, 4],
    baseColors: 2,
    baseTime: 30
  },
  2: {
    name: 'Средний',
    sizes: [4, 5],
    baseColors: 3,
    baseTime: 30
  },
  3: {
    name: 'Сложный',
    sizes: [5, 6],
    baseColors: 4,
    baseTime: 30
  }
};

// Конфигурация уровней игры (определяет задачи и модификаторы)
export const GAME_LEVEL_CONFIG = {
  1: {
    name: 'Уровень 1',
    description: 'Задача: кликнуть по нужному квадрату',
    task: 'click', // Тип задачи: click, drag, delete
    questions: 6,
    progression: [8, 10, 8, 10, 8, 10], // Количество квадратов для каждого вопроса
    modifiers: [null, null, 'blink', 'blink', 'rotate', 'rotate'] // Модификаторы для каждого вопроса
  },
  2: {
    name: 'Уровень 2',
    description: 'Задача: перетащить квадрат в контейнер под образцом и клавишами лево-право (поворот 90°) повернуть его именно так, как расположен образец',
    task: 'drag', // Тип задачи: drag & drop с поворотом
    questions: 6,
    progression: [8, 10, 8, 10, 8, 10],
    modifiers: [null, null, 'blink', 'blink', 'rotate', 'rotate']
  },
  3: {
    name: 'Уровень 3',
    description: 'Задача: двойным кликом удалять ненужные квадраты пока не останется верный',
    task: 'delete', // Тип задачи: двойной клик для удаления
    questions: 6,
    progression: [8, 10, 8, 10, 8, 10],
    modifiers: [null, null, 'blink', 'blink', 'rotate', 'rotate']
  }
};

// Случайный элемент
export const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Создание квадрата N x N с colorsCount цветами
export function generateSquare(size, colorsCount) {
  const palette = COLOR_PALETTES[colorsCount] || COLOR_PALETTES[2];
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => sample(palette))
  );
}

// Поворот на 90 градусов по часовой
export function rotateSquare(square) {
  const n = square.length;
  const res = Array.from({ length: n }, () => Array(n).fill(null));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      res[j][n - 1 - i] = square[i][j];
    }
  }
  return res;
}

// Сравнение квадратов с учётом всех поворотов
export function areSquaresEqual(sq1, sq2) {
  const rotations = [];
  let rotated = sq1;
  for (let i = 0; i < 4; i++) {
    rotations.push(rotated);
    rotated = rotateSquare(rotated);
  }
  const same = (a, b) =>
    a.every((row, i) => row.every((cell, j) => cell === b[i][j]));
  return rotations.some((variant) => same(variant, sq2));
}

// Подсчёт очков за вопрос
export function calculateScore(difficultyLevel, gameLevel, questionIndex, squaresCount, timeLeft, modifier) {
  const diffConfig = DIFFICULTY_CONFIG[difficultyLevel];
  const gameConfig = GAME_LEVEL_CONFIG[gameLevel];

  const levelMultipliers = { 1: 1.0, 2: 1.5, 3: 2.0 };
  let base = Math.floor(
    (difficultyLevel * 150 * levelMultipliers[difficultyLevel]) +
    (squaresCount * 8) +
    (diffConfig.baseColors * 20) +
    (gameLevel * 50) // Бонус за уровень игры
  );

  const modMult = {
    null: 1.0,
    blink: 1.5,
    rotate: 1.8
  };

  const speedMult = { 1: 2, 2: 4, 3: 6 };
  const speedBonus = timeLeft * speedMult[difficultyLevel];

  const total = Math.floor((base + speedBonus) * modMult[modifier || 'null']);

  return { base, speedBonus, modifier: modMult[modifier || 'null'], total };
}

