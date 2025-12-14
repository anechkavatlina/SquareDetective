const STORAGE_KEY = 'squareDetectiveHighScores';

export function loadHighScores() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveHighScore(entry) {
  const list = loadHighScores();
  const withId = { id: crypto.randomUUID(), ...entry };
  const next = [...list, withId]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return { list: next, id: withId.id };
}

export function clearHighScores() {
  localStorage.removeItem(STORAGE_KEY);
}

