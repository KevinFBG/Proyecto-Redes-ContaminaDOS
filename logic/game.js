// logic/game.js

import {
    server, player, currentPassword, currentGameId, currentRoundId, lastGame, autoOn,
    setPlayer, setCurrentPassword, setCurrentGameId, setLastGame, setCurrentRoundId,
    logConsole, updatePlayerDisplay, validateLength, setInvalid, groupSizeFor, ROLE_MAP
} from './utils.js';
import { startAutoRefresh, stopAutoRefresh } from './autorefresh.js';

// Normaliza los posibles strings de fase/estado que el servidor puede devolver
function normalizePhase(phase, status) {

    const s = status ? String(status).toLowerCase() : null;
    const ph = phase ? String(phase).toLowerCase() : null;

    if (s) {
        if (s === "waiting-on-leader" || (s.includes("waiting") && s.includes("leader"))) return "proposal";
        if (s === "voting" || s === "vote") return "voting";
        if (s === "waiting-on-group" || (s.includes("waiting") && s.includes("group"))) return "action";
        if (s === "ended") return "ended";
    }

    // Si no hay mapping por 'status', intentar normalizar por 'phase'
    if (ph) {
        if (ph.startsWith("vote")) return "voting"; // vote1, vote2, vote3
        if (ph.startsWith("propos") || ph === "proposal") return "proposal";
        if (ph.startsWith("action") || ph.includes("act")) return "action";
    }

    // Fallback genérico: si contiene 'wait' devolver 'waiting'
    const any = (ph || s || "");
    if (any.includes("wait") || any.includes("waiting")) return "waiting";

    return any;
}

/* ---------- Create/Search ---------- */
export async function createGame() {
    const playerEl = document.getElementById("playerName");
    const nameEl = document.getElementById("gameName");
    const pwdEl = document.getElementById("gamePassword");

    const newPlayer = playerEl.value.trim();
    const name = nameEl.value.trim();
    const password = pwdEl.value.trim();

    setPlayer(newPlayer); // Actualizar la variable global player antes de validar

    const vPlayer = validateLength(player, 3, 20);
    const vName = validateLength(name, 3, 20);
    const vPwd = validateLength(password, 3, 20, true);

    setInvalid(playerEl, !vPlayer);
    setInvalid(nameEl, !vName);
    setInvalid(pwdEl, !(vPwd || !password));

    if (!vPlayer || !vName || !(vPwd || !password)) {
        return alert("Revise longitudes: jugador y nombre (3–20), contraseña (3–20 opcional).");
    }

    const body = { name, owner: player };
    if (password) body.password = password;

    const res = await fetch(`${server}/api/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    logConsole("POST /api/games", data);

    if (res.status === 200) {
        setCurrentGameId(data.data.id);
        setCurrentPassword(password || "nopass"); // store for headers
        
        document.getElementById("playerSection").style.display = "none";
        document.getElementById("gameStatus").style.display = "block";
        document.getElementById("gamesList").style.display = "none";
        updatePlayerDisplay();
        alert(data.msg || "Partida creada.");
        await refreshGame();
         startAutoRefresh();
    } else {
        alert(data.msg || `Error al crear (${res.status})`);
    }
}

export async function searchGame() {
    const name = document.getElementById("searchName").value.trim();
    const status = document.getElementById("searchStatus").value;
    const page = parseInt(document.getElementById("searchPage").value || "0", 10);
    const limit = parseInt(document.getElementById("searchLimit").value || "50", 10);

    const params = new URLSearchParams();
    if (name) params.append("name", name);
    if (status) params.append("status", status);
    if (!isNaN(page) && page >= 0) params.append("page", page);
    if (!isNaN(limit) && limit >= 0 && limit <= 50) params.append("limit", limit);

    const url = `${server}/api/games${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    logConsole("GET /api/games", data);

    const table = document.getElementById("gamesTable");
    table.innerHTML = "";
    (data.data || []).forEach(g => {
        const requiresPassword = !!g.password;
        // Obtener la cantidad de jugadores
        const playerCount = Array.isArray(g.players) ? g.players.length : 0;
        
        //COMPROBAR SI LA PARTIDA ESTÁ LLENA
        const MAX_PLAYERS = 10;
        const isFull = playerCount >= MAX_PLAYERS;
        
        // Configurar el texto y el estado del botón
        const buttonText = isFull ? `LLENO (${playerCount})` : "Entrar";
        const disabledAttr = isFull ? "disabled" : "";


        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${g.id}</td>
        <td>${g.name}</td>
        <td>${playerCount}</td>
        <td>${g.status}</td>
        <td><button onclick="joinGame('${g.id}','${requiresPassword}')" ${disabledAttr}>${buttonText}</button></td>`;
        table.appendChild(row);
    });
    document.getElementById("gamesList").style.display = "block";
}

/* ---------- Join (skip for owner) ---------- */
export async function joinGame(gameId, requiresPassword, owner) {
    const playerEl = document.getElementById("playerName");
    const newPlayer = playerEl.value.trim();
    setPlayer(newPlayer); // Actualizar la variable global

    const vPlayer = validateLength(player, 3, 20);
    setInvalid(playerEl, !vPlayer);
    if (!vPlayer) return alert("Ingrese su nombre de jugador (3–20).");

    let pass = "nopass"; // default no password

    // El HTML pasa true como string, verificar ambos
    if (requiresPassword === true || requiresPassword === "true") { 
        pass = prompt("La partida tiene contraseña. Ingrésela:") || "";
        const vPwd = validateLength(pass, 3, 20);
        if (!vPwd) return alert("La contraseña debe tener entre 3 y 20 caracteres.");
    }
    setCurrentPassword(pass);

    const res = await fetch(`${server}/api/games/${gameId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "player": player, "password": pass },
        body: JSON.stringify({ player, password: pass })
    });

    const data = await res.json().catch(() => ({}));
    logConsole(`PUT /api/games/${gameId}/`, data);

    if (res.ok) {
        setCurrentGameId(gameId);
        alert(data.msg || "Unido correctamente a la partida.");
        document.getElementById("playerSection").style.display = "none";
        document.getElementById("gamesList").style.display = "none";
        document.getElementById("gameStatus").style.display = "block";
        updatePlayerDisplay();

        await refreshGame();
        if (autoOn) startAutoRefresh();
    } else {
        alert(data.msg || `Error (${res.status}) — Verifique la contraseña o el nombre exacto del jugador.`);
    }
}

/* ---------- Start ---------- */
export async function startGame() {
    if (!currentGameId) return alert("No hay partida seleccionada.");
    const res = await fetch(`${server}/api/games/${currentGameId}/start`, {
        method: "HEAD",
        headers: { "player": player, "password": currentPassword }
    });
    logConsole(`HEAD /api/games/${currentGameId}/start`, { status: res.status });
    if (res.ok) {
        alert("Partida iniciada");
        await new Promise(resolve => setTimeout(resolve, 500));
            // Actualizar el estado del juego primero para poblar `lastGame`, luego obtener rondas
            await refreshGame();
            await getRounds();
            document.getElementById("roundSection").style.display = "block";
        // Ocultar el botón de iniciar inmediatamente para el owner
        const startBtnEl = document.getElementById("startBtn");
        if (startBtnEl) startBtnEl.style.display = "none";
    } else {
        alert(`No se pudo iniciar (${res.status})`);
        
    }
    await refreshGame();
}

/* ---------- Status, rounds, and UI ---------- */
export async function refreshGame() {
    if (!currentGameId) return;
    const res = await fetch(`${server}/api/games/${currentGameId}/`, {
        headers: { "player": player, "password": currentPassword }
    });
    const data = await res.json().catch(() => ({}));
    logConsole(`GET /api/games/${currentGameId}/`, data);

    if (!res.ok) return;

    const g = data.data;
    setLastGame(g); // Almacenar el estado del juego para funciones posteriores
    const playerCount = Array.isArray(g.players) ? g.players.length : 0;

    // Elementos UI
    const startBtn = document.getElementById("startBtn");
    const roundSection = document.getElementById("roundSection");
    const decadePill = document.getElementById("decadePill");
    const scorePill = document.getElementById("scorePill");
    const leaderPill = document.getElementById("leaderPill");
    const enemiesPill = document.getElementById("enemiesPill");
    const groupSizeHint = document.getElementById("groupSizeHint");
    const startHint = document.getElementById('startHint');
    const btns = {
        propose: document.getElementById("btnPropose"),
        vote: document.getElementById("btnVote"),
        collab: document.getElementById("btnCollab"),
        sabot: document.getElementById("btnSabot")
    };

    const isOwner = (g.owner === player);

    // Determinar si el jugador es psicópata (enemy).
    const isEnemy = Array.isArray(g.enemies) && g.enemies.includes(player);

    // Considerar ambos estados como "partida iniciada"
    const started = (g.status === "started" || g.status === "rounds");

    // Solo mostrar el botón de iniciar si soy el owner y la partida aún NO ha empezado
    if (startBtn) startBtn.style.display = (!started && isOwner) ? "inline-block" : "none";
    // Mostrar el hint de inicio solo cuando estemos en el lobby
    if (startHint) startHint.style.display = (g.status === 'lobby') ? 'block' : 'none';

    // Mostrar solo nombre y jugadores + estado (no roles) hasta iniciar
    const statusEl = document.getElementById("statusBox");
    statusEl.textContent = `Partida: ${g.name} | Jugadores: ${g.players.join(", ")} | Estado: ${g.status}`;

    // Habilitar/deshabilitar botón de inicio (si está visible)
    const canStartByCount = playerCount >= 5 && playerCount <= 10;
    if (startBtn) startBtn.disabled = !(isOwner && canStartByCount && g.status === "lobby");

    // Mostrar/ocultar toda la sección de rondas según estado
    if (roundSection) roundSection.style.display = started ? "block" : "none";

    // Si la partida NO está iniciada: si el juego terminó mostrar las rondas y el banner de ganador,
    // si no terminó, limpiar info de rondas y roles como antes.
    if (!started) {
        if (g.status === 'ended') {
            // Mostrar la sección de rondas para poder ver historial y banner
            if (roundSection) roundSection.style.display = "block";
            // Llamar a getRounds para poblar historial y mostrar banner de ganador si aplica
            await getRounds();
            return;
        }

    if (decadePill) decadePill.style.display = "none";
    if (scorePill) scorePill.style.display = "none";
    if (leaderPill) leaderPill.style.display = "none";
    if (enemiesPill) enemiesPill.style.display = "none";
    if (groupSizeHint) groupSizeHint.style.display = "none";
        Object.values(btns).forEach(b => { if (b) { b.style.display = "none"; b.disabled = false; } });
        setCurrentRoundId("");
        return;
    }

    // Si la partida está iniciada: mostrar roles/rondas y poblar datos
    if (decadePill) decadePill.style.display = "inline-block";
    if (scorePill) scorePill.style.display = "inline-block";
    if (groupSizeHint) groupSizeHint.style.display = "block";

    // Ocultar todos los botones de acción hasta que getRounds determine cuál mostrar
    Object.values(btns).forEach(b => { if (b) { b.style.display = "none"; b.disabled = false; } });

    // Mostrar rol si el servidor provee 'enemies' 
    if (g.enemies && started) {
        const roles = ROLE_MAP[playerCount];
        const roleText = isEnemy ? " | Rol: Psicopata" : " | Rol: Ejemplar";
        const totalRoles = roles ? ` | Total Roles: E=${roles[0]} / P=${roles[1]}` : "";
        statusEl.textContent += roleText + totalRoles;

        // Si soy psicópata, mostrar la lista de otros psicópatas
        if (isEnemy && enemiesPill) {
            const others = g.enemies.filter(n => n !== player);
            enemiesPill.textContent = others.length ? `Otros psicópatas: ${others.join(", ")}` : `Eres psicópata (sin otros conocidos)`;
            enemiesPill.style.display = "inline-block";
        } else if (enemiesPill) {
            enemiesPill.style.display = "none";
        }
    } else {
        if (enemiesPill) enemiesPill.style.display = "none";
    }

    // Llamar a getRounds() para la info de rondas y actualizar botones de acción
    await getRounds();
}

export async function getRounds() {
    if (!currentGameId) return;
    const res = await fetch(`${server}/api/games/${currentGameId}/rounds`, {
        headers: { "player": player, "password": currentPassword }
    });

    const data = await res.json().catch(() => ({}));
    logConsole(`GET /api/games/${currentGameId}/rounds`, data);

    if (!res.ok) return;

    const rounds = data.data || [];
    // Usar helper para obtener rondas en orden cronológico ascendente
    let displayRounds = sortRoundsAsc(rounds.slice());

    // Determinar la ronda "activa" más reciente (no 'ended').
    // Preferir la ronda más reciente que no haya terminado.
    let lastRound = displayRounds[displayRounds.length - 1];
    for (let i = displayRounds.length - 1; i >= 0; i--) {
        const cand = displayRounds[i];
        if (normalizePhase(cand.phase, cand.status) !== 'ended') {
            lastRound = cand;
            break;
        }
    }

    // Referencias a los botones de acción
    const btns = {
        propose: document.getElementById("btnPropose"),
        vote: document.getElementById("btnVote"),
        collab: document.getElementById("btnCollab"),
        sabot: document.getElementById("btnSabot")
    };
    
    // Ocultar todos los botones primero
    Object.values(btns).forEach(b => { if (b) b.style.display = "none"; });

    // No hay rondas activas
    if (rounds.length === 0 || !lastRound) {
        const decadeEl = document.getElementById("decadePill"); if (decadeEl) decadeEl.textContent = "Década: 0";
        const scoreEl = document.getElementById("scorePill"); if (scoreEl) scoreEl.textContent = "Puntaje — Ejemplares: 0 | Psicópatas: 0";
        const groupSizeEl = document.getElementById("groupSizeHint"); if (groupSizeEl) groupSizeEl.textContent = "Tamaño requerido de grupo: —";
        setCurrentRoundId("");
        return;
    }

    // Usar la ronda más reciente para el estado
    const currentRound = lastRound;
    setCurrentRoundId(currentRound.id);

    // Normalizar la fase 
    const canonicalPhase = normalizePhase(currentRound.phase, currentRound.status);

    // Década actual (1..5, corresponde al número de ronda)
    const decade = displayRounds.length;

    // Puntajes 
    const citizensWins = displayRounds.filter(r => r.result === "citizens").length;
    const enemiesWins = displayRounds.filter(r => r.result === "enemies").length;

    // Mostrar información de ronda en la tabla de historial
    const decadeEl2 = document.getElementById("decadePill"); if (decadeEl2) decadeEl2.textContent = `Década: ${decade}`;
  
    const scorePillEl = document.getElementById("scorePill"); if (scorePillEl) scorePillEl.textContent = `Puntaje — Ejemplares: ${citizensWins} | Psicópatas: ${enemiesWins}`;
    
    // Mostrar al dirigente comunal
    const leaderPillEl = document.getElementById('leaderPill');
    if (leaderPillEl) {
        leaderPillEl.textContent = `Dirigente comunal: ${currentRound.leader}`;
        leaderPillEl.style.display = "inline-block";
    }

    // Mostrar tamaño de grupo esperado
    const playersCount = Array.isArray(lastGame?.players) ? lastGame.players.length : 0;
    const requiredSize = groupSizeFor(playersCount, Math.min(decade, 5));
    document.getElementById("groupSizeHint").textContent =
        `Tamaño requerido de grupo: ${requiredSize ?? "—"} (jugadores: ${playersCount})`;

    // Renderizar historial completo de rondas en la sección 'roundsHistory'
    try {
        const historyEl = document.getElementById('roundsHistory');
        if (historyEl) {
            if (!rounds || rounds.length === 0) {
                historyEl.innerHTML = '<div class="hint">No hay rondas registradas.</div>';
            } else {
                // Construir una tabla con todas las rondas (1..N)
                const rows = displayRounds.map((r, i) => {
                    const num = i + 1;
                    const leader = r.leader || '—';
                    const status = r.status || '—';
                    const phase = r.phase || '—';
                    const canonical = normalizePhase(r.phase, r.status);
                    // Intento de votación: vote1 -> 1, vote2 -> 2, vote3 -> 3 
                    let intento = '—';
                    const ph = (r.phase || '').toString().toLowerCase();
                    const m = ph.match(/vote\s*-?\s*(\d+)/i) || ph.match(/vote(\d+)/i);
                    if (m && m[1]) intento = parseInt(m[1], 10);
                    const group = Array.isArray(r.group) ? r.group.join(', ') : (r.group || '—');
                    const rawResult = r.result || 'none';
                    const result = rawResult === 'citizens' ? 'Ejemplares' : (rawResult === 'enemies' ? 'Psicópatas' : 'Pendiente');
                    const votes = Array.isArray(r.votes) ? r.votes.length : (r.votes ? r.votes.length : 0);
                    return `
                        <tr>
                            <td>${num}</td>
                            <td>${leader}</td>
                            <td>${status}</td>
                            <td>${phase}</td>
                            <td>${intento}</td>
                            <td>${group}</td>
                            <td>${result}</td>
                            <td>${votes}</td>
                        </tr>`;
                }).join('\n');

                historyEl.innerHTML = `
                    <table class="rounds-table" style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f3f6f4;">
                                <th># Ronda</th>
                                <th>Líder</th>
                                <th>Estado</th>
                                <th>Fase</th>
                                <th>Intentos</th>
                                <th>Grupo</th>
                                <th>Resultado</th>
                                <th>Votos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>`;
                // Resaltar y hacer scroll hacia la última fila (más reciente)
                setTimeout(() => {
                    try {
                        const tbody = historyEl.querySelector('tbody');
                        if (tbody && tbody.lastElementChild) {
                            const lastRow = tbody.lastElementChild;
                            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // aplicar highlight temporal
                            const prevBg = lastRow.style.background;
                            lastRow.style.background = 'rgba(255, 235, 59, 0.18)';
                            setTimeout(() => { lastRow.style.transition = 'background 600ms'; lastRow.style.background = prevBg; }, 1200);
                        }
                    } catch (e) { /* no bloquear UI */ }
                }, 80);
            }
        }
    } catch (err) {
        console.warn('Error renderizando historial de rondas', err);
    }

    // Lógica para mostrar los botones de acción
    const isLeader = currentRound.leader === player;
    const isGroupMember = currentRound.group?.includes(player);
    const isEnemy = Array.isArray(lastGame?.enemies) && lastGame.enemies.includes(player);
    
    // Ocultar todos los botones primero
    Object.values(btns).forEach(b => { if (b) b.style.display = "none"; });

    // Usar la fase normalizada para determinar qué botones mostrar
    switch (canonicalPhase) {
        case "proposal":
            if (isLeader && btns.propose) {
                btns.propose.style.display = "inline-block";
                btns.propose.disabled = false;
            }
            break;
        case "voting":
            // Verificar si el jugador ya votó
            const hasVoted = currentRound.votes?.find(v => v.player === player);
            if (!hasVoted && btns.vote) {
                btns.vote.style.display = "inline-block";
                btns.vote.disabled = false;
            }
            break;
        case "action":
            if (isGroupMember) {
                // Verificar si el jugador ya actuó
                const hasActed = currentRound.actions?.find(a => a.player === player);
                if (!hasActed) {
                    if (btns.collab) btns.collab.style.display = "inline-block";
                    if (btns.sabot) btns.sabot.style.display = isEnemy ? "inline-block" : "none";
                }
            }
            break;
    }


    //  Verificar si alguien ya ganó (3 puntos)
    const partidaTerminada = citizensWins >= 3 || enemiesWins >= 3;
    if (partidaTerminada) {
        const ganador = citizensWins >= 3 ? { text: "¡Los Ejemplares ganaron la partida!", css: { background: '#e8f5e9', color: '#1b5e20' } }
            : { text: "¡Los Psicópatas ganaron la partida!", css: { background: '#ffebee', color: '#b71c1c' } };

        // Mostrar banner de ganador en la UI
        const winnerEl = document.getElementById('gameWinner');
        if (winnerEl) {
            winnerEl.textContent = (citizensWins >= 3) ? `🎉 ${ganador.text}` : `💀 ${ganador.text}`;
            winnerEl.style.display = 'block';
            // aplicar colores según bando
            winnerEl.style.background = ganador.css.background;
            winnerEl.style.color = ganador.css.color;
        }

        logConsole("Partida finalizada", { citizensWins, enemiesWins });
        stopAutoRefresh();
        // Deshabilitar botones interactivos 
        document.querySelectorAll("button").forEach(b => {
            if (b.id !== "startBtn" && b.id !== "searchBtn" && !b.textContent.includes("Autorefresh")) {
                b.disabled = true;
            }
        });
    }
}

export async function proposeGroup() {
    if (!currentGameId || !lastGame) return alert("Primero obtén el estado del juego.");

    // Obtener la ronda actual para saber quién es el líder
    const roundsRes = await fetch(`${server}/api/games/${currentGameId}/rounds`, {
        headers: { "player": player, "password": currentPassword }
    });
    const roundsData = await roundsRes.json().catch(() => ({}));
    if (!roundsData.data || roundsData.data.length === 0) {
        return alert("No hay rondas activas para proponer un grupo.");
    }
    // Asegurarse de usar la misma ordenación cronológica que getRounds()
    const sorted = sortRoundsAsc(roundsData.data.slice());
    // Buscar la ronda que esté en fase de propuesta del líder
    let currentRound = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
        const r = sorted[i];
        if (normalizePhase(r.phase, r.status) === 'proposal') { currentRound = r; break; }
    }
    // Si no encontramos una ronda en 'proposal', usar la más reciente como fallback.
    if (!currentRound) currentRound = sorted[sorted.length - 1];

    // Solo el líder de la ronda puede proponer
    if (currentRound.leader !== player) {
        return alert(`Solo el líder (${currentRound.leader}) puede proponer un grupo.`);
    }

    // Calcular el tamaño de grupo requerido
    const playersCount = lastGame.players.length;
    const decade = roundsData.data.length; // Número de ronda = década
    const requiredSize = groupSizeFor(playersCount, decade);

    if (!requiredSize) {
        return alert(`No se pudo determinar el tamaño de grupo para ${playersCount} jugadores en la década ${decade}.`);
    }




    // Mostrar una casilla por cada jugador para seleccionar el grupo
    const existingModal = document.getElementById('proposeModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'proposeModal';
    modal.className = 'modal';

    const panel = document.createElement('div');
    panel.className = 'modal-panel';

    const title = document.createElement('h3');
    title.textContent = `Proponer grupo — selecciona ${requiredSize} miembro(s)`;
    panel.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.style.marginTop = '0';
    hint.textContent = 'Marca los jugadores que formarán parte del grupo. Elige exactamente la cantidad requerida.';
    panel.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'propose-list';

    // Crear una casilla por cada jugador 
    (lastGame.players || []).forEach((pl, idx) => {
        const lab = document.createElement('label');
        lab.className = 'propose-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = pl;
        cb.id = `propose_cb_${idx}`;

        const span = document.createElement('span');
        span.textContent = pl;

        lab.appendChild(cb);
        lab.appendChild(span);
        list.appendChild(lab);
    });
    panel.appendChild(list);

    const errorLine = document.createElement('div');
    errorLine.className = 'error-line';
    panel.appendChild(errorLine);

    const actions = document.createElement('div');
    actions.className = 'propose-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.onclick = () => modal.remove();

    const submitBtn = document.createElement('button');
    submitBtn.textContent = 'Proponer';
    submitBtn.style.fontWeight = '600';
    submitBtn.onclick = async () => {
        const checked = Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
        if (checked.length !== requiredSize) {
            errorLine.textContent = `Selecciona exactamente ${requiredSize} miembro(s). Actualmente: ${checked.length}.`;
            return;
        }

        // Verificar que los nombres seleccionados existan en la lista de jugadores
        const invalid = checked.filter(n => !(lastGame.players || []).includes(n));
        if (invalid.length) {
            errorLine.textContent = `Nombres inválidos: ${invalid.join(', ')}`;
            return;
        }

        // Construir grupo final y enviar la petición
        const finalGroup = checked;
        // Deshabilitar botón para evitar doble envío
        submitBtn.disabled = true;
        logConsole('Proponiendo grupo (UI):', finalGroup);
        try {
            const res = await fetch(`${server}/api/games/${currentGameId}/rounds/${currentRound.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'player': player, 'password': currentPassword },
                body: JSON.stringify({ group: finalGroup })
            });
            const data = await res.json().catch(() => ({}));
            logConsole(`PATCH /api/games/${currentGameId}/rounds/${currentRound.id}`, data);
            if (res.ok) {
                alert(data.msg || 'Grupo propuesto correctamente.');
                modal.remove();
                await new Promise(resolve => setTimeout(resolve, 500));
                await refreshGame();
                await new Promise(resolve => setTimeout(resolve, 500));
                await refreshGame();
            } else {
                errorLine.textContent = data.msg || `Error al proponer el grupo (${res.status}).`;
                submitBtn.disabled = false;
            }
        } catch (err) {
            errorLine.textContent = 'Error de red al enviar la propuesta.';
            submitBtn.disabled = false;
            console.error(err);
        }
    };

    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    panel.appendChild(actions);

    modal.appendChild(panel);
    document.body.appendChild(modal);

    // Auto-focus: scroll to leader and if present, focus leader checkbox
    const leaderIdx = (lastGame.players || []).indexOf(player);
    if (leaderIdx >= 0) {
        const leaderCb = document.getElementById(`propose_cb_${leaderIdx}`);
        if (leaderCb) leaderCb.focus();
    }

    // El envío se realiza desde el modal; no ejecutar lógica extra aquí.
}


export async function voteGroup() {
    if (!currentGameId || !currentRoundId) return alert("Primero obtén el juego.");

    // Obtener rondas
    const roundsRes = await fetch(`${server}/api/games/${currentGameId}/rounds`, {
        headers: { "player": player, "password": currentPassword }
    });
    const roundsData = await roundsRes.json();
    const rounds = roundsData.data || [];
    // Ordenar las rondas y buscar la ronda que esté en votación 
    const sorted = sortRoundsAsc(rounds.slice());
    // Preferir la ronda con fase 'voting'
    let currentVotingRound = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
        const r = sorted[i];
        if (normalizePhase(r.phase, r.status) === 'voting') { currentVotingRound = r; break; }
    }
    // si currentRoundId coincide con una ronda de 'voting'
    if (!currentVotingRound) {
        currentVotingRound = sorted.find(r => r.id === currentRoundId && normalizePhase(r.phase, r.status) === 'voting');
    }
    if (!currentVotingRound) {
        return alert("No hay ninguna ronda en votación actualmente.");
    }

    // Mostrar un modal con botones Aceptar / Rechazar en lugar de confirm()
    const existing = document.getElementById('voteModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'voteModal';
    modal.className = 'modal';

    const panel = document.createElement('div');
    panel.className = 'modal-panel';

    const title = document.createElement('h3');
    title.textContent = 'Votación de grupo';
    panel.appendChild(title);

    const msg = document.createElement('p');
    msg.textContent = `¿Votar a favor del grupo: ${currentVotingRound.group?.join(', ')}?`;
    panel.appendChild(msg);

    const info = document.createElement('p');
    info.className = 'hint';
    info.style.marginTop = '0.2rem';
    info.textContent = 'Pulsa Aceptar para votar sí, o Rechazar para votar no.';
    panel.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'propose-actions';

    const btnNo = document.createElement('button');
    btnNo.textContent = 'Rechazar';
    btnNo.onclick = async () => {
        await sendVote(false);
        modal.remove();
    };

    const btnYes = document.createElement('button');
    btnYes.textContent = 'Aceptar';
    btnYes.style.fontWeight = '600';
    btnYes.onclick = async () => {
        await sendVote(true);
        modal.remove();
    };

    actions.appendChild(btnNo);
    actions.appendChild(btnYes);
    panel.appendChild(actions);

    modal.appendChild(panel);
    document.body.appendChild(modal);

    async function sendVote(vote) {
        try {
            const res = await fetch(`${server}/api/games/${currentGameId}/rounds/${currentVotingRound.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'player': player, 'password': currentPassword },
                body: JSON.stringify({ vote })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                // Mostrar feedback mínimo sin alertas
                const smallMsg = document.createElement('div');
                smallMsg.className = 'hint';
                smallMsg.textContent = data.msg || 'Voto registrado.';
                panel.appendChild(smallMsg);
                await refreshGame();
            } else {
                const err = document.createElement('div');
                err.className = 'error-line';
                err.textContent = data.msg || `Error (${res.status})`;
                panel.appendChild(err);
            }
        } catch (err) {
            const e = document.createElement('div');
            e.className = 'error-line';
            e.textContent = 'Error de red al enviar el voto.';
            panel.appendChild(e);
            console.error(err);
        }
    }
}


export async function sendAction(action) {
    if (!currentRoundId) return alert("Primero obtén la ronda.");

    // impedir que ciudadanos envíen la acción de sabotear
    const isEnemyLocal = Array.isArray(lastGame?.enemies) && lastGame.enemies.includes(player);
    if (action === false && !isEnemyLocal) {
        return alert("No tienes permiso para sabotear (no eres psicópata).");
    }

    const res = await fetch(`${server}/api/games/${currentGameId}/rounds/${currentRoundId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "player": player, "password": currentPassword },
        body: JSON.stringify({ action })
    });
    const data = await res.json().catch(() => ({}));
    logConsole(`PUT /api/games/${currentGameId}/rounds/${currentRoundId}`, data);
    alert(data.msg || (res.ok ? "Acción enviada" : `Error (${res.status})`));
    await refreshGame();
}

// Ordena un array de rondas cronológicamente 
function sortRoundsAsc(rounds) {
    if (!Array.isArray(rounds)) return [];
    const copy = rounds.slice();
    if (copy.length <= 1) return copy;

    const hasCreatedAt = copy.every(r => r && (r.createdAt || r.created_at || r.created));
    if (hasCreatedAt) {
        copy.sort((a, b) => {
            const ta = a.createdAt || a.created_at || a.created;
            const tb = b.createdAt || b.created_at || b.created;
            const da = isNaN(Date.parse(ta)) ? 0 : Date.parse(ta);
            const db = isNaN(Date.parse(tb)) ? 0 : Date.parse(tb);
            return da - db;
        });
        return copy;
    }

    const allId24 = copy.every(r => r && typeof r.id === 'string' && /^[0-9a-fA-F]{24}$/.test(r.id));
    if (allId24) {
        copy.sort((a, b) => {
            const ta = parseInt(a.id.substring(0, 8), 16);
            const tb = parseInt(b.id.substring(0, 8), 16);
            return ta - tb;
        });
        return copy;
    }

    const first = copy[0];
    const last = copy[copy.length - 1];
    const firstActive = (first && (first.result === 'none' || normalizePhase(first.phase, first.status) !== 'ended'));
    const lastActive = (last && (last.result === 'none' || normalizePhase(last.phase, last.status) !== 'ended'));
    if (firstActive && !lastActive) return copy.reverse();
    return copy;
}