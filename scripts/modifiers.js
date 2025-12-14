const timers = new Set();

function register(intervalId) {
  timers.add(intervalId);
}

function clearAll() {
  timers.forEach((id) => clearInterval(id));
  timers.clear();
}

export const Modifiers = {
  none: {
    init() {},
    cleanup() {}
  },

  blink: {
    init(squares) {
      const id = setInterval(() => squares.forEach((sq) => {
        sq.classList.add('blinking');
        setTimeout(() => sq.classList.remove('blinking'), 320);
      }), 1200);
      register(id);
    },
    cleanup() { clearAll(); }
  },

  rotate: {
    init(squares, boardEl, task) {
      squares.forEach((sq, idx) => {
        // Генерируем случайную скорость вращения (от 4 до 12 секунд)
        const duration = 4 + Math.random() * 8;
        // Случайное направление (1 для по часовой, -1 для против часовой)
        const direction = Math.random() > 0.5 ? 1 : -1;
        // Случайный начальный угол
        const startAngle = Math.random() * 360;
        
        sq.style.animation = `rotation-${idx} ${duration}s linear infinite`;
        sq.style.setProperty('--rotation-direction', direction);
        sq.style.setProperty('--start-angle', `${startAngle}deg`);
        
        // Добавляем уникальную анимацию для каждого квадрата
        if (!document.getElementById(`rotation-style-${idx}`)) {
          const style = document.createElement('style');
          style.id = `rotation-style-${idx}`;
          style.textContent = `
            @keyframes rotation-${idx} {
              from { transform: rotate(var(--start-angle, 0deg)); }
              to { transform: rotate(calc(var(--start-angle, 0deg) + ${direction * 360}deg)); }
            }
          `;
          document.head.appendChild(style);
        }
      });
    },
    cleanup(squares) {
      squares.forEach((sq, idx) => {
        sq.style.animation = '';
        sq.style.setProperty('--rotation-direction', '');
        sq.style.setProperty('--start-angle', '');
        const style = document.getElementById(`rotation-style-${idx}`);
        if (style) style.remove();
      });
    }
  }
};

