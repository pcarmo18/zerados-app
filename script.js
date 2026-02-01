// ==========================================================
//      CONFIGURAÇÃO DO FIREBASE (MODO COMPAT)
// ==========================================================
const firebaseConfig = {
  apiKey: "AIzaSyDnMxWaw4L5681WStfC3ekfY0wv6FXwHKo",
  authDomain: "zerados-app.firebaseapp.com",
  projectId: "zerados-app",
  storageBucket: "zerados-app.firebasestorage.app",
  messagingSenderId: "565302804202",
  appId: "1:565302804202:web:023222aec5a04e6c70a193",
  measurementId: "G-2TK5KCBTJY"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const API_KEY = 'c1149cab0480433597dc5cdfd1a9eaeb';

let currentUser = null;
const defaultUserData = {
    nick: "Gamer",
    avatar: "",
    status: "Explorando...",
    joined: "Recente",
    jogosZerados: [],
    jogosBacklog: [],
    jogosWishlist: [],
    compRanks: [],
    userFriends: [],
    userSetup: {},
    userPlatforms: []
};
let userData = { ...defaultUserData };

const GAME_AVATARS = [
    "avatars/avatar_progamer.jpg", "avatars/avatar_streamer_girl.jpg",
    "avatars/avatar_rpg_warrior.jpg", "avatars/avatar_cyborg.jpg",
    "avatars/avatar_strategist.jpg", "avatars/avatar1.png", "avatars/avatar2.png"
];

// ==========================================================
//      SISTEMA PRINCIPAL
// ==========================================================
auth.onAuthStateChanged(async (user) => {
    const path = window.location.pathname; 
    const isLoginPage = path.includes('login.html');

    if (user) { 
        currentUser = user; 
        await loadUserDataFromCloud(); 
        listenForFriendRequests(); 
        if (isLoginPage) window.location.href = 'index.html'; 
        else initApp();
    } else { 
        currentUser = null; 
        userData = { ...defaultUserData };
        if (!isLoginPage && !path.endsWith('/') && !path.endsWith('index.html')) { 
            if(document.body) window.location.href = 'login.html'; 
        } 
    }
});

// Funções de Segurança para UI
function safeSetText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }
function safeSetHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function safeGetValue(id) { const el = document.getElementById(id); return el ? el.value : ""; }

async function loadUserDataFromCloud() {
    if (!currentUser) return;
    try {
        const docRef = db.collection("usuarios").doc(currentUser.uid);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            userData = { ...defaultUserData, ...data };
            // Garante arrays
            userData.userFriends = Array.isArray(userData.userFriends) ? userData.userFriends : [];
            userData.jogosZerados = Array.isArray(userData.jogosZerados) ? userData.jogosZerados : [];
            userData.jogosBacklog = Array.isArray(userData.jogosBacklog) ? userData.jogosBacklog : [];
            userData.jogosWishlist = Array.isArray(userData.jogosWishlist) ? userData.jogosWishlist : [];
            updateProfileUI();
        } else {
            const nickTemp = currentUser.email.split('@')[0];
            userData = { ...defaultUserData, nick: nickTemp, joined: new Date().toLocaleDateString('pt-BR') };
            await docRef.set(userData);
            updateProfileUI();
        }
    } catch (error) { console.error("Erro load:", error); }
}

function initApp() {
    updateProfileUI(); 
    loadStatusUI();
    
    if (document.getElementById('feed-container')) { 
        renderGlobalFeed(); 
        renderGlobalRanking(); 
        renderMostGamesBeatenRanking();
    }
    if (document.getElementById('comp-grid')) { renderCompGrid(); renderGlobalCompRanking(); }
    if (document.getElementById('friends-grid-enhanced')) { renderFriendsList(); }
    if (document.getElementById('profile-games-list')) { 
        renderProfileStats(); renderSetup(); renderPlatforms(); 
        renderProfileGamesList(); renderProfileBacklog(); renderProfileWishlist(); 
    }
}

function updateProfileUI() { 
    const nick = userData.nick || "Gamer"; 
    const avatarUrl = userData.avatar; 
    safeSetText('welcome-user', nick);
    safeSetText('profile-user-name', nick);
    
    ['user-avatar', 'profile-big-avatar'].forEach(id => { 
        const el = document.getElementById(id); 
        if (el) { 
            el.innerHTML = ''; 
            if (avatarUrl) { 
                const img = document.createElement('img'); img.src = avatarUrl; img.className = "w-full h-full object-cover"; el.appendChild(img); el.classList.remove('bg-black', 'flex', 'items-center', 'justify-center', 'text-6xl', 'text-yellow-500'); el.classList.add('overflow-hidden'); 
            } else { 
                el.innerText = nick[0] ? nick[0].toUpperCase() : "G"; el.classList.add('bg-black', 'flex', 'items-center', 'justify-center', 'text-6xl', 'text-yellow-500'); el.classList.remove('overflow-hidden'); 
            } 
        } 
    }); 
}

// ==========================================================
//      FEED GLOBAL (CORRIGIDO E OTIMIZADO)
// ==========================================================
async function renderGlobalFeed() {
    const c = document.getElementById('feed-container');
    if (!c) return;
    
    c.innerHTML = '<p class="text-center text-slate-500 animate-pulse">Buscando atualizações...</p>';

    let feedItems = [];

    // 1. Adiciona seus próprios jogos
    const myZerados = userData.jogosZerados || [];
    const myBacklog = userData.jogosBacklog || [];
    
    myZerados.forEach(j => feedItems.push({ ...j, user: userData.nick, avatar: userData.avatar, isMe: true, type: 'zerado' }));
    myBacklog.forEach(j => feedItems.push({ ...j, user: userData.nick, avatar: userData.avatar, isMe: true, type: 'backlog' }));

    // 2. Busca jogos dos amigos (se houver)
    const friends = userData.userFriends || [];
    if (friends.length > 0) {
        const promises = friends.map(async (f) => {
            try {
                const fid = typeof f === 'string' ? f : f.uid;
                if (!fid) return;
                
                const doc = await db.collection("usuarios").doc(fid).get();
                if (doc.exists) {
                    const fd = doc.data();
                    const fZerados = fd.jogosZerados || [];
                    const fBacklog = fd.jogosBacklog || [];
                    
                    // Pega os 3 mais recentes de cada amigo
                    fZerados.slice(0, 3).forEach(g => feedItems.push({ ...g, user: fd.nick, avatar: fd.avatar, isMe: false, type: 'zerado' }));
                    fBacklog.slice(0, 3).forEach(g => feedItems.push({ ...g, user: fd.nick, avatar: fd.avatar, isMe: false, type: 'backlog' }));
                }
            } catch (e) {
                console.log("Erro ao carregar amigo no feed:", e);
            }
        });
        await Promise.all(promises);
    }

    // 3. Renderiza
    if (feedItems.length === 0) {
        c.innerHTML = '<div class="glass-card p-6 text-center text-slate-400">Feed vazio. Adicione jogos ou amigos!</div>';
        return;
    }

    // Embaralha para dar dinamismo
    feedItems.sort(() => Math.random() - 0.5);

    c.innerHTML = feedItems.slice(0, 20).map(m => {
        const isBacklog = m.type === 'backlog';
        const borderColor = isBacklog ? (m.isMe ? 'border-orange-500' : 'border-orange-500/50') : (m.isMe ? 'border-yellow-500' : 'border-blue-500/50');
        const icon = isBacklog ? 'layers' : 'workspace_premium';
        const actionText = isBacklog ? 'adicionou à gaveta' : 'zerou em ' + (m.plat || 'PC');
        const textColor = isBacklog ? 'text-orange-500' : 'text-yellow-500';
        
        return `
        <div class="glass-card mb-4 border-l-4 ${borderColor} p-5 hover:bg-white/5 transition relative overflow-hidden">
            <div class="flex items-start gap-4 relative z-10">
                <div class="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-black flex-shrink-0 flex items-center justify-center shadow-sm">
                    ${m.avatar ? `<img src="${m.avatar}" class="w-full h-full object-cover">` : `<span class="font-bold text-white text-lg">${m.user[0].toUpperCase()}</span>`}
                </div>
                <div class="flex-1">
                    <p class="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1">
                        ${m.isMe ? `<span class="${textColor}">Você</span>` : m.user} ${actionText} 
                        <span class="material-symbols-outlined text-sm ${textColor}">${icon}</span>
                    </p>
                    <h4 class="text-white font-black text-xl italic tracking-tight">${m.titulo}</h4>
                    <div class="flex items-center gap-2 mt-2">
                        ${!isBacklog ? `<span class="bg-yellow-500/20 text-yellow-500 text-xs font-black px-2 py-0.5 rounded uppercase">Nota ${m.nota}</span>` : ''}
                        <span class="text-[10px] text-slate-500">${m.data || m.dataAdicionado}</span>
                    </div>
                    ${m.comentario ? `<div class="feed-comment-box mt-3 text-sm text-slate-300 italic border-l-2 border-white/10 pl-3">"${m.comentario}"</div>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ==========================================================
//      API RAWG
// ==========================================================
window.searchGameAPI = async (q) => {
    const c = document.getElementById('api-results');
    if (!c) return;
    if (q.length < 3) { c.innerHTML = '<p class="col-span-full text-center text-slate-500 italic mt-10">Digite pelo menos 3 letras...</p>'; return; }
    c.innerHTML = '<p class="col-span-full text-center text-yellow-500 animate-pulse font-bold">Buscando...</p>';
    try {
        const r = await fetch(`https://api.rawg.io/api/games?key=${API_KEY}&search=${q}&page_size=9`);
        const d = await r.json();
        if (!d.results || d.results.length === 0) { c.innerHTML = '<p class="col-span-full text-center text-slate-500 italic">Nada encontrado.</p>'; return; }
        c.innerHTML = d.results.map(j => {
            const safeName = j.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            return `<div class="glass-card group hover:border-yellow-500 transition-all cursor-pointer" onclick="showGameDetails(${j.id}, '${safeName}')"><div class="h-48 rounded-2xl mb-4 overflow-hidden relative"><img src="${j.background_image || ''}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500"><div class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60"></div></div><h5 class="text-xl font-black italic uppercase text-white truncate mb-2">${j.name}</h5><div class="flex justify-between items-center"><span class="text-xs font-bold uppercase flex items-center gap-1 text-slate-300"><span class="material-symbols-outlined text-yellow-500 text-sm">star</span>${j.rating || 'N/A'}</span><span class="bg-yellow-500/10 text-yellow-500 text-[10px] font-black px-3 py-1 rounded-full uppercase border border-yellow-500/30">Detalhes</span></div></div>`;
        }).join('');
    } catch (e) { console.error(e); c.innerHTML = '<p class="col-span-full text-center text-red-500">Erro API.</p>'; }
}

window.showGameDetails = async (gameId, gameName) => {
    openModal('modal-game-details');
    safeSetHTML('game-details-content', '<div class="p-20 text-center"><p class="text-yellow-500 animate-pulse font-bold">Carregando...</p></div>');
    try {
        const r = await fetch(`https://api.rawg.io/api/games/${gameId}?key=${API_KEY}`);
        const gameData = await r.json();
        
        let pros = []; 
        if (gameData.metacritic >= 85) pros.push("Aclamado pela crítica.");
        else if (gameData.metacritic >= 75) pros.push("Boa recepção.");
        
        const youtubeQuery = encodeURIComponent(gameData.name + " gameplay replay pt-br");
        const youtubeCard = `<a href="https://www.youtube.com/results?search_query=${youtubeQuery}" target="_blank" class="youtube-link-card group"><span class="material-symbols-outlined youtube-icon group-hover:animate-bounce">play_circle</span><span class="font-black italic uppercase text-xl text-center leading-tight">Ver Gameplay</span><span class="text-[10px] uppercase font-bold mt-2 opacity-70">(YouTube)</span></a>`;
        const safeImg = (gameData.background_image || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");

        safeSetHTML('game-details-content', `<div class="w-full h-80 relative"><img src="${gameData.background_image_additional || gameData.background_image || ''}" class="w-full h-full object-cover modal-game-cover"><div class="absolute bottom-0 left-0 p-8 bg-gradient-to-t from-black to-transparent w-full"><h2 class="text-5xl font-black italic uppercase text-white drop-shadow-lg leading-none">${gameData.name}</h2><div class="flex gap-4 mt-4"><button onclick="fillWinModalFromDetails('${gameData.name.replace(/'/g, "\\'")}', '${safeImg}')" class="bg-yellow-600 hover:bg-yellow-500 text-black px-6 py-3 rounded-xl font-black flex items-center gap-2 transition uppercase italic text-sm shadow-lg"><span class="material-symbols-outlined">workspace_premium</span> Já Zerei Este!</button></div></div></div><div class="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-black/80"><div class="lg:col-span-1"><h3 class="flex items-center gap-2 font-bold uppercase text-sm tracking-widest text-yellow-500 mb-4"><span class="material-symbols-outlined text-base">menu_book</span> Sinopse</h3><div lang="en" class="text-slate-300 leading-relaxed text-sm space-y-4 glass-card p-6 bg-black/40 mb-4">${gameData.description_raw ? gameData.description_raw.split('\n').slice(0, 3).join('<p class="mb-2">') : '<p>Sem sinopse.</p>'}</div></div><div class="lg:col-span-1"><h3 class="flex items-center gap-2 font-bold uppercase text-sm tracking-widest text-yellow-500 mb-4"><span class="material-symbols-outlined text-base">analytics</span> Dados</h3><div class="space-y-4"><p class="text-slate-300 text-sm">Metacritic: <span class="text-yellow-500 font-bold">${gameData.metacritic||'N/A'}</span></p></div></div><div class="lg:col-span-1">${youtubeCard}</div></div>`);
    } catch (e) { safeSetHTML('game-details-content', '<p class="text-center text-red-500 p-10">Erro ao carregar.</p>'); }
}

window.fillWinModalFromDetails = (n, i) => {
    closeModal('modal-game-details');
    setTimeout(() => { 
        if(document.getElementById('win-game-title')){ 
            document.getElementById('win-game-title').value = n; 
            document.getElementById('win-game-img').value = i;
            openModal('modal-zerar'); 
        } 
    }, 200);
}

// ==========================================================
//      MODAIS UNIFICADOS (BUSCA RÁPIDA)
// ==========================================================
window.searchInModal = async (q, mode) => {
    const resultsId = `modal-search-results-${mode}`;
    const c = document.getElementById(resultsId);
    if (!c || q.length < 3) { if(c) c.classList.add('hidden'); return; }
    try {
        const r = await fetch(`https://api.rawg.io/api/games?key=${API_KEY}&search=${q}&page_size=5`);
        const d = await r.json();
        c.classList.remove('hidden');
        c.innerHTML = d.results.map(j => {
            const sn = j.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const si = (j.background_image || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
            let func = mode === 'zerar' ? `selectGameForWin('${sn}', '${si}')` : (mode === 'backlog' ? `selectGameForBacklog('${sn}', '${si}')` : `selectGameForWishlist('${sn}', '${si}')`);
            let color = mode === 'zerar' ? 'hover:bg-yellow-500/20' : (mode === 'backlog' ? 'hover:bg-orange-500/20' : 'hover:bg-fuchsia-500/20');
            return `<div class="p-4 ${color} cursor-pointer border-b border-white/5 flex items-center gap-3" onclick="${func}"><img src="${j.background_image || ''}" class="w-10 h-10 rounded object-cover"><span class="text-sm font-bold text-white">${j.name}</span></div>`;
        }).join('');
    } catch(e) { console.error(e); }
};

window.selectGameForWin = (t, i) => { document.getElementById('modal-search-input').value = t; document.getElementById('win-game-title').value = t; document.getElementById('win-game-img').value = i; document.getElementById('modal-search-results-zerar').classList.add('hidden'); };
window.selectGameForBacklog = (t, i) => { document.getElementById('backlog-search-input').value = t; document.getElementById('backlog-game-title').value = t; document.getElementById('backlog-game-img').value = i; document.getElementById('modal-search-results-backlog').classList.add('hidden'); };
window.selectGameForWishlist = (t, i) => { document.getElementById('wishlist-search-input').value = t; document.getElementById('wishlist-game-title').value = t; document.getElementById('wishlist-game-img').value = i; document.getElementById('modal-search-results-wishlist').classList.add('hidden'); };

window.confirmWin = async () => { 
    const t = safeGetValue('win-game-title'); 
    const n = safeGetValue('win-game-score'); 
    if(!t || !n) return alert("Preencha tudo!");
    const gd = { titulo: t, nota: n, img: safeGetValue('win-game-img'), plat: safeGetValue('win-game-plat'), comentario: safeGetValue('win-game-comment'), data: new Date().toLocaleDateString('pt-BR'), type: 'zerado' };
    userData.jogosZerados.unshift(gd); 
    await db.collection("usuarios").doc(currentUser.uid).update({ jogosZerados: userData.jogosZerados }); 
    closeModal('modal-zerar'); 
    initApp(); 
    openShareModal(gd); 
};

window.confirmBacklog = async () => { 
    const t = safeGetValue('backlog-game-title'); 
    if(!t) return alert("Selecione!");
    if(userData.jogosBacklog.some(g=>g.titulo===t)) return alert("Já existe!");
    userData.jogosBacklog.unshift({ titulo: t, img: safeGetValue('backlog-game-img'), dataAdicionado: new Date().toLocaleDateString('pt-BR'), type: 'backlog' });
    await db.collection("usuarios").doc(currentUser.uid).update({ jogosBacklog: userData.jogosBacklog });
    closeModal('modal-backlog');
    initApp();
    alert("Adicionado!");
};

window.confirmWishlist = async () => {
    const t = safeGetValue('wishlist-game-title'); 
    if(!t) return alert("Selecione!");
    if(userData.jogosWishlist.some(g=>g.titulo===t)) return alert("Já existe!");
    userData.jogosWishlist.unshift({ titulo: t, img: safeGetValue('wishlist-game-img'), dataAdicionado: new Date().toLocaleDateString('pt-BR') });
    await db.collection("usuarios").doc(currentUser.uid).update({ jogosWishlist: userData.jogosWishlist });
    closeModal('modal-wishlist');
    initApp();
    alert("Adicionado!");
};

function openShareModal(gd) { const m = document.getElementById('modal-share'); if (!m) return; document.getElementById('share-bg').src = gd.img || ''; safeSetText('share-game-title', gd.titulo); safeSetText('share-game-score', gd.nota); safeSetText('share-user-nick', userData.nick); openModal('modal-share'); }
window.downloadShareCard = () => { const ca = document.getElementById('share-capture-area'); const btn = document.getElementById('btn-download-share'); btn.innerText = 'Gerando...'; html2canvas(ca, {scale:2, backgroundColor:null}).then(c => { const l = document.createElement('a'); l.download = 'zerados-card.png'; l.href = c.toDataURL('image/png'); l.click(); btn.innerHTML = '<span class="material-symbols-outlined">download</span> Baixar'; closeModal('modal-share'); }); }

// ==========================================================
//      PERFIL E CLIQUE
// ==========================================================
window.fetchAndShowProfileGameDetails = async (gameName) => {
    openModal('modal-game-details');
    safeSetHTML('game-details-content', '<p class="text-center text-yellow-500 p-10 font-bold">Buscando...</p>');
    try {
        const r = await fetch(`https://api.rawg.io/api/games?key=${API_KEY}&search=${encodeURIComponent(gameName)}&page_size=1`);
        const d = await r.json();
        if(d.results && d.results.length > 0) showGameDetails(d.results[0].id, gameName);
        else safeSetHTML('game-details-content', '<p class="text-center text-red-500 p-10">Não encontrado.</p>');
    } catch(e) { safeSetHTML('game-details-content', '<p class="text-center text-red-500 p-10">Erro API.</p>'); }
};

function renderProfileGamesList() { 
    const c = document.getElementById('profile-games-list'); if(!c) return; 
    const l = userData.jogosZerados || []; 
    if(l.length===0) { c.innerHTML='<p class="text-slate-500 text-center p-4">Nada ainda.</p>'; return; } 
    c.innerHTML = l.map(j => `<div class="flex justify-between items-center p-3 mb-2 bg-black/40 rounded-xl border border-white/5 hover:border-yellow-500 transition group cursor-pointer" onclick="fetchAndShowProfileGameDetails('${j.titulo.replace(/'/g, "\\'")}')"><div class="flex items-center gap-3"><span class="text-yellow-500 font-black text-lg">${j.nota}</span><span class="text-white font-bold truncate w-40">${j.titulo}</span></div></div>`).join(''); 
}
function renderProfileBacklog() { 
    const c = document.getElementById('profile-backlog-list'); if(!c) return; 
    const l = userData.jogosBacklog || []; 
    if(l.length===0) { c.innerHTML='<p class="text-slate-500 text-center p-4">Vazio.</p>'; return; } 
    c.innerHTML = l.map(j => `<div class="flex items-center p-3 mb-2 bg-black/40 rounded-xl border border-orange-500/20 hover:border-orange-500 transition group cursor-pointer" onclick="fetchAndShowProfileGameDetails('${j.titulo.replace(/'/g, "\\'")}')"><span class="text-white font-bold truncate">${j.titulo}</span></div>`).join(''); 
}
function renderProfileWishlist() { 
    const c = document.getElementById('profile-wishlist-list'); if(!c) return; 
    const l = userData.jogosWishlist || []; 
    if(l.length===0) { c.innerHTML='<p class="text-slate-500 text-center p-4">Vazio.</p>'; return; } 
    c.innerHTML = l.map(j => `<div class="flex items-center p-3 mb-2 bg-black/40 rounded-xl border border-fuchsia-500/20 hover:border-fuchsia-500 transition group cursor-pointer" onclick="fetchAndShowProfileGameDetails('${j.titulo.replace(/'/g, "\\'")}')"><span class="text-white font-bold truncate">${j.titulo}</span></div>`).join(''); 
}

// ==========================================================
//      RANKINGS
// ==========================================================
async function renderGlobalRanking() {
    const c = document.getElementById('ranking-container'); if (!c) return;
    c.innerHTML = '<p class="text-center text-slate-500 animate-pulse text-xs">Calculando...</p>';
    try {
        const s = await db.collection("usuarios").get();
        let all = [];
        s.forEach(d => {
            const dt = d.data();
            const gms = Array.isArray(dt.jogosZerados) ? dt.jogosZerados : [];
            gms.forEach(g => { if(g.nota) all.push({ ...g, zeradoPor: dt.nick }); });
        });
        const t = all.sort((a, b) => b.nota - a.nota).slice(0, 5);
        if(t.length===0) { c.innerHTML = '<p class="text-slate-500 text-center italic text-sm p-4">Vazio.</p>'; return; }
        c.innerHTML = `<div class="flex justify-between text-[10px] uppercase mb-4 text-slate-500 font-black tracking-widest px-2"><span>Jogo</span><span>Nota</span></div><div class="space-y-3">${t.map((j, i) => `<div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition"><div class="flex items-center gap-3 overflow-hidden"><span class="text-yellow-500/50 font-black text-lg">#${i + 1}</span><div class="truncate"><p class="text-white font-bold text-sm truncate">${j.titulo}</p><p class="text-[9px] text-slate-400 uppercase">${j.zeradoPor}</p></div></div><span class="text-yellow-500 font-black text-lg bg-yellow-500/10 px-2 rounded">${j.nota}</span></div>`).join('')}</div>`;
    } catch(e) { c.innerHTML='<p class="text-red-500 text-center text-xs">Erro.</p>'; }
}

async function renderMostGamesBeatenRanking() {
    const c = document.getElementById('most-games-beaten-ranking'); if (!c) return;
    c.innerHTML = '<p class="text-center text-slate-500 animate-pulse text-xs">Calculando...</p>';
    try {
        const s = await db.collection("usuarios").get();
        let u = [];
        s.forEach(d => {
            const dt = d.data();
            const count = Array.isArray(dt.jogosZerados) ? dt.jogosZerados.length : 0;
            if(count > 0) u.push({ uid: d.id, nick: dt.nick, avatar: dt.avatar, count: count });
        });
        const t = u.sort((a, b) => b.count - a.count).slice(0, 5);
        if(t.length===0) { c.innerHTML = '<p class="text-slate-500 text-center italic text-sm p-4">Vazio.</p>'; return; }
        c.innerHTML = `<div class="flex justify-between text-[10px] uppercase mb-4 text-slate-500 font-black tracking-widest px-2"><span>Jogador</span><span>Total</span></div><div class="space-y-3">${t.map((u, i) => `<div class="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition cursor-pointer" onclick="viewRealFriendProfile('${u.uid}')"><div class="flex items-center gap-3 overflow-hidden"><span class="text-yellow-500/50 font-black text-lg">#${i + 1}</span><div class="w-8 h-8 rounded-full overflow-hidden bg-black border border-yellow-500/30 flex items-center justify-center">${u.avatar ? `<img src="${u.avatar}" class="w-full h-full object-cover">` : `<span class="text-xs font-bold text-yellow-500">${u.nick[0]}</span>`}</div><p class="text-white font-bold text-sm truncate">${u.nick}</p></div><span class="text-yellow-500 font-black text-lg bg-yellow-500/10 px-2 rounded">${u.count}</span></div>`).join('')}</div>`;
    } catch(e) { c.innerHTML='<p class="text-red-500 text-center text-xs">Erro.</p>'; }
}

// ==========================================================
//      AMIGOS E UTILITÁRIOS
// ==========================================================
window.sendFriendRequest = async (u, n) => {
    if (!userData || !userData.nick) return alert("Perfil carregando... Tente já.");
    if (u === currentUser.uid) return alert("Erro: Auto-adicionar.");
    const jaTem = (userData.userFriends || []).some(f => (typeof f === 'string' ? f === u : f.uid === u));
    if (jaTem) return alert("Já é amigo!");

    try {
        await db.collection("conexoes").add({
            de: currentUser.uid,
            nickDe: userData.nick,
            avatarDe: userData.avatar || "",
            para: u,
            status: 'pendente',
            data: new Date()
        });
        alert(`Convite enviado para ${n}!`);
        closeModal('modal-add-friend');
        closeModal('modal-view-friend');
    } catch (e) { alert("Erro ao enviar."); }
};

async function renderFriendsList(){
    const g=document.getElementById('friends-grid-enhanced'),c=document.getElementById('friend-counter');
    if(!g)return;
    const l=userData.userFriends||[];
    if(c)c.innerText=l.length;
    if(0===l.length){g.innerHTML='<div class="col-span-full text-center text-slate-500 italic glass-card p-8">Sem aliados.</div>';return}
    g.innerHTML='<p class="col-span-full text-center text-slate-500 animate-pulse">Carregando...</p>';
    
    const fp=l.map(async f=>{try{const fid=typeof f==='string'?f:f.uid;
    if(!fid)return null;const d=await db.collection("usuarios").doc(fid).get();if(d.exists)return{uid:fid,...d.data()}}catch(e){}return null});
    
    const fd=(await Promise.all(fp)).filter(f=>null!==f);
    if(0===fd.length){g.innerHTML='<div class="col-span-full text-center text-slate-500 italic glass-card p-8">Erro.</div>';return}
    
    g.innerHTML=fd.map(f=>`<div class="friend-card-enhanced cursor-pointer group items-start" onclick="viewRealFriendProfile('${f.uid}')"><div class="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-500/50 bg-black flex items-center justify-center group-hover:border-yellow-500 transition shadow-lg shadow-yellow-500/10 flex-shrink-0">${f.avatar?`<img src="${f.avatar}" class="w-full h-full object-cover">`:`<span class="font-black text-yellow-500 text-2xl">${f.nick[0].toUpperCase()}</span>`}</div><div class="flex-1 min-w-0"><h3 class="text-white font-black text-lg italic uppercase truncate group-hover:text-yellow-500 transition">${f.nick}</h3><div class="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 leading-tight"><span class="inline-block w-2 h-2 bg-yellow-500 rounded-full animate-pulse mr-1"></span>Jogando: <span class="text-yellow-500 break-words">${(f.status&&f.status.game?f.status.game:f.status)||"..."}</span></div></div><span class="material-symbols-outlined text-yellow-500/30 group-hover:text-yellow-500 transition self-center">chevron_right</span></div>`).join('')
}

window.viewRealFriendProfile=async u=>{try{const d=await db.collection("usuarios").doc(u).get();if(!d.exists)return alert("Erro.");const ud=d.data();safeSetText('friend-name', ud.nick);
const elAv = document.getElementById('friend-avatar'); if(elAv) elAv.innerHTML = ud.avatar?`<img src="${ud.avatar}" class="w-full h-full object-cover">`:ud.nick[0];
const h=document.getElementById('modal-friend-header-bg');let st="...";if(ud.status){if(typeof ud.status==='object'&&ud.status.game){st=`${ud.status.game} (${ud.status.plat})`;if(ud.status.img&&h){h.style.backgroundImage=`url('${ud.status.img}')`;h.style.opacity='0.4'}}else{st=ud.status;if(h){h.style.backgroundImage='none';h.style.opacity='0'}}}else{if(h){h.style.backgroundImage='none';h.style.opacity='0'}}safeSetText('friend-status-text', st);
safeSetText('friend-joined', "Desde: "+(ud.joined||"N/A"));
const ac=document.getElementById('friend-profile-actions');if(ac){ac.innerHTML='';if(u!==currentUser.uid){const isF=(userData.userFriends||[]).some(f=>(typeof f==='string'?f===u:f.uid===u));if(!isF){ac.innerHTML=`<button onclick="sendFriendRequest('${u}','${ud.nick.replace(/'/g,"\\'")}')" class="bg-yellow-600 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-black flex items-center gap-2 transition uppercase italic text-xs shadow-lg"><span class="material-symbols-outlined text-sm">person_add</span> Adicionar</button>`}}}
const s=ud.userSetup||{};safeSetHTML('friend-setup', Object.keys(s).length?Object.entries(s).map(([k,v])=>`<div><span class="text-slate-500 uppercase text-[10px]">${k}:</span> <span class="text-white font-bold">${v||'-'}</span></div>`).join(''):'<span class="text-slate-500 italic text-sm">Vazio.</span>');const p=ud.userPlatforms||[];safeSetHTML('friend-platforms', p.length?p.map(x=>`<span class="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-1 rounded font-bold uppercase border border-yellow-500/30">${x.name}</span>`).join(''):'<span class="text-slate-500 italic text-sm">Vazio.</span>');const r=ud.compRanks||[];safeSetHTML('friend-ranks', r.length?r.map(x=>`<div class="bg-black/40 p-4 rounded-xl border border-white/5"><p class="text-[10px] text-yellow-500 uppercase font-black">${x.game}</p><p class="text-xl font-bold text-white italic uppercase">${x.rank}</p></div>`).join(''):'<p class="text-slate-500 text-xs italic">Vazio.</p>');const g=ud.jogosZerados||[];safeSetHTML('friend-games', g.length?g.slice(0,5).map(x=>`<div class="flex justify-between items-center border-b border-white/5 pb-2 mb-2"><span class="font-bold text-sm text-slate-300 truncate w-2/3">${x.titulo}</span><span class="text-yellow-500 font-black text-sm">${x.nota}/10</span></div>`).join(''):'<p class="text-slate-500 text-xs italic">Vazio.</p>');openModal('modal-view-friend')}catch(e){alert("Erro.")}};

// Funções Auxiliares (compactadas)
window.openAvatarModal=()=>{const g=document.getElementById('avatar-grid');if(g){g.innerHTML=GAME_AVATARS.map(u=>`<img src="${u}" onclick="selectAvatar('${u}')" class="w-20 h-20 rounded-full border-2 border-transparent hover:border-yellow-500 hover:scale-110 cursor-pointer transition object-cover bg-black">`).join('');}openModal('modal-avatar');};window.selectAvatar=async(u)=>{userData.avatar=u;updateProfileUI();closeModal('modal-avatar');await db.collection("usuarios").doc(currentUser.uid).update({avatar:u});};let isLoginMode=!0;window.toggleMode=()=>{isLoginMode=!isLoginMode;safeSetText('form-title', isLoginMode?"Iniciar Sessão":"Criar Acesso");safeSetText('btn-text', isLoginMode?"Entrar":"Cadastrar");};window.handleAuth=()=>{const n=safeGetValue('login-user').trim(),p=safeGetValue('login-pass').trim();if(!n||!p)return alert("Preencha!");let e=n.includes('@')?n:`${n}@zerados.com`;isLoginMode?auth.signInWithEmailAndPassword(e,p).then(()=>{if(document.getElementById('welcome-user'))document.getElementById('welcome-user').innerText=n}).catch(x=>alert("Erro login: "+x.message)):auth.createUserWithEmailAndPassword(e,p).then(k=>{const u={...defaultUserData, nick:n, joined:new Date().toLocaleDateString("pt-BR")};db.collection("usuarios").doc(k.user.uid).set(u).then(()=>{userData=u;alert("Criado!")})}).catch(x=>alert("Erro criar: "+x.message))};window.logout=()=>{confirm("Sair?")&&auth.signOut().then(()=>window.location.href='login.html')};function openModal(i){const m=document.getElementById(i);if(m)m.classList.remove('hidden')}function closeModal(i){const m=document.getElementById(i);if(m)m.classList.add('hidden');const l=['modal-search-results-zerar','modal-search-results-backlog','modal-search-results-wishlist','status-search-results','comp-search-results','friend-search-results'];l.forEach(x=>{const e=document.getElementById(x);if(e)e.classList.add('hidden')})}window.openModal=openModal;window.closeModal=closeModal;
window.searchStatusGame=async q=>{const c=document.getElementById('status-search-results');if(q.length<3){c.classList.add('hidden');return}const r=await fetch(`https://api.rawg.io/api/games?key=${API_KEY}&search=${q}&page_size=3`);const d=await r.json();c.classList.remove('hidden');c.innerHTML=d.results.map(j=>{const si=(j.background_image||'').replace(/'/g,"\\'").replace(/"/g,"&quot;");return`<div class="p-4 hover:bg-yellow-500/20 cursor-pointer border-b border-white/5 flex items-center gap-3" onclick="selectStatusGame('${j.name.replace(/'/g,"\\'")}','${si}')"><img src="${j.background_image||''}" class="w-8 h-8 rounded object-cover"><span class="text-sm font-bold text-white">${j.name}</span></div>`}).join('')};window.selectStatusGame=(n,i)=>{document.getElementById('status-input').value=n;document.getElementById('status-game-img').value=i;closeModal('status-search-results')};window.saveStatus=()=>{const g=document.getElementById('status-input').value;const i=document.getElementById('status-game-img').value;const p=document.getElementById('status-plat-select').value;if(g){const s={game:g,plat:p,img:i};userData.status=s;loadStatusUI();closeModal('modal-status');db.collection("usuarios").doc(currentUser.uid).update({status:s})}};function loadStatusUI(){let s=userData.status,d="Explorando...";if(s){if(typeof s==='object'&&s.game)d=`${s.game} (${s.plat})`;else if(typeof s==='string')d=s}safeSetText('current-status-display', d);safeSetText('profile-status', d);}
let editIndex=-1;window.newRank=()=>{editIndex=-1;['comp-game-search','comp-selected-title','comp-game-img'].forEach(i=>{const e=document.getElementById(i);if(e)e.value=''});const s=document.getElementById('comp-rank-select');if(s)s.selectedIndex=0;const d=document.getElementById('comp-selected-display');if(d)d.classList.add('hidden');safeSetText(document.querySelector('#modal-elo h4')?'#modal-elo h4':null, "⚡ Novo Rank");openModal('modal-elo')};window.searchCompGame=async q=>{const c=document.getElementById('comp-search-results');if(q.length<3){c.classList.add('hidden');return}try{const r=await fetch(`https://api.rawg.io/api/games?key=${API_KEY}&search=${q}&page_size=5&tags=multiplayer,competitive`);const d=await r.json();c.classList.remove('hidden');c.innerHTML=d.results.map(j=>{const sn=j.name.replace(/'/g,"\\'").replace(/"/g,"&quot;");const si=(j.background_image||'').replace(/'/g,"\\'").replace(/"/g,"&quot;");return`<div class="p-3 hover:bg-yellow-500/20 cursor-pointer border-b border-white/5 flex items-center gap-3" onclick="selectCompGame('${sn}','${si}')"><img src="${j.background_image||''}" class="w-8 h-8 rounded object-cover"><span class="text-sm font-bold text-white">${j.name}</span></div>`}).join('')}catch(e){}};window.selectCompGame=(n,i)=>{document.getElementById('comp-selected-title').value=n;document.getElementById('comp-game-img').value=i;document.getElementById('comp-game-search').value='';document.getElementById('comp-search-results').classList.add('hidden');const d=document.getElementById('comp-selected-display');if(d){d.querySelector('span').innerText=n;d.classList.remove('hidden')}};window.saveCompElo=async()=>{const g=safeGetValue('comp-selected-title');const i=safeGetValue('comp-game-img');const r=safeGetValue('comp-rank-select');if(!g)return alert("Selecione um jogo.");if(!r)return alert("Selecione o Rank.");if(!userData.compRanks)userData.compRanks=[];const item={game:g,rank:r,img:i};if(editIndex===-1)userData.compRanks.unshift(item);else userData.compRanks[editIndex]=item;closeModal('modal-elo');renderCompGrid();renderGlobalCompRanking();await db.collection("usuarios").doc(currentUser.uid).update({compRanks:userData.compRanks})};function renderCompGrid(){const g=document.getElementById('comp-grid');if(!g)return;let d=userData.compRanks||[];if(0===d.length){g.innerHTML='<p class="text-slate-500 col-span-full text-center py-10 glass-card">Nenhum rank registrado.</p>';return}g.innerHTML=d.map((c,i)=>`<div class="glass-card border-t-4 border-yellow-500 relative overflow-hidden group hover:border-yellow-400 transition-all h-48"><div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10"></div>${c.img?`<img src="${c.img}" class="absolute top-0 left-0 w-full h-full object-cover opacity-30 transition group-hover:scale-110 group-hover:opacity-40 mix-blend-luminosity">`:''}<div class="relative z-20 flex flex-col justify-between h-full"><div class="flex justify-between items-start"><div><p class="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1 flex items-center gap-1"><span class="material-symbols-outlined text-sm">sports_esports</span> ${c.game}</p><h2 class="text-3xl font-black italic text-white uppercase leading-none drop-shadow-lg">${c.rank}</h2></div><div class="flex gap-1 bg-black/50 rounded-lg p-1 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"><button onclick="deleteComp(${i})" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition"><span class="material-symbols-outlined text-sm">delete</span></button></div></div><div class="w-full h-1 bg-slate-800/50 rounded-full mt-auto"><div class="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)] animate-pulse" style="width:${Math.random()*(95-60)+60}%"></div></div></div></div>`).join('')}window.deleteComp=async i=>{confirm("Remover?")&&(userData.compRanks.splice(i,1),renderCompGrid(),renderGlobalCompRanking(),await db.collection("usuarios").doc(currentUser.uid).update({compRanks:userData.compRanks}))};async function renderGlobalCompRanking(){const c=document.getElementById('global-comp-ranking-container');if(!c)return;c.innerHTML='<p class="text-center text-slate-500 animate-pulse text-xs">Analisando o meta...</p>';try{const s=await db.collection("usuarios").get(),gc={};let tp=0;s.forEach(d=>{const r=d.data().compRanks||[];if(r.length>0){tp++;new Set(r.map(x=>x.game)).forEach(g=>{gc[g]=(gc[g]||0)+1})}});const sg=Object.entries(gc).sort((a,b)=>b[1]-a[1]).slice(0,5);if(0===sg.length){c.innerHTML='<p class="text-slate-500 text-center italic text-sm p-4">Sem dados.</p>';return}c.innerHTML=`<div class="flex justify-between text-[10px] uppercase mb-4 text-slate-500 font-black tracking-widest px-2"><span>Jogo</span><span>Jogadores</span></div><div class="space-y-2">${sg.map((i,x)=>{const p=Math.round((i[1]/tp)*100)||0;return`<div class="relative overflow-hidden rounded-lg bg-black/40 border border-white/5 p-3 hover:border-yellow-500/50 transition group"><div class="absolute inset-0 bg-yellow-500/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></div><div class="relative z-10 flex justify-between items-center"><div class="flex items-center gap-3"><span class="font-black text-yellow-500/60 text-lg">#${x+1}</span><span class="text-white font-bold text-sm truncate">${i[0]}</span></div><div class="text-right"><span class="text-yellow-500 font-black text-lg block leading-none">${i[1]}</span><span class="text-[9px] text-slate-400 uppercase font-bold">${p}% da base</span></div></div></div>`}).join('')}</div>`}catch(e){c.innerHTML='<p class="text-red-500 text-center text-xs">Erro.</p>'}}
window.editSetup=()=>{const s=userData.userSetup||{};['cpu','gpu','ram','periph'].forEach(k=>safeSetText('setup-'+k, s[k]||''));openModal('modal-setup')};window.saveSetup=async()=>{const s={};['cpu','gpu','ram','periph'].forEach(k=>s[k]=safeGetValue('setup-'+k));userData.userSetup=s;closeModal('modal-setup');renderSetup();db.collection("usuarios").doc(currentUser.uid).update({userSetup:s})};function renderSetup(){const c=document.getElementById('setup-display');if(!c)return;const s=userData.userSetup||{cpu:"-",gpu:"-",ram:"-",periph:"-"};c.innerHTML=Object.entries(s).map(([k,v])=>`<div class="flex justify-between border-b border-white/5 pb-2 mb-2 last:border-0 last:mb-0"><span class="text-xs font-black text-slate-500 uppercase">${k}</span><span class="font-bold text-white text-right w-2/3 truncate">${v}</span></div>`).join('')}window.savePlatform=async()=>{const n=safeGetValue('plat-name'),i=safeGetValue('plat-id');if(!i)return;if(!userData.userPlatforms)userData.userPlatforms=[];userData.userPlatforms.push({name:n,id:i});closeModal('modal-platform');renderPlatforms();db.collection("usuarios").doc(currentUser.uid).update({userPlatforms:userData.userPlatforms})};function renderPlatforms(){const c=document.getElementById('platforms-display');if(!c)return;const p=userData.userPlatforms||[];if(0===p.length){c.innerHTML='<p class="text-slate-500 text-xs italic text-center py-4">Vazio.</p>';return}c.innerHTML=p.map((x,i)=>`<div class="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5 mb-2"><div class="flex items-center gap-3"><span class="material-symbols-outlined text-yellow-500 text-sm">gamepad</span><div><p class="text-[10px] font-black text-slate-500 uppercase">${x.name}</p><p class="font-bold text-white text-sm">${x.id}</p></div></div><button onclick="deletePlatform(${i})" class="text-slate-600 hover:text-red-500"><span class="material-symbols-outlined text-sm">close</span></button></div>`).join('')}window.deletePlatform=async i=>{userData.userPlatforms.splice(i,1);renderPlatforms();db.collection("usuarios").doc(currentUser.uid).update({userPlatforms:userData.userPlatforms})};function renderProfileStats(){const z=userData.jogosZerados||[],r=userData.compRanks||[];safeSetText('stat-zerados', z.length);if(z.length>0) safeSetText('stat-nota', (z.reduce((a,c)=>a+parseFloat(c.nota),0)/z.length).toFixed(1));if(r.length>0) safeSetText('stat-rank', r[0].rank)}
function listenForFriendRequests(){db.collection("conexoes").where("para","==",currentUser.uid).where("status","==","pendente").onSnapshot(s=>{const c=document.getElementById('pending-requests-container'),g=document.getElementById('requests-grid');if(!c||!g)return;if(s.empty){c.classList.add('hidden');g.innerHTML=''}else{c.classList.remove('hidden');g.innerHTML=s.docs.map(d=>{const r=d.data();return`<div class="glass-card flex items-center justify-between p-4 border-l-4 border-yellow-500 bg-yellow-500/10 animate-pulse"><div class="flex items-center gap-4"><div class="w-12 h-12 rounded-full overflow-hidden border border-yellow-500 bg-black flex items-center justify-center">${r.avatarDe?`<img src="${r.avatarDe}" class="w-full h-full object-cover">`:`<span class="font-bold text-white">${r.nickDe[0]}</span>`}</div><div><p class="text-[10px] text-yellow-500 uppercase font-bold">Quer ser seu aliado</p><h4 class="text-white font-bold italic uppercase">${r.nickDe}</h4></div></div><div class="flex gap-2"><button onclick="respondRequest('${d.id}','${r.de}','${r.nickDe}',false)" class="p-2 bg-black/40 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition"><span class="material-symbols-outlined">close</span></button><button onclick="respondRequest('${d.id}','${r.de}','${r.nickDe}',true)" class="p-2 bg-yellow-600 hover:bg-yellow-500 text-black rounded-xl shadow-lg transition"><span class="material-symbols-outlined">check</span></button></div></div>`}).join('')}})}window.respondRequest=async(ri,su,sn,a)=>{try{if(a){const nf={uid:su,nick:sn};if(!userData.userFriends)userData.userFriends=[];userData.userFriends.push(nf);await db.collection("usuarios").doc(currentUser.uid).update({userFriends:firebase.firestore.FieldValue.arrayUnion(nf)});const mh={uid:currentUser.uid,nick:userData.nick};db.collection("usuarios").doc(su).update({userFriends:firebase.firestore.FieldValue.arrayUnion(mh)}).catch(()=>{});await db.collection("conexoes").doc(ri).update({status:'aceito'});alert(`Agora você e ${sn} são aliados!`);renderFriendsList()}else{await db.collection("conexoes").doc(ri).delete()}}catch(e){alert("Erro.")}};window.searchRealUser=async q=>{const c=document.getElementById('friend-search-results');if(q.length<3){c.classList.add('hidden');return}const s=await db.collection("usuarios").where('nick','>=',q).where('nick','<=',q+'\uf8ff').limit(5).get();c.innerHTML=s.empty?'<div class="p-4 text-xs">Nada encontrado.</div>':s.docs.map(d=>{const u=d.data();if(d.id===currentUser.uid)return'';return`<div class="p-4 hover:bg-yellow-500/20 cursor-pointer flex gap-3 items-center" onclick="sendFriendRequest('${d.id}','${u.nick}')"><div class="w-8 h-8 rounded-full overflow-hidden bg-black border border-yellow-500 flex items-center justify-center">${u.avatar?`<img src="${u.avatar}" class="w-full h-full object-cover">`:`<span class="text-xs font-bold text-yellow-500">${u.nick[0]}</span>`}</div><div><p class="text-white text-sm font-bold">${u.nick}</p><p class="text-[10px] text-yellow-500">Clique para solicitar</p></div></div>`}).join('');c.classList.remove('hidden')};
document.addEventListener('DOMContentLoaded',()=>{const el=document.getElementById('typewriter-text');if(el){const ph=["Eternize suas Conquistas.","Gerencie seu Setup Gamer.","Encontre seu Duo ideal.","Domine o Ranking Global."];let pi=0,ci=0,del=!1;function type(){const cur=ph[pi];del?el.innerText=cur.substring(0,ci-1):el.innerText=cur.substring(0,ci+1);del?ci--:ci++;!del&&ci===cur.length?(del=!0,setTimeout(type,2e3)):del&&0===ci?(del=!1,pi=(pi+1)%ph.length,setTimeout(type,500)):setTimeout(type,del?50:100)}type()}});