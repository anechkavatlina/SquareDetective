import { renderMatrix } from './generator.js';
import { GameEngine } from './game-engine.js';
import { Modifiers } from './modifiers.js';
import { saveHighScore } from './storage.js';
import { GAME_LEVEL_CONFIG, rotateSquare } from './game-logic.js';

const getPlayer = () => {
  const raw = sessionStorage.getItem('squareDetectivePlayer');
  return raw ? JSON.parse(raw) : null;
};

const player = getPlayer();
if (!player) {
  window.location.href = '../index.html';
}

const ui = {
  name: document.getElementById('ui-player'),
  level: document.getElementById('ui-level'),
  question: document.getElementById('ui-question'),
  score: document.getElementById('ui-score'),
  timer: document.getElementById('ui-timer'),
  progress: document.getElementById('ui-progress'),
  mod: document.getElementById('ui-mod'),
  size: document.getElementById('ui-size')
};

const targetEl = document.getElementById('target');
const boardEl = document.getElementById('game-board');
const hintBtn = document.getElementById('hint-btn');
const finishBtn = document.getElementById('finish-btn');

const instructionModal = document.getElementById('instruction-modal');
const instructionTitle = document.getElementById('instruction-title');
const instructionText = document.getElementById('instruction-text');
const instructionDetails = document.getElementById('instruction-details');
const instructionStart = document.getElementById('instruction-start');

const resultModal = document.getElementById('result-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalTotal = document.getElementById('modal-total');
const modalNext = document.getElementById('modal-next');

let currentSquares = [];
let activeModifier = 'none';
let gameEnded = false;
let savedScore = false;
let lastSavedRank = null;

const engine = new GameEngine({
  playerName: player?.name,
  difficultyLevel: player?.level || 1,
  ui,
  callbacks: {
    onShowInstruction: showInstruction,
    onRenderBoard: renderBoard,
    onQuestionResult: handleQuestionResult,
    onGameEnd: handleGameEnd,
    onWrongAnswer: handleWrongAnswer
  }
});

function showInstruction({ gameLevel, name, description, task }) {
  if (!instructionTitle || !instructionText || !instructionDetails) {
    console.error('Instruction elements not found');
    return;
  }
  
  instructionTitle.textContent = name || 'Инструкция';
  instructionText.textContent = description || '';
  
  const taskDetails = {
    click: 'Кликните по квадрату, который совпадает с образцом.',
    drag: 'Перетащите квадрат в контейнер под образцом. Используйте клавиши ← и → для поворота на 90°.',
    delete: 'Двойным кликом удаляйте неправильные квадраты, пока не останется верный.'
  };
  
  instructionDetails.innerHTML = `
    <div class="instruction-info">
      <p><strong>Заданий в уровне:</strong> 6</p>
      <p><strong>Задача:</strong> ${taskDetails[task] || 'Выберите правильный квадрат'}</p>
      <p><strong>Вопросы 1-2:</strong> статичные квадраты</p>
      <p><strong>Вопросы 3-4:</strong> мигающие квадраты</p>
      <p><strong>Вопросы 5-6:</strong> вращающиеся квадраты</p>
    </div>
  `;
  
  if (instructionModal) {
    instructionModal.classList.remove('hidden');
  }
}

if (instructionStart) {
  instructionStart.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (instructionModal) {
      instructionModal.classList.add('hidden');
    }
    if (engine && typeof engine.startGameLevel === 'function') {
      engine.startGameLevel();
    }
  });
}

let draggedSquare = null;
let droppedSquareRotation = 0;
let droppedSquareIndex = null;

function renderBoard({ squares, target, size, mod, task }) {
  cleanupModifier();
  hintBtn.disabled = false;
  
  // Сброс состояния drag&drop
  draggedSquare = null;
  droppedSquareRotation = 0;
  droppedSquareIndex = null;
  currentRotation = 0;

  renderMatrix(targetEl, target);

  // Показываем/скрываем контейнер для drag&drop в зависимости от задачи
  const dragContainer = document.getElementById('drag-target-container');
  const ruleText = document.getElementById('rule-text');
  
  if (task === 'drag') {
    // Показываем контейнер только на уровне 2
    if (dragContainer) {
      dragContainer.classList.remove('hidden');
      dragContainer.style.display = 'flex';
      // Переинициализируем обработчики drag&drop
      if (typeof initDragAndDrop === 'function') {
        initDragAndDrop();
      }
    }
    if (ruleText) {
      ruleText.textContent = 'Перетащите квадрат в контейнер и поверните его клавишами ← →';
    }
    ensureCheckButton();
    if (checkBtn) checkBtn.style.display = 'block';
  } else {
    // Скрываем контейнер на уровнях 1 и 3
    if (dragContainer) {
      dragContainer.classList.add('hidden');
      dragContainer.style.display = 'none';
    }
    if (checkBtn) checkBtn.style.display = 'none';
    if (ruleText) {
      if (task === 'click') {
        ruleText.textContent = 'Кликните по квадрату, который совпадает с образцом';
      } else if (task === 'delete') {
        ruleText.textContent = 'Двойным кликом удаляйте неправильные квадраты';
      } else {
        ruleText.textContent = 'Найди квадрат, совпадающий с образцом даже после поворотов';
      }
    }
  }

  // Очищаем контейнер для перетащенного квадрата
  const droppedWrapper = document.getElementById('dropped-square-wrapper');
  droppedWrapper.innerHTML = '';

  boardEl.innerHTML = '';
  boardEl.className = 'board';
  
  // Для вращения используем абсолютное позиционирование со случайными координатами
  if (mod === 'rotate') {
    boardEl.style.position = 'relative';
    boardEl.style.display = 'block';
    
    // Получаем точные размеры для вычисления доступной высоты
    const panelBoard = boardEl.closest('.panel--board');
    const panelHead = panelBoard?.querySelector('.panel__head');
    
    // Ждем рендеринга для получения точных размеров
    requestAnimationFrame(() => {
      const viewportHeight = window.innerHeight;
      const topbar = document.querySelector('.topbar');
      const topbarHeight = topbar ? topbar.offsetHeight + 16 : 80; // высота topbar + отступы
      const panelHeadHeight = panelHead ? panelHead.offsetHeight + 8 : 50; // высота заголовка + gap
      const gameLayoutGap = 10; // gap между панелями
      const pagePadding = 24; // padding страницы (12px * 2)
      
      // Вычисляем доступную высоту для игрового поля
      const availableHeight = viewportHeight - topbarHeight - panelHeadHeight - gameLayoutGap - pagePadding;
      
      // Устанавливаем фиксированную высоту контейнера (не больше доступной)
      const squareSize = 160;
      const padding = 15;
      const containerHeight = Math.max(400, Math.min(availableHeight - 20, 600)); // Минимум 400px, максимум 600px или доступная высота
      
      boardEl.style.height = `${containerHeight}px`;
      boardEl.style.minHeight = `${containerHeight}px`;
      boardEl.style.maxHeight = `${containerHeight}px`;
      boardEl.style.width = '100%';
      boardEl.style.overflow = 'hidden'; // Скрываем содержимое за границами
      
      // Добавляем визуальные границы для обозначения области
      boardEl.style.border = '2px solid rgba(123, 109, 255, 0.5)';
      boardEl.style.borderRadius = '8px';
      boardEl.style.backgroundColor = 'rgba(249, 250, 251, 0.3)';
    });
  } else {
    // Убираем границы для других режимов
    boardEl.style.border = '';
    boardEl.style.borderRadius = '';
    boardEl.style.backgroundColor = '';
    boardEl.style.display = 'grid';
    boardEl.style.position = '';
    const cols = Math.max(5, Math.ceil(Math.sqrt(squares.length)) + 1);
    boardEl.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    boardEl.style.gridAutoRows = 'auto';
    boardEl.style.gap = '10px';
  }
  
  currentSquares = [];
  
  // Сбрасываем инициализацию ячеек при новом рендеринге
  if (boardEl.dataset.cellsInitialized) {
    delete boardEl.dataset.cellsInitialized;
    delete boardEl.dataset.availableCells;
    delete boardEl.dataset.cellIndex;
  }

  squares.forEach((matrix, idx) => {
    const btn = document.createElement('button');
    btn.className = 'square';
    btn.dataset.index = idx;
    btn.dataset.matrix = JSON.stringify(matrix); // Сохраняем матрицу для drag&drop
    
    // Для вращения устанавливаем абсолютное позиционирование со случайными координатами
    if (mod === 'rotate') {
      btn.style.position = 'absolute';
      // Увеличенный размер квадрата для вращения
      const squareSize = 160;
      btn.style.width = `${squareSize}px`;
      btn.style.height = `${squareSize}px`;
      
      // Используем setTimeout для получения размеров после рендеринга
      setTimeout(() => {
        // Получаем реальные размеры контейнера
        const boardWidth = boardEl.clientWidth || boardEl.offsetWidth || 800;
        const boardHeight = boardEl.clientHeight || boardEl.offsetHeight || 600;
        
        // Учитываем padding контейнера (8px с каждой стороны)
        const containerPadding = 8;
        const usableWidth = boardWidth - containerPadding * 2;
        const usableHeight = boardHeight - containerPadding * 2;
        
        // Вычисляем размер сетки на основе количества квадратов
        const totalSquares = squares.length;
        // Для 8 квадратов: 4x2, для 10: 5x2
        let cols, rows;
        if (totalSquares === 8) {
          cols = 4;
          rows = 2;
        } else if (totalSquares === 10) {
          cols = 5;
          rows = 2;
        } else {
          // Для других количеств вычисляем оптимальную сетку
          cols = Math.ceil(Math.sqrt(totalSquares));
          rows = Math.ceil(totalSquares / cols);
        }
        
        // Вычисляем размер каждой ячейки
        const cellWidth = usableWidth / cols;
        const cellHeight = usableHeight / rows;
        
        // Создаем массив доступных ячеек (если еще не создан)
        if (!boardEl.dataset.cellsInitialized) {
          const availableCells = [];
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              availableCells.push({ row, col });
            }
          }
          // Перемешиваем ячейки для случайного распределения
          for (let i = availableCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
          }
          boardEl.dataset.availableCells = JSON.stringify(availableCells);
          boardEl.dataset.cellsInitialized = 'true';
          boardEl.dataset.cellIndex = '0';
        }
        
        // Получаем следующую доступную ячейку
        const availableCells = JSON.parse(boardEl.dataset.availableCells);
        const cellIndex = parseInt(boardEl.dataset.cellIndex) || 0;
        const cell = availableCells[cellIndex];
        boardEl.dataset.cellIndex = (cellIndex + 1).toString();
        
        // Вычисляем границы ячейки
        const cellLeft = containerPadding + cell.col * cellWidth;
        const cellTop = containerPadding + cell.row * cellHeight;
        const cellRight = cellLeft + cellWidth;
        const cellBottom = cellTop + cellHeight;
        
        // Генерируем случайные координаты внутри ячейки
        // Учитываем размер квадрата, чтобы он не выходил за границы ячейки
        const padding = 5; // Небольшой отступ от краев ячейки
        const maxX = cellRight - squareSize - padding;
        const maxY = cellBottom - squareSize - padding;
        
        // Генерируем случайную позицию внутри ячейки
        const randomX = Math.max(cellLeft + padding, Math.min(
          cellLeft + padding + Math.random() * (maxX - cellLeft - padding),
          maxX
        ));
        const randomY = Math.max(cellTop + padding, Math.min(
          cellTop + padding + Math.random() * (maxY - cellTop - padding),
          maxY
        ));
        
        btn.style.left = `${randomX}px`;
        btn.style.top = `${randomY}px`;
      }, 50); // Увеличиваем задержку для гарантии рендеринга
    }
    
    const grid = document.createElement('div');
    grid.className = 'square__grid';
    grid.style.setProperty('grid-template-columns', `repeat(${size}, 1fr)`);

    matrix.forEach((row) => row.forEach((color) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.background = color;
      grid.appendChild(cell);
    }));

    btn.appendChild(grid);
    
    // Обработка в зависимости от типа задачи
    if (task === 'click') {
      // Уровень 1: простой клик
      btn.addEventListener('click', () => engine.handleAnswer(idx));
    } else if (task === 'drag') {
      // Уровень 2: drag & drop
      btn.draggable = true;
      btn.classList.add('draggable-square');
      btn.addEventListener('dragstart', (e) => {
        draggedSquare = { index: idx, matrix };
        e.dataTransfer.effectAllowed = 'move';
        btn.classList.add('dragging');
      });
      btn.addEventListener('dragend', () => {
        btn.classList.remove('dragging');
      });
      // При drag&drop клик не используется для проверки
    } else if (task === 'delete') {
      // Уровень 3: двойной клик для удаления
      let clickTimeout = null;
      btn.addEventListener('click', () => {
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          // Двойной клик
          
          // Проверяем, является ли это правильным квадратом
          if (idx === engine.current.correctIndex) {
            // Игра завершается с ошибкой
            setTimeout(() => {
              engine.callbacks.onWrongAnswer('Вы удалили нужный квадрат');
            }, 100);
            return;
          }
          
          // Удаляем неправильный квадрат (скрываем, но не удаляем из DOM, чтобы не смещались остальные)
          btn.style.opacity = '0';
          btn.style.visibility = 'hidden';
          btn.style.pointerEvents = 'none';
          btn.dataset.deleted = 'true';
          
          // Проверяем, остался ли только правильный квадрат
          const visibleSquares = currentSquares.filter(sq => sq.dataset.deleted !== 'true');
          if (visibleSquares.length === 1) {
            const remainingSquare = visibleSquares[0];
            if (remainingSquare && remainingSquare.dataset.index == engine.current.correctIndex) {
              setTimeout(() => {
                engine.handleAnswer(engine.current.correctIndex);
              }, 100);
            }
          }
          
          clickTimeout = null;
        } else {
          clickTimeout = setTimeout(() => {
            clickTimeout = null;
          }, 300);
        }
      });
    }
    
    // Обработка наведения (hover)
    btn.addEventListener('mouseenter', () => {
      if (!engine.locked) {
        btn.classList.add('hover');
      }
    });
    btn.addEventListener('mouseleave', () => {
      btn.classList.remove('hover');
    });
    
    boardEl.appendChild(btn);
    currentSquares.push(btn);
  });

  applyModifier(mod, task);
}


function applyModifier(mod, task) {
  activeModifier = mod || 'none';
  if (Modifiers[activeModifier]) {
    Modifiers[activeModifier].init(currentSquares, boardEl, task);
  }
}

function cleanupModifier() {
  if (Modifiers[activeModifier] && Modifiers[activeModifier].cleanup) {
    Modifiers[activeModifier].cleanup(currentSquares, boardEl);
  }
  activeModifier = 'none';
}

function handleQuestionResult(result) {
  hintBtn.disabled = true;

  const { correct, chosen } = result;
  
  // Визуальная обратная связь без модального окна
  currentSquares.forEach((el, idx) => {
    el.classList.remove('correct', 'wrong');
    if (idx === (engine.current?.correctIndex ?? -1)) {
      el.classList.add('correct');
    }
    if (!correct && el.dataset.index == chosen) {
      el.classList.add('wrong');
    }
  });
}

function handleWrongAnswer(message = 'Неправильно. Попробуй еще раз') {
  cleanupModifier();
  modalTitle.textContent = message.includes('Время') ? 'Время истекло' : 'Неправильно';
  modalText.textContent = message;
  modalTotal.textContent = '';
  modalNext.textContent = 'В меню';
  resultModal.classList.remove('hidden');
}

function handleGameEnd(summary) {
  if (gameEnded) return;
  gameEnded = true;
  cleanupModifier();
  
  modalTitle.textContent = 'Игра завершена';
  modalTotal.textContent = summary.score;
  modalNext.textContent = 'К таблице рейтинга';

  if (!savedScore) {
    const { list, id } = saveHighScore({
      name: summary.playerName,
      score: summary.score,
      difficultyLevel: summary.difficultyLevel,
      gameLevel: summary.gameLevel,
      date: new Date().toLocaleDateString()
    });
    const rank = list.findIndex((e) => e.id === id);
    lastSavedRank = rank >= 0 ? rank + 1 : null;
    savedScore = true;
  }

  const rankText = lastSavedRank ? `Место в топ-10: #${lastSavedRank}` : 'Вне топ-10';
  modalText.textContent = `Итоговые очки: ${summary.score}. ${rankText}`;

  resultModal.classList.remove('hidden');
}

modalNext.addEventListener('click', () => {
  resultModal.classList.add('hidden');
  if (gameEnded) {
    window.location.href = '../pages/scores.html';
  } else {
    window.location.href = '../index.html';
  }
});

hintBtn.addEventListener('click', () => {
  const hint = engine.useHint();
  if (!hint) return;
  hintBtn.disabled = true;
  const wrong = currentSquares.filter((el, idx) => idx !== engine.current.correctIndex);
  wrong.sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.floor(wrong.length / 3)))
    .forEach((el) => el.classList.add('disabled'));
});

finishBtn.addEventListener('click', () => engine.finishGame());

// Обработчики для drag&drop (уровень 2)
const dragTargetArea = document.getElementById('drag-target-container');
const droppedSquareWrapper = document.getElementById('dropped-square-wrapper');

// Инициализация обработчиков drag&drop
function initDragAndDrop() {
  if (!dragTargetArea || !droppedSquareWrapper) return;
  
  // Удаляем старые обработчики, если они есть, и добавляем новые
  dragTargetArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    dragTargetArea.classList.add('drag-over');
  });

  dragTargetArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = dragTargetArea.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    // Проверяем, что мы действительно покинули область
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dragTargetArea.classList.remove('drag-over');
    }
  });

  dragTargetArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragTargetArea.classList.remove('drag-over');
    
    if (draggedSquare) {
      droppedSquareIndex = draggedSquare.index;
      droppedSquareRotation = 0;
      currentRotation = 0;
      
      // Создаем квадрат в контейнере
      droppedSquareWrapper.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'dropped-square';
      wrapper.style.transform = `rotate(0deg)`;
      wrapper.style.transformOrigin = 'center';
      
      const grid = document.createElement('div');
      grid.className = 'square__grid';
      const size = engine.current?.size || 3;
      grid.style.setProperty('grid-template-columns', `repeat(${size}, 1fr)`);
      grid.style.width = '100px';
      grid.style.height = '100px';
      
      draggedSquare.matrix.forEach((row) => row.forEach((color) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.background = color;
        grid.appendChild(cell);
      }));
      
      wrapper.appendChild(grid);
      wrapper.dataset.matrix = JSON.stringify(draggedSquare.matrix);
      droppedSquareWrapper.appendChild(wrapper);
    }
  });
}

// Инициализируем при загрузке
if (dragTargetArea && droppedSquareWrapper) {
  initDragAndDrop();
}

// Обработка поворота клавишами
let currentRotation = 0;
const rotateDroppedSquare = (direction) => {
  if (!droppedSquareWrapper || !droppedSquareWrapper.firstChild) return;
  
  currentRotation = (currentRotation + (direction === 'left' ? -90 : 90)) % 360;
  if (currentRotation < 0) currentRotation += 360;
  
  const square = droppedSquareWrapper.firstChild;
  square.style.transform = `rotate(${currentRotation}deg)`;
  droppedSquareRotation = currentRotation;
};

// Обработка клавиш стрелок
document.addEventListener('keydown', (e) => {
  if (engine.current?.task === 'drag' && droppedSquareWrapper.firstChild) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      rotateDroppedSquare('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      rotateDroppedSquare('right');
    }
  }
});

// Функция проверки перетащенного и повернутого квадрата
function checkDroppedSquare() {
  if (droppedSquareIndex === null || !engine.current || !droppedSquareWrapper.firstChild) return;
  
  const { target, correctIndex } = engine.current;
  const droppedMatrix = JSON.parse(droppedSquareWrapper.firstChild.dataset.matrix);
  
  // Поворачиваем матрицу в соответствии с углом поворота
  let rotatedMatrix = droppedMatrix;
  const rotations = Math.floor(droppedSquareRotation / 90) % 4;
  
  for (let i = 0; i < rotations; i++) {
    rotatedMatrix = rotateSquare(rotatedMatrix);
  }
  
  // Проверяем совпадение с образцом
  const matches = areMatricesEqual(rotatedMatrix, target);
  
  if (matches && droppedSquareIndex === correctIndex) {
    engine.handleAnswer(correctIndex);
  } else {
    engine.handleAnswer(-1); // Неправильный ответ
  }
}

// Вспомогательная функция для сравнения матриц
function areMatricesEqual(m1, m2) {
  if (m1.length !== m2.length) return false;
  return m1.every((row, i) => 
    row.every((cell, j) => cell === m2[i][j])
  );
}

// Кнопка для проверки после поворота (создаем один раз)
let checkBtn = null;
function ensureCheckButton() {
  if (!checkBtn && dragTargetArea) {
    checkBtn = document.createElement('button');
    checkBtn.textContent = 'Проверить';
    checkBtn.className = 'btn';
    checkBtn.style.marginTop = '8px';
    checkBtn.style.width = '100%';
    checkBtn.addEventListener('click', checkDroppedSquare);
    dragTargetArea.appendChild(checkBtn);
  }
}

// Панель разработчика
const devToggle = document.getElementById('dev-toggle');
const devPanel = document.getElementById('dev-panel');

devToggle.addEventListener('click', () => {
  devPanel.classList.toggle('visible');
});

document.getElementById('dev-level-1').addEventListener('click', () => {
  engine.gameLevel = 1;
  engine.questionIndex = 1;
  engine.showInstruction();
  devPanel.classList.remove('visible');
});

document.getElementById('dev-level-2').addEventListener('click', () => {
  engine.gameLevel = 2;
  engine.questionIndex = 1;
  engine.showInstruction();
  devPanel.classList.remove('visible');
});

document.getElementById('dev-level-3').addEventListener('click', () => {
  engine.gameLevel = 3;
  engine.questionIndex = 1;
  engine.showInstruction();
  devPanel.classList.remove('visible');
});


document.getElementById('dev-reset').addEventListener('click', () => {
  engine.score = 0;
  engine.gameLevel = 1;
  engine.questionIndex = 1;
  engine.ui.score.textContent = 0;
  engine.showInstruction();
  devPanel.classList.remove('visible');
});

// Убеждаемся, что DOM загружен перед инициализацией
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    engine.start();
  });
} else {
  engine.start();
}
