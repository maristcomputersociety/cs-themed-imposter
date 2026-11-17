/**
 * Wordset paths resolve from this module via import.meta.url so the app works
 * when hosted at a GitHub Pages project URL (e.g. /repo-name/) or from a local server.
 */

const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const numPlayersInput = document.getElementById('num-players');
const numImpostersInput = document.getElementById('num-imposters');
const targetTaskCountField = document.getElementById('target-task-count-field');
const targetTaskCountLabel = document.getElementById('target-task-count-label');
const targetTaskCountInput = document.getElementById('num-target-tasks');
const wordsetSelect = document.getElementById('wordset');
const btnEditWords = document.getElementById('btn-edit-words');
const wordEditorContent = document.getElementById('word-editor-content');
const wordList = document.getElementById('word-list');
const wordAddForm = document.getElementById('word-add-form');
const newWordInput = document.getElementById('new-word');
const wordEditorError = document.getElementById('word-editor-error');
const btnSaveWordset = document.getElementById('btn-save-wordset');
const btnDeleteWordset = document.getElementById('btn-delete-wordset');
const btnResetWordset = document.getElementById('btn-reset-wordset');
const roundMinutesInput = document.getElementById('round-minutes');
const previousModeButton = document.getElementById('btn-previous-mode');
const nextModeButton = document.getElementById('btn-next-mode');
const modeName = document.getElementById('mode-name');
const modeDescription = document.getElementById('mode-description');
const revealDetails = document.getElementById('reveal-details');
const revealDetailsList = document.getElementById('reveal-details-list');
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

const wordsets = new Map();
const wordsetLoads = new Map();
const CUSTOM_WORDSETS_STORAGE_KEY = 'cs-themed-imposter.custom-wordsets';
const gameModes = [
    {
        id: 'normal',
        name: 'Normal',
        description: 'Imposters know they are imposters and see their role instead of the secret word.',
        unknownImposter: false,
        limits: { minPlayers: 2, maxPlayers: 32, minImposters: 1 },
        getRevealDetails: function () { return []; },
    },
    {
        id: 'unknown-imposter',
        name: 'Unknown Imposter',
        description: 'Imposters do not know their role; they see a different secret word from the other players.',
        unknownImposter: true,
        limits: { minPlayers: 2, maxPlayers: 32, minImposters: 1 },
        getRevealDetails: function () { return []; },
    },
    {
        id: 'imposter-hivemind',
        name: 'Hivemind',
        description: 'Imposters know who their teammates are. Each player is numbered by card-reveal order, starting at 1.',
        unknownImposter: false,
        limits: { minPlayers: 4, maxPlayers: 32, minImposters: 2 },
        getRevealDetails: function (details) {
            if (!details.isImposter) return [];
            return ['Your fellow imposters are Players ' + details.otherImposterNumbers.join(', ') + '.'];
        },
    },
    {
        id: 'hitman',
        name: 'Hitman',
        description: 'Hitmen are assigned a player to get voted off as the imposter. Hitmen may be civilians or imposters.',
        unknownImposter: false,
        limits: { minPlayers: 4, maxPlayers: 32, minImposters: 1 },
        getRevealDetails: function (details) {
            if (!details.hasTargetTask) return [];
            return ['You are a Hitman. Try to get Player ' + details.targetNumber + ' voted off as the imposter.'];
        },
    },
    {
        id: 'lawyer',
        name: 'Lawyer',
        description: 'Lawyers are assigned a player to defend from being voted off as the imposter. Lawyers may be civilians or imposters.',
        unknownImposter: false,
        limits: { minPlayers: 4, maxPlayers: 32, minImposters: 1 },
        getRevealDetails: function (details) {
            if (!details.hasTargetTask) return [];
            return ['You are a Lawyer. Defend Player ' + details.targetNumber + ' from being voted off as the imposter, regardless of their innocence.'];
        },
    }
];
let savedCustomWordsets = [];
let customWordsetStorageError = '';
let selectedModeIndex = 0;

/** @type {{ secretWord: string, imposterWordsByPlayer: Record<number, string>, imposterIndices: number[], targetTaskIndices: number[], targetsByPlayer: Record<number, number>, playerNumbersByIndex: Record<number, number>, revealedCardCount: number, mode: (typeof gameModes)[number] | null, currentPlayer: number, revealed: boolean, roundEndMs: number, timerId: number | null, revealCooldownEndMs: number, tapRevealCooldownEndMs: number }} */
let game = {
    secretWord: '',
    imposterWordsByPlayer: {},
    imposterIndices: [],
    targetTaskIndices: [],
    targetsByPlayer: {},
    playerNumbersByIndex: {},
    revealedCardCount: 0,
    mode: null,
    currentPlayer: 0,
    revealed: false,
    roundEndMs: 0,
    timerId: null,
    revealCooldownEndMs: 0,
    tapRevealCooldownEndMs: 0,
};

function maxImpostersForPlayers(n) {
    return Math.floor(n / 2);
}

function maxImpostersForMode(mode, numPlayers) {
    return Math.min(maxImpostersForPlayers(numPlayers), mode.limits.maxImposters || Infinity);
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

function clampSetupInputs() {
    const mode = gameModes[selectedModeIndex];
    const limits = mode.limits;
    numPlayersInput.min = String(limits.minPlayers);
    numPlayersInput.max = String(limits.maxPlayers);
    let n = parseInt(numPlayersInput.value, 10);
    if (Number.isNaN(n)) n = limits.minPlayers;
    n = Math.max(limits.minPlayers, Math.min(limits.maxPlayers, n));
    numPlayersInput.value = String(n);

    const maxI = maxImpostersForMode(gameModes[selectedModeIndex], n);
    numImpostersInput.min = String(limits.minImposters);
    numImpostersInput.max = String(maxI);
    let imp = parseInt(numImpostersInput.value, 10);
    if (Number.isNaN(imp)) imp = limits.minImposters;
    if (imp < limits.minImposters) imp = limits.minImposters;
    if (imp > maxI) imp = maxI;
    numImpostersInput.value = String(imp);

    const hasTargetTask = mode.id === 'hitman' || mode.id === 'lawyer';
    targetTaskCountField.hidden = !hasTargetTask;
    targetTaskCountLabel.textContent = mode.id === 'lawyer' ? 'Number of Lawyers' : 'Number of Hitmen';
    const maxHitmen = Math.floor(n / 4);
    targetTaskCountInput.min = '1';
    targetTaskCountInput.max = String(maxHitmen);
    let taskCount = parseInt(targetTaskCountInput.value, 10);
    if (Number.isNaN(taskCount)) taskCount = 1;
    taskCount = Math.max(1, Math.min(maxHitmen, taskCount));
    targetTaskCountInput.value = String(taskCount);
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
    const taskCount = parseInt(targetTaskCountInput.value, 10);
    const minutes = parseInt(roundMinutesInput.value, 10);
    const mode = gameModes[selectedModeIndex];
    const limits = mode.limits;
    const maxI = maxImpostersForMode(mode, n);

    if (Number.isNaN(n) || n < limits.minPlayers || n > limits.maxPlayers) {
        showSetupError('Players must be between ' + limits.minPlayers + ' and ' + limits.maxPlayers + ' for ' + mode.name + '.');
        return null;
    }
    if (Number.isNaN(imp) || imp < limits.minImposters || imp > maxI) {
        showSetupError('Imposters must be between ' + limits.minImposters + ' and ' + maxI + ' for ' + n + ' players in ' + mode.name + '.');
        return null;
    }
    const maxHitmen = Math.floor(n / 4);
    const hasTargetTask = mode.id === 'hitman' || mode.id === 'lawyer';
    if (hasTargetTask && (Number.isNaN(taskCount) || taskCount < 1 || taskCount > maxHitmen)) {
        showSetupError(targetTaskCountLabel.textContent + ' must be between 1 and ' + maxHitmen + ' for ' + n + ' players.');
        return null;
    }
    if (Number.isNaN(minutes) || minutes < 1 || minutes > 10) {
        showSetupError('Round time must be between 1 and 10 minutes.');
        return null;
    }

    return {
        numPlayers: n,
        numImposters: imp,
        numTargetTasks: hasTargetTask ? taskCount : 0,
        roundMinutes: minutes,
        wordsetId: wordsetSelect.value,
        mode: mode,
    };
}

function selectMode(direction) {
    selectedModeIndex = (selectedModeIndex + direction + gameModes.length) % gameModes.length;
    const mode = gameModes[selectedModeIndex];
    modeName.textContent = mode.name;
    modeDescription.textContent = mode.description;
    clampSetupInputs();
    clearSetupError();
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

function getWordsetState(id) {
    return wordsets.get(id);
}

function updateWordsetLabel(id) {
    const option = Array.from(wordsetSelect.options).find(function (item) {
        return item.value === id;
    });
    const state = getWordsetState(id);
    if (!option) return;
    const isCustom = option.dataset.custom === 'true';
    btnDeleteWordset.hidden = !isCustom;
    btnResetWordset.hidden = isCustom;
    btnSaveWordset.textContent = isCustom ? 'Save changes' : 'Save as custom wordset';
    if (!state) {
        btnSaveWordset.disabled = true;
        btnResetWordset.disabled = true;
        return;
    }
    const edited = wordsHaveChanged(state);
    const baseLabel = option.dataset.originalLabel || option.label;
    option.textContent = baseLabel + (edited ? ' *' : '');
    option.style.fontStyle = isCustom ? 'italic' : '';
    btnSaveWordset.disabled = !edited;
    btnResetWordset.disabled = !edited;
}

function showWordEditorError(message) {
    wordEditorError.textContent = message;
    wordEditorError.hidden = false;
}

function clearWordEditorError() {
    wordEditorError.textContent = '';
    wordEditorError.hidden = true;
}

function wordsHaveChanged(state) {
    return state.words.length !== state.originalWords.length
        || state.words.some(function (word, index) {
            return word !== state.originalWords[index];
        });
}

function readSavedCustomWordsets() {
    const serialized = window.localStorage.getItem(CUSTOM_WORDSETS_STORAGE_KEY);
    if (!serialized) return [];
    const customWordsets = JSON.parse(serialized);
    if (!Array.isArray(customWordsets) || customWordsets.some(function (item) {
        return !item
            || typeof item.id !== 'string'
            || !item.id.startsWith('custom-')
            || typeof item.name !== 'string'
            || !item.name.trim()
            || !Array.isArray(item.words)
            || item.words.length === 0
            || item.words.some(function (word) {
                return typeof word !== 'string' || !word.trim();
            });
    })) {
        throw new Error('Saved custom wordsets have an invalid format.');
    }
    const ids = new Set();
    const names = new Set();
    customWordsets.forEach(function (item) {
        const normalizedName = item.name.trim().toLowerCase();
        if (ids.has(item.id) || names.has(normalizedName)) {
            throw new Error('Saved custom wordsets contain duplicate entries.');
        }
        ids.add(item.id);
        names.add(normalizedName);
    });
    return customWordsets;
}

function addCustomWordsetOption(customWordset) {
    let option = Array.from(wordsetSelect.options).find(function (item) {
        return item.value === customWordset.id;
    });
    if (!option) {
        option = document.createElement('option');
        option.value = customWordset.id;
        wordsetSelect.append(option);
    }
    option.textContent = customWordset.name;
    option.dataset.originalLabel = customWordset.name;
    option.dataset.custom = 'true';
    option.style.fontStyle = 'italic';
}

function persistCustomWordsets() {
    try {
        window.localStorage.setItem(CUSTOM_WORDSETS_STORAGE_KEY, JSON.stringify(savedCustomWordsets));
        customWordsetStorageError = '';
        return true;
    } catch (error) {
        showWordEditorError('Could not save this custom wordset in this browser. Check available storage and try again.');
        return false;
    }
}

function saveSelectedWordset() {
    const id = wordsetSelect.value;
    const state = getWordsetState(id);
    if (!state || !wordsHaveChanged(state)) return;
    if (state.words.length === 0 || state.words.some(function (word) { return !word.trim(); })) {
        showWordEditorError('Remove empty words or add at least one word before saving.');
        return;
    }
    if (customWordsetStorageError) {
        showWordEditorError(customWordsetStorageError);
        return;
    }

    const selectedOption = wordsetSelect.options[wordsetSelect.selectedIndex];
    const currentSaved = selectedOption.dataset.custom === 'true'
        ? savedCustomWordsets.find(function (item) { return item.id === id; })
        : null;
    const enteredName = window.prompt(
        currentSaved ? 'Name this custom wordset:' : 'Name your custom wordset:',
        currentSaved ? currentSaved.name : ''
    );
    if (enteredName === null) return;
    const name = enteredName.trim();
    if (!name) {
        showWordEditorError('Enter a name for the custom wordset.');
        return;
    }
    const matchesBuiltInName = Array.from(wordsetSelect.options).some(function (option) {
        return option.dataset.custom !== 'true'
            && (option.dataset.originalLabel || option.textContent).trim().toLowerCase() === name.toLowerCase();
    });
    if (matchesBuiltInName) {
        showWordEditorError('Choose a name that is different from the built-in wordsets.');
        return;
    }
    const duplicateName = savedCustomWordsets.some(function (item) {
        return item.id !== id && item.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicateName) {
        showWordEditorError('A custom wordset with that name already exists.');
        return;
    }

    let customId = id;
    if (!currentSaved) {
        do {
            customId = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        } while (savedCustomWordsets.some(function (item) { return item.id === customId; }));
    }
    const customWordset = { id: customId, name: name, words: state.words.slice() };
    const previousSaved = savedCustomWordsets;
    savedCustomWordsets = currentSaved
        ? savedCustomWordsets.map(function (item) {
            return item.id === id ? customWordset : item;
        })
        : savedCustomWordsets.concat(customWordset);
    if (!persistCustomWordsets()) {
        savedCustomWordsets = previousSaved;
        return;
    }

    if (!currentSaved) {
        state.words = state.originalWords.slice();
        updateWordsetLabel(id);
    }

    const customState = { originalWords: customWordset.words.slice(), words: customWordset.words.slice() };
    wordsets.set(customId, customState);
    addCustomWordsetOption(customWordset);
    wordsetSelect.value = customId;
    updateWordsetLabel(customId);
    clearWordEditorError();
    renderWordList(customId);
}

function deleteSelectedCustomWordset() {
    const id = wordsetSelect.value;
    const option = wordsetSelect.options[wordsetSelect.selectedIndex];
    if (!option || option.dataset.custom !== 'true') return;

    const savedWordset = savedCustomWordsets.find(function (item) { return item.id === id; });
    if (!savedWordset) {
        showWordEditorError('Could not find this saved custom wordset.');
        return;
    }
    if (!window.confirm('Are you sure you want to delete the custom wordset "' + savedWordset.name + '"?')) return;

    const previousSaved = savedCustomWordsets;
    savedCustomWordsets = savedCustomWordsets.filter(function (item) { return item.id !== id; });
    if (!persistCustomWordsets()) {
        savedCustomWordsets = previousSaved;
        return;
    }

    option.remove();
    wordsets.delete(id);
    const firstBuiltInOption = Array.from(wordsetSelect.options).find(function (item) {
        return item.dataset.custom !== 'true';
    });
    if (firstBuiltInOption) wordsetSelect.value = firstBuiltInOption.value;
    updateWordsetLabel(wordsetSelect.value);
    clearWordEditorError();
    if (!wordEditorContent.hidden) renderSelectedWordset();
}

function resetSelectedWordset() {
    const id = wordsetSelect.value;
    const option = wordsetSelect.options[wordsetSelect.selectedIndex];
    const state = getWordsetState(id);
    if (!option || option.dataset.custom === 'true' || !state || !wordsHaveChanged(state)) return;
    if (!window.confirm('Reset "' + (option.dataset.originalLabel || option.textContent) + '" to its default words?')) return;

    state.words = state.originalWords.slice();
    renderWordList(id);
    updateWordsetLabel(id);
    clearWordEditorError();
}

function renderWordList(id) {
    const state = getWordsetState(id);
    if (!state) return;
    wordList.replaceChildren();
    state.words.forEach(function (word, index) {
        const item = document.createElement('li');
        item.className = 'word-list__item';

        const input = document.createElement('input');
        input.className = 'input';
        input.type = 'text';
        input.value = word;
        input.setAttribute('aria-label', 'Word ' + (index + 1));
        input.addEventListener('input', function () {
            state.words[index] = input.value;
            updateWordsetLabel(id);
            clearWordEditorError();
        });

        const removeButton = document.createElement('button');
        removeButton.className = 'word-list__remove';
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.setAttribute('aria-label', 'Remove word ' + (index + 1));
        removeButton.addEventListener('click', function () {
            if (!window.confirm('Are you sure you want to remove "' + state.words[index] + '"?')) return;
            state.words.splice(index, 1);
            renderWordList(id);
            updateWordsetLabel(id);
            clearWordEditorError();
        });

        item.append(input, removeButton);
        wordList.append(item);
    });
}

async function loadWordsetForEditing(id) {
    let state = getWordsetState(id);
    if (state) return state;

    const customWordset = savedCustomWordsets.find(function (item) { return item.id === id; });
    if (customWordset) {
        state = { originalWords: customWordset.words.slice(), words: customWordset.words.slice() };
        wordsets.set(id, state);
        return state;
    }

    let loading = wordsetLoads.get(id);
    if (!loading) {
        loading = loadWordset(id).then(function (words) {
            const loadedState = { originalWords: words.slice(), words: words.slice() };
            wordsets.set(id, loadedState);
            return loadedState;
        });
        wordsetLoads.set(id, loading);
    }
    try {
        state = await loading;
    } finally {
        wordsetLoads.delete(id);
    }
    return state;
}

async function renderSelectedWordset() {
    const id = wordsetSelect.value;
    clearWordEditorError();
    if (customWordsetStorageError) showWordEditorError(customWordsetStorageError);
    wordList.replaceChildren();
    try {
        await loadWordsetForEditing(id);
        if (wordEditorContent.hidden || wordsetSelect.value !== id) return;
        renderWordList(id);
        updateWordsetLabel(id);
    } catch (error) {
        if (wordsetSelect.value === id) {
            showWordEditorError('Could not load this wordset. Please try again.');
        }
    }
}

function pickImposterIndices(numPlayers, count) {
    const idx = shuffle(Array.from({ length: numPlayers }, (_, i) => i));
    return idx.slice(0, count).sort(function (a, b) {
        return a - b;
    });
}

function pickTargetAssignments(numPlayers, count) {
    const playerIndices = Array.from({ length: numPlayers }, function (_, index) { return index; });
    const targetTaskIndices = shuffle(playerIndices).slice(0, count);
    const targetsByPlayer = {};
    targetTaskIndices.forEach(function (playerIndex) {
        const possibleTargets = playerIndices.filter(function (targetIndex) {
            return targetIndex !== playerIndex;
        });
        targetsByPlayer[playerIndex] = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    });
    return { targetTaskIndices: targetTaskIndices, targetsByPlayer: targetsByPlayer };
}

const cooldownFill = document.querySelector('.card__cooldown-fill');

function resetCooldownState() {
    game.revealCooldownEndMs = 0;
    game.tapRevealCooldownEndMs = 0;
    resetRevealCooldownBar();
}

function showCardForCurrentPlayer() {
    const n = parseInt(numPlayersInput.value, 10);
    game.revealed = false;
    playerLabel.textContent = 'Player ' + game.playerNumbersByIndex[game.currentPlayer] + ' of ' + n;
    cardHint.hidden = false;
    cardSecret.hidden = true;
    cardSecret.textContent = '';
    revealDetailsList.replaceChildren();
    revealDetails.hidden = true;
    roleCard.setAttribute('aria-pressed', 'false');
    resetCooldownState();
}

function setRevealCooldownBar(percent) {
    if (!cooldownFill) return;
    cooldownFill.style.width = percent + '%';
}

function resetRevealCooldownBar() {
    if (!cooldownFill) return;
    cooldownFill.style.transition = 'none';
    setRevealCooldownBar(0);
    cooldownFill.getBoundingClientRect();
    cooldownFill.style.transition = 'width 500ms linear';
}

function startRevealCooldownBar() {
    if (!cooldownFill) return;
    cooldownFill.style.transition = 'none';
    setRevealCooldownBar(100);
    cooldownFill.getBoundingClientRect();
    cooldownFill.style.transition = 'width 500ms linear';
    requestAnimationFrame(function () {
        setRevealCooldownBar(0);
    });
}

function revealCurrent() {
    const isImposter = game.imposterIndices.indexOf(game.currentPlayer) !== -1;
    const hasTargetTask = game.targetTaskIndices.indexOf(game.currentPlayer) !== -1;
    const playerNumber = game.revealedCardCount + 1;
    game.revealedCardCount = playerNumber;
    game.playerNumbersByIndex[game.currentPlayer] = playerNumber;
    cardHint.hidden = true;
    cardSecret.hidden = false;
    cardSecret.textContent = isImposter
        ? game.imposterWordsByPlayer[game.currentPlayer] || game.secretWord
        : game.secretWord;
    const otherImposterNumbers = game.imposterIndices
        .filter(function (playerIndex) { return playerIndex !== game.currentPlayer; })
        .map(function (playerIndex) { return game.playerNumbersByIndex[playerIndex]; });
    const details = ['You are Player ' + playerNumber + '.'].concat(game.mode.getRevealDetails({
        isImposter: isImposter,
        hasTargetTask: hasTargetTask,
        playerNumber: playerNumber,
        otherImposterNumbers: otherImposterNumbers,
        targetNumber: hasTargetTask
            ? game.playerNumbersByIndex[game.targetsByPlayer[game.currentPlayer]]
            : null,
    }));
    revealDetailsList.replaceChildren();
    details.forEach(function (detail) {
        const item = document.createElement('li');
        item.textContent = detail;
        revealDetailsList.appendChild(item);
    });
    revealDetails.hidden = details.length === 0;
    game.revealed = true;
    roleCard.setAttribute('aria-pressed', 'true');
    startRevealCooldownBar();
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
    game.revealedCardCount = 0;
    game.playerNumbersByIndex = {};
    game.mode = null;
}

function isRevealCooldownActive() {
    return Date.now() < game.revealCooldownEndMs;
}

function startRevealCooldown() {
    const cooldownMs = 500;
    game.revealCooldownEndMs = Date.now() + cooldownMs;
}

function isTapRevealCooldownActive() {
    return Date.now() < game.tapRevealCooldownEndMs;
}

function startTapRevealCooldown() {
    const cooldownMs = 500;
    game.tapRevealCooldownEndMs = Date.now() + cooldownMs;
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
    if (isRevealCooldownActive()) {
        return;
    }
    if (isTapRevealCooldownActive()) {
        return;
    }
    if (!game.revealed) {
        revealCurrent();
        startTapRevealCooldown();
        startRevealCooldown();
        return;
    }
    advanceOrFinish();
});

numPlayersInput.addEventListener('input', clampSetupInputs);
targetTaskCountInput.addEventListener('input', function () {
    clearSetupError();
});

Array.from(wordsetSelect.options).forEach(function (option) {
    option.dataset.originalLabel = option.textContent;
});

try {
    savedCustomWordsets = readSavedCustomWordsets();
    savedCustomWordsets.forEach(addCustomWordsetOption);
} catch (error) {
    customWordsetStorageError = 'Could not load saved custom wordsets from this browser. They may be unavailable or corrupted.';
}

btnSaveWordset.addEventListener('click', saveSelectedWordset);
btnDeleteWordset.addEventListener('click', deleteSelectedCustomWordset);
btnResetWordset.addEventListener('click', resetSelectedWordset);

btnEditWords.addEventListener('click', function () {
    wordEditorContent.hidden = !wordEditorContent.hidden;
    btnEditWords.setAttribute('aria-expanded', String(!wordEditorContent.hidden));
    btnEditWords.textContent = wordEditorContent.hidden ? 'View / edit words' : 'Hide word editor';
    if (!wordEditorContent.hidden) renderSelectedWordset();
});

wordsetSelect.addEventListener('change', function () {
    if (!wordEditorContent.hidden) renderSelectedWordset();
});

wordAddForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    const id = wordsetSelect.value;
    const word = newWordInput.value.trim();
    clearWordEditorError();
    if (!word) {
        showWordEditorError('Enter a word to add.');
        newWordInput.focus();
        return;
    }
    try {
        const state = await loadWordsetForEditing(id);
        if (wordsetSelect.value !== id) return;
        state.words.push(word);
        newWordInput.value = '';
        renderWordList(id);
        updateWordsetLabel(id);
    } catch (error) {
        if (wordsetSelect.value === id) {
            showWordEditorError('Could not load this wordset. Please try again.');
        }
    }
});

btnStart.addEventListener('click', async function () {
    clearSetupError();
    const cfg = parseSetup();
    if (!cfg) return;

    let words;
    try {
        const state = await loadWordsetForEditing(cfg.wordsetId);
        words = state.words.slice();
    } catch (e) {
        showSetupError(
            'Could not load word lists. If you opened this file directly, use a local server (Live Server) or deploy to GitHub Pages.'
        );
        return;
    }
    if (wordsetSelect.value !== cfg.wordsetId) return;
    if (words.length === 0 || words.some(function (word) { return !word.trim(); })) {
        showSetupError('Remove empty words or add at least one word before starting.');
        return;
    }

    game.secretWord = pickRandomWord(words);
    game.mode = cfg.mode;
    game.imposterIndices = pickImposterIndices(cfg.numPlayers, cfg.numImposters);
    const hasTargetTask = cfg.mode.id === 'hitman' || cfg.mode.id === 'lawyer';
    const targetAssignments = hasTargetTask
        ? pickTargetAssignments(cfg.numPlayers, cfg.numTargetTasks)
        : { targetTaskIndices: [], targetsByPlayer: {} };
    game.targetTaskIndices = targetAssignments.targetTaskIndices;
    game.targetsByPlayer = targetAssignments.targetsByPlayer;
    game.imposterWordsByPlayer = {};
    game.playerNumbersByIndex = {};
    for (let playerIndex = 0; playerIndex < cfg.numPlayers; playerIndex++) {
        game.playerNumbersByIndex[playerIndex] = playerIndex + 1;
    }
    game.revealedCardCount = 0;

    if (cfg.mode.unknownImposter) {
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

previousModeButton.addEventListener('click', function () {
    selectMode(-1);
});

nextModeButton.addEventListener('click', function () {
    selectMode(1);
});

clampSetupInputs();
