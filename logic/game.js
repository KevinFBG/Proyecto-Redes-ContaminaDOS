// logic/game.js

import {
    server, player, currentPassword, currentGameId, currentRoundId, lastGame, autoOn,
    setPlayer, setCurrentPassword, setCurrentGameId, setLastGame, setCurrentRoundId,
    logConsole, updatePlayerDisplay, validateLength, setInvalid, groupSizeFor, ROLE_MAP
} from './utils.js';
import { startAutoRefresh, stopAutoRefresh } from './autorefresh.js';

/* ---------- Create/Search ---------- */
export async function createGame() {
    const playerEl = document.getElementById("playerName");
    const nameEl = document.getElementById("gameName");
    const pwdEl = document.getElementById("gamePassword");

    const newPlayer = playerEl.value.trim();
    const name = nameEl.value.trim();
    const password = pwdEl.value.trim();

    setPlayer(newPlayer); // Actualizar la variable global 'player' antes de validar

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
        if (autoOn) startAutoRefresh();
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
        // Nota: se convierte requiresPassword a string porque se pasa al HTML
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
export async function joinGame(gameId, owner, requiresPassword) {
    const playerEl = document.getElementById("playerName");
    const newPlayer = playerEl.value.trim();
    setPlayer(newPlayer); // Actualizar la variable global

    const vPlayer = validateLength(player, 3, 20);
    setInvalid(playerEl, !vPlayer);
    if (!vPlayer) return alert("Ingrese su nombre de jugador (3–20).");

    // // Si es el dueño, fuerza unirse   
    // if (owner === player) {
    //     alert("Eres el dueño de la partida, ya estás dentro.");
    //     setCurrentGameId(gameId);
    //     document.getElementById("playerSection").style.display = "none";
    //     document.getElementById("gamesList").style.display = "none";
    //     document.getElementById("gameStatus").style.display = "block";
    //     updatePlayerDisplay();

    //     await refreshGame();
    //     if (autoOn) startAutoRefresh();
    //     return;
    // }

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
        getRounds();
        refreshGame();
        document.getElementById("roundSection").style.display = "block";
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
    const phasePill = document.getElementById("phasePill");
    const enemiesPill = document.getElementById("enemiesPill");
    const roundInfo = document.getElementById("roundInfo");
    const groupSizeHint = document.getElementById("groupSizeHint");
    const btns = {
        propose: document.getElementById("btnPropose"),
        vote: document.getElementById("btnVote"),
        collab: document.getElementById("btnCollab"),
        sabot: document.getElementById("btnSabot")
    };

    const isOwner = (g.owner === player);

    // Determinar si el jugador es psicópata (enemy).
    const isEnemy = Array.isArray(g.enemies) && g.enemies.includes(player);

    // Solo el owner ve el botón de iniciar
    if (startBtn) startBtn.style.display = isOwner ? "inline-block" : "none";

    // Considerar ambos estados como "partida iniciada"
    const started = (g.status === "started" || g.status === "rounds");
    const ended = (g.status === "ended");
    // Mostrar solo nombre y jugadores + estado (no roles) hasta iniciar
    const statusEl = document.getElementById("statusBox");
    statusEl.textContent = `Partida: ${g.name} | Jugadores: ${g.players.join(", ")} | Estado: ${g.status} `;

    // Habilitar/deshabilitar botón de inicio (si está visible)
    const canStartByCount = playerCount >= 5 && playerCount <= 10;
    if (startBtn) startBtn.disabled = !(isOwner && canStartByCount && g.status === "lobby");

    // Mostrar/ocultar toda la sección de rondas según estado
    if (roundSection) roundSection.style.display = started ? "block" : "none";

    // Si la partida NO está iniciada: limpiar info de rondas y roles
    if (!started) {
        if (decadePill) decadePill.style.display = "none";
        if (scorePill) scorePill.style.display = "none";
        if (phasePill) phasePill.style.display = "none";
        if (enemiesPill) enemiesPill.style.display = "none";
        if (roundInfo) roundInfo.textContent = "";
        if (groupSizeHint) groupSizeHint.style.display = "none";
        Object.values(btns).forEach(b => { if (b) { b.style.display = "none"; b.disabled = false; } });
        setCurrentRoundId("");
        return;
    }

    // Si la partida está iniciada: mostrar roles/rondas y poblar datos
    if (decadePill) decadePill.style.display = "inline-block";
    if (scorePill) scorePill.style.display = "inline-block";
    if (phasePill) phasePill.style.display = "inline-block";
    if (groupSizeHint) groupSizeHint.style.display = "block";

    // Ocultar todos los botones de acción hasta que getRounds determine cuál mostrar
    Object.values(btns).forEach(b => { if (b) { b.style.display = "none"; b.disabled = false; } });

    // Mostrar rol si el servidor provee 'enemies' 
    if (g.enemies && started) {
        const roles = ROLE_MAP[playerCount];
        const roleText = isEnemy ? " | Rol: Psicopata" : " | Rol: Ciudadano";
        const totalRoles = roles ? ` | Total Roles: C=${roles[0]} / P=${roles[1]}` : "";
        statusEl.textContent += roleText + totalRoles;

        // Si soy psicópata, mostrar la lista de otros psicópatas (excluyendo mi nombre)
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

    // Llamar a getRounds() para poblar la info de rondas y actualizar botones de acción
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
    const lastRound = rounds[rounds.length - 1];

    // Referencias a los botones de acción
    const btns = {
        propose: document.getElementById("btnPropose"),
        vote: document.getElementById("btnVote"),
        collab: document.getElementById("btnCollab"),
        sabot: document.getElementById("btnSabot")
    };

    // Ocultar todos los botones primero
    //Object.values(btns).forEach(b => { if (b) b.style.display = "none"; });

    // No hay rondas activas
    if (rounds.length === 0 || !lastRound) {
        document.getElementById("roundInfo").textContent = "No hay rondas activas todavía.";
        document.getElementById("decadePill").textContent = "Década: 0";
        document.getElementById("phasePill").textContent = "Fase: —";
        document.getElementById("scorePill").textContent = "Puntaje — Ciudadanos: 0 | Psicópatas: 0";
        document.getElementById("groupSizeHint").textContent = "Tamaño requerido de grupo: —";
        setCurrentRoundId("");
        return;
    }

    // Usar la ronda más reciente para el estado
    const currentRound = rounds.find(r => r.result === "none") || lastRound;
    setCurrentRoundId(currentRound.id);

    // Década actual (1..5, corresponde al número de ronda)
    const decade = rounds.length;

    // Puntajes
    const citizensWins = rounds.filter(r => r.result === "citizens").length;
    const enemiesWins = rounds.filter(r => r.result === "enemies").length;

    // Mostrar información de ronda
    document.getElementById("roundIdDisplay").textContent = `ID de Ronda: ${currentRound.id}`;
    document.getElementById("roundInfo").textContent =
        `Ronda: ${currentRound.id} | Líder: ${currentRound.leader} | Estado: ${currentRound.status} | Fase: ${currentRound.phase} | Grupo: ${currentRound.group?.join(", ") || "ninguno"}`;
    document.getElementById("decadePill").textContent = `Década: ${decade}`;
    document.getElementById("phasePill").textContent = `Fase: ${currentRound.phase}`;
    document.getElementById("scorePill").textContent = `Puntaje — Ciudadanos: ${citizensWins} | Psicópatas: ${enemiesWins}`;

    // Mostrar tamaño de grupo esperado
    const playersCount = Array.isArray(lastGame?.players) ? lastGame.players.length : 0;
    const requiredSize = groupSizeFor(playersCount, Math.min(decade, 5));
    document.getElementById("groupSizeHint").textContent =
        `Tamaño requerido de grupo: ${requiredSize ?? "—"} (jugadores: ${playersCount})`;

    // Lógica para mostrar los botones de acción
    const isLeader = currentRound.leader === player;
    const isGroupMember = currentRound.group?.includes(player);
    const isEnemy = Array.isArray(lastGame?.enemies) && lastGame.enemies.includes(player);

    // Ocultar todos los botones primero
    Object.values(btns).forEach(b => { if (b) b.style.display = "none"; });

    switch (currentRound.status) {
        case "waiting-on-leader":
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

        case "waiting-on-group":
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

const partidaTerminada = citizensWins >= 3 || enemiesWins >= 3;

    if (partidaTerminada) {
        const statusEl = document.getElementById("statusBox"); // Acceder al elemento
        
        const ganador = citizensWins >= 3 
            ? "Ganador: 🎉 ¡Los Ciudadanos ganaron la partida!" 
            : "Ganador: 💀 ¡Los Psicópatas ganaron la partida!";
        statusEl.textContent += ` | ${ganador}`;

        logConsole("Partida finalizada", { citizensWins, enemiesWins });
        stopAutoRefresh();


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
    const currentRound = roundsData.data[roundsData.data.length - 1]; // Última ronda

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




    // Pedir al usuario los miembros del grupo
    const promptMessage = `Eres el líder. Se necesita un grupo de ${requiredSize} en total. 
    Ingresa **todos** los nombres de los miembros del grupo, separados por comas (puedes incluirte o no).`;

    const membersInput = prompt(promptMessage);
    if (membersInput === null) return; // El usuario canceló

    // Procesar y validar la entrada
    const proposedMembers = membersInput.split(',').map(name => name.trim()).filter(Boolean);

    // // 1. El líder no debe estar en la lista de 'otros miembros'
    // const leaderInProposed = proposedMembers.includes(player);
    // if (leaderInProposed) {
    //     return alert("Error: No incluyas tu nombre en la lista de 'otros miembros'. El líder ya se incluye automáticamente.");
    // }

    // 1. Verificar el tamaño total del grupo
    if (proposedMembers.length !== requiredSize) {
        return alert(`Error: Se requieren ${requiredSize} miembros en total, pero has propuesto un grupo de ${proposedMembers.length}. Inténtalo de nuevo.`);
    }

    // 2. Verificar duplicados
    const memberSet = new Set(proposedMembers);
    if (memberSet.size !== proposedMembers.length) {
        return alert("Error: La lista de 'otros miembros' contiene nombres duplicados.");
    }

    // 3. Verificar que sean jugadores válidos
    const invalidMembers = proposedMembers.filter(member => !lastGame.players.includes(member));
    if (invalidMembers.length > 0) {
        return alert(`Error: Los siguientes nombres no son jugadores válidos en la partida: ${invalidMembers.join(', ')}.`);
    }

    // // Construir el grupo final, incluyendo al líder
    // const finalGroup = [player, ...proposedMembers];
    const finalGroup = proposedMembers;


    if (finalGroup.length !== requiredSize) {
        return alert(`Error: Se requieren ${requiredSize} miembros en total, pero has propuesto un grupo de ${finalGroup.length}. Inténtalo de nuevo.`);
    }

    // Enviar la propuesta
    logConsole("Proponiendo grupo:", finalGroup);
    const res = await fetch(`${server}/api/games/${currentGameId}/rounds/${currentRound.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "player": player, "password": currentPassword },
        body: JSON.stringify({ group: finalGroup })
    });

    const data = await res.json().catch(() => ({}));
    logConsole(`PATCH /api/games/${currentGameId}/rounds/${currentRound.id}`, data);

    if (res.ok) {
        alert(data.msg || "Grupo propuesto correctamente.");
        await refreshGame();
    } else {
        alert(data.msg || `Error al proponer el grupo (${res.status}).`);
    }
}


export async function voteGroup() {
    if (!currentGameId || !currentRoundId) return alert("Primero obtén el juego.");

    // Obtener rondas
    const roundsRes = await fetch(`${server}/api/games/${currentGameId}/rounds`, {
        headers: { "player": player, "password": currentPassword }
    });
    const roundsData = await roundsRes.json();
    const rounds = roundsData.data || [];

    // Buscar la ronda que este en votacion
    const currentVotingRound = rounds.find(r => r.id === currentRoundId && r.status === "voting");
    if (!currentVotingRound) {
        return alert("No hay ninguna ronda en votación actualmente.");
    }

    // Preguntar al jugador
    const vote = confirm(`¿Votar a favor del grupo: ${currentVotingRound.group?.join(', ')}?`);

    // Enviar voto
    const res = await fetch(`${server}/api/games/${currentGameId}/rounds/${currentVotingRound.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "player": player, "password": currentPassword },
        body: JSON.stringify({ vote })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
        alert(data.msg || "Voto registrado");
        await refreshGame();
    } else {
        alert(data.msg || `Error (${res.status})`);
    }
}


export async function sendAction(action) {
    if (!currentRoundId) return alert("Primero obtén la ronda.");

    // protección adicional: impedir que ciudadanos envíen la acción de sabotear
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