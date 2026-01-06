document.addEventListener('DOMContentLoaded', () => {
  const title = document.querySelector('.start-title');
  if (!title) return;

  const titleLines = title.querySelectorAll('.title-line');
  
  titleLines.forEach((line) => {
    const text = line.textContent;
    const letters = text.split('');

    line.innerHTML = letters.map((letter, index) => {
      if (letter === ' ') {
        return '<span class="letter-space"></span>';
      }
      return `<span class="letter-flip" data-index="${index}">${letter}</span>`;
    }).join('');
  });

  const letterElements = title.querySelectorAll('.letter-flip');
  
  letterElements.forEach((letter) => {
    letter.addEventListener('mouseenter', () => {
      letter.classList.add('flipping');
      setTimeout(() => {
        letter.classList.remove('flipping');
      }, 600);
    });
  });
});
