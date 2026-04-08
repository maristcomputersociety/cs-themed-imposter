/**
 * Wordset paths resolve from this module via import.meta.url so the app works
 * when hosted at a GitHub Pages project URL (e.g. /repo-name/) or from a local server.
 */

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const numPlayersInput = document.getElementById('num-players');
const numImpostersInput = document.getElementById('num-imposters');
const wordsetSelect = document.getElementById('wordset');
const roundMinutesInput = document.getElementById('round-minutes');
const unknownImposterToggle = document.getElementById('unknown-imposter-toggle');
const setupError = document.getElementById('setup-error');
const btnStart = document.getElementById('btn-start');

const revealSection = document.getElementById('reveal-section');
const timerSection = document.getElementById('timer-section');
const playerLabel = document.getElementById('player-label');
const roleCard = document.getElementById('role-card');
const cardHint = document.getElementById('card-hint');
const cardSecret = document.getElementById('card-secret');
const timerDisplay = document.getElementById('timer-display');
const timerLabel = document.getElementById('timer-label');
const btnBackSetup = document.getElementById('btn-back-setup');

/** @type {{ secretWord: string, imposterWordsByPlayer: Record<number, string>, imposterIndices: number[], currentPlayer: number, revealed: boolean, roundEndMs: number, timerId: number | null }} */
let game = {
    secretWord: '',
    imposterWordsByPlayer: {},
    imposterIndices: [],
    currentPlayer: 0,
    revealed: false,
    roundEndMs: 0,
    timerId: null,
};

function maxImpostersForPlayers(n) {
    return Math.floor(n / 2);
}

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
    return a;
}

function clampImposterInput() {
    const n = parseInt(numPlayersInput.value, 10) || 2;
    const maxI = maxImpostersForPlayers(n);
    numImpostersInput.max = String(maxI);
    let imp = parseInt(numImpostersInput.value, 10) || 1;
    if (imp < 1) imp = 1;
    if (imp > maxI) imp = maxI;
    numImpostersInput.value = String(imp);
}

function showSetupError(message) {
    setupError.textContent = message;
    setupError.hidden = false;
}

function clearSetupError() {
    setupError.textContent = '';
    setupError.hidden = true;
}

function parseSetup() {
    const n = parseInt(numPlayersInput.value, 10);
    const imp = parseInt(numImpostersInput.value, 10);
    const minutes = parseInt(roundMinutesInput.value, 10);
    const maxI = maxImpostersForPlayers(n);

    if (Number.isNaN(n) || n < 2 || n > 32) {
        showSetupError('Players must be between 2 and 32.');
        return null;
    }
    if (Number.isNaN(imp) || imp < 1 || imp > maxI) {
        showSetupError(`Imposters must be between 1 and ${maxI} for ${n} players.`);
        return null;
    }
    if (Number.isNaN(minutes) || minutes < 1 || minutes > 10) {
        showSetupError('Round time must be between 1 and 10 minutes.');
        return null;
    }

    return {
        numPlayers: n,
        numImposters: imp,
        roundMinutes: minutes,
        wordsetId: wordsetSelect.value,
        unknownImposterMode: unknownImposterToggle.checked,
    };
}

function pickRandomWord(words) {
    return words[Math.floor(Math.random() * words.length)];
}

function pickDifferentWord(words, secretWord) {
    if (words.length <= 1) return secretWord;
    const alternatives = words.filter(function (w) {
        return w !== secretWord;
    });
    if (alternatives.length === 0) return secretWord;
    return pickRandomWord(alternatives);
}

function pickDistinctImposterWords(words, secretWord, count) {
    const uniqueAlternatives = Array.from(
        new Set(
            words.filter(function (w) {
                return w !== secretWord;
            })
        )
    );
    if (uniqueAlternatives.length < count) return null;
    return shuffle(uniqueAlternatives).slice(0, count);
}

async function loadWordset(id) {
    const url = new URL(`./wordsets/${id}.json`, import.meta.url);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Could not load word list.');
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid word list.');
    return data.map(String);
}

function pickImposterIndices(numPlayers, count) {
    const idx = shuffle(Array.from({ length: numPlayers }, (_, i) => i));
    return idx.slice(0, count).sort(function (a, b) {
        return a - b;
    });
}

function showCardForCurrentPlayer() {
    const n = parseInt(numPlayersInput.value, 10);
    game.revealed = false;
    playerLabel.textContent = 'Player ' + (game.currentPlayer + 1) + ' of ' + n;
    cardHint.hidden = false;
    cardSecret.hidden = true;
    cardSecret.textContent = '';
    roleCard.setAttribute('aria-pressed', 'false');
}

function revealCurrent() {
    const isImposter = game.imposterIndices.indexOf(game.currentPlayer) !== -1;
    cardHint.hidden = true;
    cardSecret.hidden = false;
    cardSecret.textContent = isImposter
        ? game.imposterWordsByPlayer[game.currentPlayer] || game.secretWord
        : game.secretWord;
    game.revealed = true;
    roleCard.setAttribute('aria-pressed', 'true');
}

function stopRoundTimer() {
    if (game.timerId !== null) {
        clearInterval(game.timerId);
        game.timerId = null;
    }
}

function formatMs(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

function tickTimer() {
    const left = game.roundEndMs - Date.now();
    if (left <= 0) {
        stopRoundTimer();
        timerLabel.hidden = true;
        timerDisplay.textContent = "Time's up";
        timerDisplay.classList.add('timer-display--done');
        return;
    }
    timerDisplay.textContent = formatMs(left);
}

function startRoundTimer(minutes) {
    stopRoundTimer();
    revealSection.hidden = true;
    timerSection.hidden = false;
    timerLabel.hidden = false;
    timerLabel.textContent = 'Time remaining';
    timerDisplay.classList.remove('timer-display--done');
    btnBackSetup.hidden = false;
    game.roundEndMs = Date.now() + minutes * 60 * 1000;
    tickTimer();
    game.timerId = window.setInterval(tickTimer, 250);
}

function resetToSetup() {
    stopRoundTimer();
    gameScreen.hidden = true;
    setupScreen.hidden = false;
    revealSection.hidden = true;
    timerSection.hidden = true;
    timerLabel.hidden = false;
    timerLabel.textContent = 'Time remaining';
    timerDisplay.textContent = '00:00';
    timerDisplay.classList.remove('timer-display--done');
    game.currentPlayer = 0;
    game.revealed = false;
}

function advanceOrFinish() {
    const n = parseInt(numPlayersInput.value, 10);
    game.currentPlayer += 1;
    if (game.currentPlayer >= n) {
        const minutes = parseInt(roundMinutesInput.value, 10);
        startRoundTimer(minutes);
        return;
    }
    showCardForCurrentPlayer();
}

roleCard.addEventListener('click', function () {
    if (!game.revealed) {
        revealCurrent();
        return;
    }
    advanceOrFinish();
});

numPlayersInput.addEventListener('input', clampImposterInput);

btnStart.addEventListener('click', async function () {
    clearSetupError();
    const cfg = parseSetup();
    if (!cfg) return;

    let words;
    try {
        words = await loadWordset(cfg.wordsetId);
    } catch (e) {
        showSetupError(
            'Could not load word lists. If you opened this file directly, use a local server (Live Server) or deploy to GitHub Pages.'
        );
        return;
    }

    game.secretWord = pickRandomWord(words);
    game.imposterIndices = pickImposterIndices(cfg.numPlayers, cfg.numImposters);
    game.imposterWordsByPlayer = {};

    if (cfg.unknownImposterMode) {
        const uniqueImposterWords = pickDistinctImposterWords(words, game.secretWord, cfg.numImposters);
        if (!uniqueImposterWords) {
            showSetupError(
                'This wordset does not have enough unique words for unknown imposter mode with the selected number of imposters.'
            );
            return;
        }
        game.imposterIndices.forEach(function (playerIndex, i) {
            game.imposterWordsByPlayer[playerIndex] = uniqueImposterWords[i];
        });
    } else {
        game.imposterIndices.forEach(function (playerIndex) {
            game.imposterWordsByPlayer[playerIndex] = 'Imposter';
        });
    }
    game.currentPlayer = 0;
    game.revealed = false;

    setupScreen.hidden = true;
    gameScreen.hidden = false;
    revealSection.hidden = false;
    timerSection.hidden = true;
    timerLabel.hidden = false;
    timerLabel.textContent = 'Time remaining';
    timerDisplay.textContent = '00:00';
    timerDisplay.classList.remove('timer-display--done');

    showCardForCurrentPlayer();
});

btnBackSetup.addEventListener('click', resetToSetup);

clampImposterInput();
