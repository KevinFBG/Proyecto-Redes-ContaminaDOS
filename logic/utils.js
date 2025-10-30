// logic/utils.js

// Variables de Estado Globales
export let server = "";
export let player = "";
export let currentPassword = "nopass";
export let currentGameId = "";
export let currentRoundId = "";
export let lastGame = null; // para guardar el último estado del juego
export let autoOn = false; // El estado del Autorefresh

// Funciones para modificar el estado
export function setServer(newServer) { server = newServer; }
export function setPlayer(newPlayer) { player = newPlayer; }
export function setCurrentPassword(newPassword) { currentPassword = newPassword; }
export function setCurrentGameId(newId) { currentGameId = newId; }
export function setCurrentRoundId(newId) { currentRoundId = newId; }
export function setLastGame(gameData) { lastGame = gameData; }
export function toggleAutoOn() { autoOn = !autoOn; return autoOn; }

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