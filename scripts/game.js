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
    delete: 'Двойным кликом удаляйте неправильные квадраты, пока не останется верный. Квадраты расположены рандомно, их можно перемещать по полю, используя мышку.'
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

function createParticle(x, y, type) {
  const particle = document.createElement('particle');
  document.body.appendChild(particle);
  
  let width = Math.floor(Math.random() * 30 + 8);
  let height = width;
  let destinationX = (Math.random() - 0.5) * 300;
  let destinationY = (Math.random() - 0.5) * 300;
  let rotation = Math.random() * 520;
  let delay = Math.random() * 200;
  
  switch (type) {
    case 'square':
      particle.style.background = `hsl(${Math.random() * 60 + 260}, 70%, 60%)`;
      particle.style.border = '1px solid white';
      break;
  }
  
  particle.style.width = `${width}px`;
  particle.style.height = `${height}px`;
  
  const animation = particle.animate([
    {
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(0deg)`,
      opacity: 1
    },
    {
      transform: `translate(-50%, -50%) translate(${x + destinationX}px, ${y + destinationY}px) rotate(${rotation}deg)`,
      opacity: 0
    }
  ], {
    duration: Math.random() * 1000 + 5000,
    easing: 'cubic-bezier(0, .9, .57, 1)',
    delay: delay
  });
  
  animation.onfinish = () => {
    particle.remove();
  };
}

function renderBoard({ squares, target, size, mod, task }) {
  cleanupModifier();
  hintBtn.disabled = false;
  
  draggedSquare = null;
  droppedSquareRotation = 0;
  droppedSquareIndex = null;
  currentRotation = 0;

  renderMatrix(targetEl, target);

  const dragContainer = document.getElementById('drag-target-container');
  const ruleText = document.getElementById('rule-text');
  
  if (task === 'drag') {
    if (dragContainer) {
      dragContainer.classList.remove('hidden');
      dragContainer.style.display = 'flex';
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

  const droppedWrapper = document.getElementById('dropped-square-wrapper');
  droppedWrapper.innerHTML = '';

  boardEl.innerHTML = '';
  boardEl.className = 'board';
  
  if (mod === 'rotate' || task === 'delete') {
    boardEl.style.position = 'relative';
    boardEl.style.display = 'block';
    
    const panelBoard = boardEl.closest('.panel--board');
    const panelHead = panelBoard?.querySelector('.panel__head');
    
    requestAnimationFrame(() => {
      const viewportHeight = window.innerHeight;
      const topbar = document.querySelector('.topbar');
      const topbarHeight = topbar ? topbar.offsetHeight + 16 : 80;
      const panelHeadHeight = panelHead ? panelHead.offsetHeight + 8 : 50;
      const gameLayoutGap = 10;
      const pagePadding = 24;
      
      const availableHeight = viewportHeight - topbarHeight - panelHeadHeight - gameLayoutGap - pagePadding;
      
      const squareSize = task === 'delete' ? 140 : 160;
      const padding = 15;
      const containerHeight = Math.max(400, Math.min(availableHeight - 20, 600));
      
      boardEl.style.height = `${containerHeight}px`;
      boardEl.style.minHeight = `${containerHeight}px`;
      boardEl.style.maxHeight = `${containerHeight}px`;
      boardEl.style.width = '100%';
      boardEl.style.overflow = 'hidden';
      
      boardEl.style.border = '2px solid rgba(123, 109, 255, 0.5)';
      boardEl.style.borderRadius = '8px';
      boardEl.style.backgroundColor = 'rgba(249, 250, 251, 0.3)';
    });
  } else {
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
  
  if (boardEl.dataset.cellsInitialized) {
    delete boardEl.dataset.cellsInitialized;
    delete boardEl.dataset.availableCells;
    delete boardEl.dataset.cellIndex;
  }

  squares.forEach((matrix, idx) => {
    const btn = document.createElement('button');
    btn.className = 'square';
    btn.dataset.index = idx;
    btn.dataset.matrix = JSON.stringify(matrix);
    
    if (mod === 'rotate' && task !== 'delete') {
      btn.style.position = 'absolute';
      const squareSize = 160;
      btn.style.width = `${squareSize}px`;
      btn.style.height = `${squareSize}px`;
      
      setTimeout(() => {
        const boardWidth = boardEl.clientWidth || boardEl.offsetWidth || 800;
        const boardHeight = boardEl.clientHeight || boardEl.offsetHeight || 600;
        
        const containerPadding = 8;
        const usableWidth = boardWidth - containerPadding * 2;
        const usableHeight = boardHeight - containerPadding * 2;
        
        const totalSquares = squares.length;
        let cols, rows;
        if (totalSquares === 8) {
          cols = 4;
          rows = 2;
        } else if (totalSquares === 10) {
          cols = 5;
          rows = 2;
        } else {
          cols = Math.ceil(Math.sqrt(totalSquares));
          rows = Math.ceil(totalSquares / cols);
        }
        
        const cellWidth = usableWidth / cols;
        const cellHeight = usableHeight / rows;
        
        if (!boardEl.dataset.cellsInitialized) {
          const availableCells = [];
          for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
              availableCells.push({ row, col });
            }
          }
          for (let i = availableCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
          }
          boardEl.dataset.availableCells = JSON.stringify(availableCells);
          boardEl.dataset.cellsInitialized = 'true';
          boardEl.dataset.cellIndex = '0';
        }
        
        const availableCells = JSON.parse(boardEl.dataset.availableCells);
        const cellIndex = parseInt(boardEl.dataset.cellIndex) || 0;
        const cell = availableCells[cellIndex];
        boardEl.dataset.cellIndex = (cellIndex + 1).toString();
        
        const cellLeft = containerPadding + cell.col * cellWidth;
        const cellTop = containerPadding + cell.row * cellHeight;
        const cellRight = cellLeft + cellWidth;
        const cellBottom = cellTop + cellHeight;
        
        const padding = 5;
        const maxX = cellRight - squareSize - padding;
        const maxY = cellBottom - squareSize - padding;
        
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
      }, 50);
    } else if (task === 'delete' || (mod === 'rotate' && task === 'delete')) {
      btn.style.position = 'absolute';
      const squareSize = 140;
      btn.style.width = `${squareSize}px`;
      btn.style.height = `${squareSize}px`;
      btn.style.cursor = 'move';
      
      setTimeout(() => {
        const boardWidth = boardEl.clientWidth || boardEl.offsetWidth || 800;
        const boardHeight = boardEl.clientHeight || boardEl.offsetHeight || 600;
        
        const containerPadding = 8;
        const usableWidth = boardWidth - containerPadding * 2;
        const usableHeight = boardHeight - containerPadding * 2;
        
        const padding = 5;
        const maxX = usableWidth - squareSize - padding;
        const maxY = usableHeight - squareSize - padding;
        
        const randomX = containerPadding + padding + Math.random() * Math.max(0, maxX - containerPadding - padding);
        const randomY = containerPadding + padding + Math.random() * Math.max(0, maxY - containerPadding - padding);
        
        btn.style.left = `${randomX}px`;
        btn.style.top = `${randomY}px`;
        
        btn.dataset.initialX = randomX;
        btn.dataset.initialY = randomY;
      }, 50);
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
    
    if (task === 'click') {
      btn.addEventListener('click', () => engine.handleAnswer(idx));
    } else if (task === 'drag') {
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
    } else if (task === 'delete') {
      let clickTimeout = null;
      let isDragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let initialLeft = 0;
      let initialTop = 0;
      
      btn.addEventListener('mousedown', (e) => {
        if (e.detail === 2) return;
        if (btn.dataset.deleted === 'true') return;
        
        isDragging = true;
        btn.style.zIndex = '1000';
        btn.style.transition = 'none';
        
        const boardRect = boardEl.getBoundingClientRect();
        dragStartX = e.clientX - boardRect.left;
        dragStartY = e.clientY - boardRect.top;
        initialLeft = parseFloat(btn.style.left) || 0;
        initialTop = parseFloat(btn.style.top) || 0;
        
        e.preventDefault();
      });
      
      const handleMouseMove = (e) => {
        if (!isDragging || btn.dataset.deleted === 'true') return;
        
        const boardRect = boardEl.getBoundingClientRect();
        const mouseX = e.clientX - boardRect.left;
        const mouseY = e.clientY - boardRect.top;
        
        const deltaX = mouseX - dragStartX;
        const deltaY = mouseY - dragStartY;
        
        const squareWidth = btn.offsetWidth;
        const squareHeight = btn.offsetHeight;
        const containerPadding = 8;
        
        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;
        
        const minX = containerPadding;
        const minY = containerPadding;
        const maxX = boardRect.width - squareWidth - containerPadding;
        const maxY = boardRect.height - squareHeight - containerPadding;
        
        newLeft = Math.max(minX, Math.min(newLeft, maxX));
        newTop = Math.max(minY, Math.min(newTop, maxY));
        
        btn.style.left = `${newLeft}px`;
        btn.style.top = `${newTop}px`;
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      
      const handleMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          btn.style.zIndex = '';
          btn.style.transition = '';
        }
      };
      
      document.addEventListener('mouseup', handleMouseUp);
      
      btn.addEventListener('click', () => {
        if (isDragging) {
          clickTimeout = null;
          return;
        }
        
        if (clickTimeout) {
          clearTimeout(clickTimeout);
          
          if (idx === engine.current.correctIndex) {
            setTimeout(() => {
              engine.callbacks.onWrongAnswer('Вы удалили нужный квадрат');
            }, 100);
            return;
          }
          
          const bbox = btn.getBoundingClientRect();
          const x = bbox.left + bbox.width / 2;
          const y = bbox.top + bbox.height / 2;
          for (let i = 0; i < 30; i++) {
            createParticle(x, y, 'square');
          }
          
          btn.style.opacity = '0';
          btn.style.visibility = 'hidden';
          btn.style.pointerEvents = 'none';
          btn.dataset.deleted = 'true';
          
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

const dragTargetArea = document.getElementById('drag-target-container');
const droppedSquareWrapper = document.getElementById('dropped-square-wrapper');

function initDragAndDrop() {
  if (!dragTargetArea || !droppedSquareWrapper) return;
  
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

if (dragTargetArea && droppedSquareWrapper) {
  initDragAndDrop();
}

let currentRotation = 0;
const rotateDroppedSquare = (direction) => {
  if (!droppedSquareWrapper || !droppedSquareWrapper.firstChild) return;
  
  currentRotation = (currentRotation + (direction === 'left' ? -90 : 90)) % 360;
  if (currentRotation < 0) currentRotation += 360;
  
  const square = droppedSquareWrapper.firstChild;
  square.style.transform = `rotate(${currentRotation}deg)`;
  droppedSquareRotation = currentRotation;
};

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

function checkDroppedSquare() {
  if (droppedSquareIndex === null || !engine.current || !droppedSquareWrapper.firstChild) return;
  
  const { target, correctIndex } = engine.current;
  const droppedMatrix = JSON.parse(droppedSquareWrapper.firstChild.dataset.matrix);
  
  let rotatedMatrix = droppedMatrix;
  const rotations = Math.floor(droppedSquareRotation / 90) % 4;
  
  for (let i = 0; i < rotations; i++) {
    rotatedMatrix = rotateSquare(rotatedMatrix);
  }
  
  const matches = areMatricesEqual(rotatedMatrix, target);
  
  if (matches && droppedSquareIndex === correctIndex) {
    engine.handleAnswer(correctIndex);
  } else {
    engine.handleAnswer(-1);
  }
}

function areMatricesEqual(m1, m2) {
  if (m1.length !== m2.length) return false;
  return m1.every((row, i) => 
    row.every((cell, j) => cell === m2[i][j])
  );
}

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

document.getElementById('dev-question-1').addEventListener('click', () => {
  engine.questionIndex = 1;
  engine.showingInstruction = false;
  if (instructionModal) instructionModal.classList.add('hidden');
  engine.askQuestion();
  devPanel.classList.remove('visible');
});

document.getElementById('dev-question-3').addEventListener('click', () => {
  engine.questionIndex = 3;
  engine.showingInstruction = false;
  if (instructionModal) instructionModal.classList.add('hidden');
  engine.askQuestion();
  devPanel.classList.remove('visible');
});

document.getElementById('dev-question-5').addEventListener('click', () => {
  engine.questionIndex = 5;
  engine.showingInstruction = false;
  if (instructionModal) instructionModal.classList.add('hidden');
  engine.askQuestion();
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    engine.start();
  });
} else {
  engine.start();
}
