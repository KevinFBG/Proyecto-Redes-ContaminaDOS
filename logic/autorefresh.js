// logic/autorefresh.js
 
import { refreshGame } from './game.js';
import { logConsole, toggleAutoOn, autoOn } from './utils.js';

let autoRefresh = null;

export function startAutoRefresh() {
    if (autoRefresh) clearInterval(autoRefresh);
    autoRefresh = setInterval(() => {
        refreshGame();
    }, 5000);
    logConsole("Autorefresh activado (cada 5s)");
}

export function stopAutoRefresh() {
    if (autoRefresh) clearInterval(autoRefresh);
    autoRefresh = null;
    logConsole("Autorefresh desactivado");
}

export function toggleAutoRefresh(e) {
    const newAutoOn = toggleAutoOn();
    const btn = e && e.target ? e.target : null;
    if (btn) btn.textContent = `Autorefresh: ${newAutoOn ? "On" : "Off"}`;
    if (newAutoOn) startAutoRefresh(); else stopAutoRefresh();
}