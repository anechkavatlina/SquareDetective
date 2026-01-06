export const COLOR_PALETTES = {
  2: ['#af11e9ff', '#fa9cedff'],
  3: ['#af11e9ff', '#fa9cedff', '#837ffdff'],
  4: ['#af11e9ff', '#fa9cedff', '#837ffdff', '#abcaf8ff']
};

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
    sizes: [4, 5],
    baseColors: 4,
    baseTime: 30
  }
};

export const GAME_LEVEL_CONFIG = {
  1: {
    name: 'Уровень 1',
    description: 'Задача: кликнуть по нужному квадрату',
    task: 'click',
    questions: 6,
    progression: [8, 10, 8, 10, 8, 10],
    modifiers: [null, null, 'blink', 'blink', 'rotate', 'rotate']
  },
  2: {
    name: 'Уровень 2',
    description: 'Задача: перетащить квадрат в контейнер под образцом и клавишами лево-право (поворот 90°) повернуть его именно так, как расположен образец',
    task: 'drag',
    questions: 6,
    progression: [8, 10, 8, 10, 8, 10],
    modifiers: [null, null, 'blink', 'blink', 'rotate', 'rotate']
  },
  3: {
    name: 'Уровень 3',
    description: 'Задача: двойным кликом удалять ненужные квадраты пока не останется верный',
    task: 'delete',
    questions: 6,
    progression: [8, 10, 8, 10, 8, 10],
    modifiers: [null, null, 'blink', 'blink', 'rotate', 'rotate']
  }
};

export const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function generateSquare(size, colorsCount) {
  const palette = COLOR_PALETTES[colorsCount] || COLOR_PALETTES[2];
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => sample(palette))
  );
}

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

export function calculateScore(difficultyLevel, gameLevel, questionIndex, squaresCount, timeLeft, modifier) {
  const diffConfig = DIFFICULTY_CONFIG[difficultyLevel];
  const gameConfig = GAME_LEVEL_CONFIG[gameLevel];

  const levelMultipliers = { 1: 1.0, 2: 1.5, 3: 2.0 };
  let base = Math.floor(
    (difficultyLevel * 150 * levelMultipliers[difficultyLevel]) +
    (squaresCount * 8) +
    (diffConfig.baseColors * 20) +
    (gameLevel * 50)
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
