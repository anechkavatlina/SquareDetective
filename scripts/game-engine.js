import { DIFFICULTY_CONFIG, GAME_LEVEL_CONFIG, calculateScore, sample } from './game-logic.js';
import { generateUniqueSquaresSet } from './generator.js';

export class GameEngine {
  constructor({ playerName, difficultyLevel, ui, callbacks }) {
    this.playerName = playerName;
    this.difficultyLevel = difficultyLevel;
    this.diffConfig = DIFFICULTY_CONFIG[difficultyLevel];
    this.ui = ui;
    this.callbacks = callbacks;
    
    this.gameLevel = 1;
    this.questionIndex = 1;
    this.score = 0;
    this.locked = false;
    this.timerId = null;
    this.timeLeft = 0;
    this.current = null;
    this.hintUsed = false;
    this.showingInstruction = false;
  }

  start() {
    this.ui.name.textContent = this.playerName;
    this.ui.level.textContent = `${this.diffConfig.name}`;
    this.ui.score.textContent = this.score;
    this.showInstruction();
  }

  showInstruction() {
    const gameConfig = GAME_LEVEL_CONFIG[this.gameLevel];
    this.showingInstruction = true;
    this.callbacks.onShowInstruction({
      gameLevel: this.gameLevel,
      name: gameConfig.name,
      description: gameConfig.description,
      task: gameConfig.task
    });
  }

  startGameLevel() {
    this.showingInstruction = false;
    this.questionIndex = 1;
    this.askQuestion();
  }

  getTimeForCurrentQuestion() {
    const decay = Math.pow(0.9, this.questionIndex - 1);
    return Math.max(8, Math.floor(this.diffConfig.baseTime * decay));
  }

  askQuestion() {
    const gameConfig = GAME_LEVEL_CONFIG[this.gameLevel];
    
    if (this.questionIndex > gameConfig.questions) {
      this.finishGameLevel();
      return;
    }

    this.hintUsed = false;
    this.locked = false;

    const size = sample(this.diffConfig.sizes);
    const colors = this.diffConfig.baseColors;
    const squaresCount = gameConfig.progression[this.questionIndex - 1];
    const mod = gameConfig.modifiers[this.questionIndex - 1] || null;
    const time = this.getTimeForCurrentQuestion();

    const set = generateUniqueSquaresSet(squaresCount, size, colors);
    this.current = { 
      ...set, 
      size, 
      colors, 
      mod, 
      squaresCount,
      task: gameConfig.task 
    };

    this.ui.question.textContent = `${this.questionIndex}/${gameConfig.questions}`;
    this.ui.mod.textContent = mod ? `Модификатор: ${mod}` : 'Без модификатора';
    this.ui.size.textContent = `${size} x ${size}, цветов: ${colors}`;

    this.callbacks.onRenderBoard({
      ...this.current,
      time
    });

    this.startTimer(time);
  }

  startTimer(duration) {
    clearInterval(this.timerId);
    const start = Date.now();
    this.timeLeft = duration;
    this.ui.timer.textContent = this.formatTime(this.timeLeft);
    this.ui.progress.style.width = '100%';

    this.timerId = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      this.timeLeft = remaining;
      const percent = Math.max(0, (remaining / duration) * 100);
      this.ui.timer.textContent = this.formatTime(remaining);
      this.ui.progress.style.width = `${percent}%`;

      if (remaining <= 0.05) {
        clearInterval(this.timerId);
        this.handleAnswer(-1, true);
      }
    }, 200);
  }

  formatTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const r = (s % 60).toString().padStart(2, '0');
    return `${m}:${r}`;
  }

  useHint() {
    if (this.hintUsed || !this.current) return null;
    this.hintUsed = true;
    const { base } = calculateScore(
      this.difficultyLevel,
      this.gameLevel,
      this.questionIndex,
      this.current.squaresCount,
      Math.ceil(this.timeLeft),
      this.current.mod
    );
    const penalty = Math.floor(base * 0.1);
    return { penalty };
  }

  handleAnswer(index, timeUp = false) {
    if (this.locked || !this.current) return;
    this.locked = true;
    clearInterval(this.timerId);

    const correct = index === this.current.correctIndex;
    const timeLeftInt = Math.max(0, Math.ceil(this.timeLeft));
    const scoring = calculateScore(
      this.difficultyLevel,
      this.gameLevel,
      this.questionIndex,
      this.current.squaresCount,
      timeLeftInt,
      this.current.mod
    );

    let gained = 0;
    if (correct) {
      gained = scoring.total;
      if (this.hintUsed) gained -= Math.floor(scoring.base * 0.1);
      this.score += gained;
      this.ui.score.textContent = this.score;
    }

    this.callbacks.onQuestionResult({
      correct,
      chosen: index,
      gained,
      scoring,
      timeLeft: timeLeftInt,
      questionIndex: this.questionIndex,
      totalQuestions: GAME_LEVEL_CONFIG[this.gameLevel].questions,
      timeUp
    });

    if (!correct && !timeUp) {
      setTimeout(() => {
        this.callbacks.onWrongAnswer('Неправильно. Попробуй еще раз');
      }, 1000);
      return;
    }

    if (timeUp) {
      setTimeout(() => {
        this.callbacks.onWrongAnswer('Время истекло. Попробуй еще раз');
      }, 1000);
      return;
    }

    if (correct) {
      setTimeout(() => {
        this.nextQuestion();
      }, 800);
    }
  }

  nextQuestion() {
    this.questionIndex += 1;
    this.askQuestion();
  }

  finishGameLevel() {
    clearInterval(this.timerId);
    
    if (this.gameLevel < 3 && this.score >= 0) {
      this.gameLevel += 1;
      setTimeout(() => {
        this.showInstruction();
      }, 1000);
    } else {
      this.finishGame();
    }
  }

  finishGame() {
    clearInterval(this.timerId);
    this.callbacks.onGameEnd({
      score: this.score,
      difficultyLevel: this.difficultyLevel,
      gameLevel: this.gameLevel,
      playerName: this.playerName
    });
  }
}
