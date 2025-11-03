// logic/utils.js

// Variables de Estado Globales
export let server = "";
export let player = "";
export let currentPassword = "nopass";
export let currentGameId = "";
export let currentRoundId = "";
export let lastGame = null; // guarda el último estado del juego
export let autoOn = false; 

// Key de session estorage para persistir por ventana
const SESSION_KEY = 'contaminados_session_v1';

// Funciones para modificar el estado
export function setServer(newServer) { server = newServer; try { saveSession(); } catch(e){} }
export function setPlayer(newPlayer) { player = newPlayer; try { saveSession(); } catch(e){} }
export function setCurrentPassword(newPassword) { currentPassword = newPassword; try { saveSession(); } catch(e){} }
export function setCurrentGameId(newId) { currentGameId = newId; try { saveSession(); } catch(e){} }
export function setCurrentRoundId(newId) { currentRoundId = newId; try { saveSession(); } catch(e){} }
export function setLastGame(gameData) { lastGame = gameData; }
export function toggleAutoOn() { autoOn = !autoOn; try { saveSession(); } catch(e){} return autoOn; }

const _setServer = setServer;
export function setServerAndSave(newServer) { _setServer(newServer); saveSession(); }
const _setPlayer = setPlayer;
export function setPlayerAndSave(newPlayer) { _setPlayer(newPlayer); saveSession(); }
const _setCurrentPassword = setCurrentPassword;
export function setCurrentPasswordAndSave(newPassword) { _setCurrentPassword(newPassword); saveSession(); }
const _setCurrentGameId = setCurrentGameId;
export function setCurrentGameIdAndSave(newId) { _setCurrentGameId(newId); saveSession(); }
const _setCurrentRoundId = setCurrentRoundId;
export function setCurrentRoundIdAndSave(newId) { _setCurrentRoundId(newId); saveSession(); }
const _toggleAutoOn = toggleAutoOn;
export function toggleAutoOnAndSave() { const val = _toggleAutoOn(); saveSession(); return val; }

// Mantener la sesión en el sessionStorage
function saveSession() {
    try {
        const payload = {
            server,
            player,
            currentPassword,
            currentGameId,
            currentRoundId,
            autoOn
        };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('No se pudo guardar la sesión:', e);
    }
}

// Restaurar la sesión desde sessionStorage
export function restoreSession() {
    try {
    const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        if (!obj) return;
        if (obj.server) server = obj.server;
        if (obj.player) player = obj.player;
        if (obj.currentPassword) currentPassword = obj.currentPassword;
        if (obj.currentGameId) currentGameId = obj.currentGameId;
        if (obj.currentRoundId) currentRoundId = obj.currentRoundId;
        if (typeof obj.autoOn === 'boolean') autoOn = obj.autoOn;
    } catch (e) {
        console.warn('No se pudo restaurar la sesión:', e);
    }
}

export function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}

/* ---------- Utilities ---------- */
export function logConsole(msg, obj = null) {
    const consoleBox = document.getElementById("console");
    const time = new Date().toLocaleTimeString();
    consoleBox.textContent += `\n[${time}] ${msg}`;
    if (obj) consoleBox.textContent += "\n" + JSON.stringify(obj, null, 2);
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

export function setInvalid(el, invalid) {
    el.setAttribute("aria-invalid", invalid ? "true" : "false");
}

export function validateLength(str, min, max, optional = false) {
    if (optional && !str) return true;
    return typeof str === "string" && str.length >= min && str.length <= max;
}

//Mostrar el nombre del jugador activo solo cuando está en una partida
export function updatePlayerDisplay() {
    const el = document.getElementById("activePlayerName");
    if (el) {
        el.textContent = (player && currentGameId) ? `Jugador: ${player}` : "";
    }
}

/* ---------- Game rules ---------- */
// Cant jugadores, decada -> tamaño grupo
export function groupSizeFor(playersCount, decadeNumber) {
    const t = {
        5: { 1: 2, 2: 3, 3: 2, 4: 3, 5: 3 },
        6: { 1: 2, 2: 3, 3: 4, 4: 3, 5: 4 },
        7: { 1: 2, 2: 3, 3: 3, 4: 4, 5: 4 },
        8: { 1: 3, 2: 4, 3: 4, 4: 5, 5: 5 },
        9: { 1: 3, 2: 4, 3: 4, 4: 5, 5: 5 },
        10: { 1: 3, 2: 4, 3: 4, 4: 5, 5: 5 }
    };
    const row = t[playersCount];
    return row ? row[decadeNumber] : null;
}

// MAPA DE ROLES: [Ciudadanos, Psicópatas]
export const ROLE_MAP = {
    5: [3, 2],
    6: [4, 2],
    7: [4, 3],
    8: [5, 3],
    9: [6, 3],
    10: [6, 4]
};