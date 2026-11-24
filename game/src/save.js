// localStorage persistence: cash, story progress and the free-roam flag.
// Wrapped in try/catch because storage can be unavailable (private mode,
// file:// in some browsers) and the game must still run without it.

const KEY = 'palm-shores-heat-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return {
      cash: data.cash,
      missionIndex: data.missionIndex,
      storyDone: Boolean(data.storyDone),
    };
  } catch {
    return null;
  }
}

export function storeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
    }));
  } catch {
    // Saving is best-effort; gameplay never depends on it.
  }
}

// Wipe the save entirely (a fresh story from zero cash).
export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
