/* =================================================
   🔮 NAGATORO ESPAÇO CRUSH — jogo de combinar gemas no Sistema Solar
   📁 Arquivo: espaco-crush.js   (criador: Doctor Valeyard)

   <prefixo>crush            → card do jogo + 2 botões: JOGAR SÓ / DESAFIAR ALGUÉM
   <prefixo>crush @pessoa    → desafia essa pessoa direto
   <prefixo>rankcrush        → ranking geral do jogo (e a sua posição)

   Como funciona:
   • O próprio bot sobe um servidorzinho web (sem instalar nada) que entrega
     a página do jogo e recebe a pontuação.
   • JOGAR SÓ → o link pessoal chega no PV. A partida vale ranking.
   • DESAFIAR → o desafio aparece no grupo; quem aceitar, os dois recebem o
     link no PV. Cada um tem 10 min pra jogar a rodada (90 s). Quem fizer mais
     pontos ganha e o resultado sai no grupo.
   • O perfil (.perfil) mostra posição, recorde, vitórias e o último duelo.

   ⚙️ No config.js (opcional):
     ESPACO_CRUSH: {
       URL: "http://IP-DA-HOSPEDAGEM:PORTA",   // endereço público do bot
       PORTA: 3000                             // se não tiver, usa a da hospedagem
     }
================================================= */

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const config = require("../../config");

const CFG = config.ESPACO_CRUSH || {};
const DURACAO = Number(CFG.DURACAO || 90);              // segundos de cada rodada
const PRAZO_ACEITAR = 5 * 60 * 1000;                   // desafio aberto: 5 min pra alguém aceitar
const PRAZO_JOGAR = 10 * 60 * 1000;                    // depois de aceito: 10 min pros dois jogarem
const VALIDADE_LINK = 30 * 60 * 1000;                  // link solo vale 30 min
const RODAPE = "❲ ᶜʳⁱᵃᵈᵒʳ ❲ ⛮ ❳ ᵈᵒᶜᵗᵒʳ ᵛᵃˡᵉʸᵃʳᵈ ❳";
const NOME_JOGO = "NAGATORO ESPAÇO CRUSH";

const PASTA = __dirname;
const DB = path.join(__dirname, "../dados/espaco-crush.json");

// ───────────── banco ─────────────
let cache = null;
function ler() {
    if (cache) return cache;
    try { cache = JSON.parse(fs.readFileSync(DB, "utf8")); } catch { cache = {}; }
    cache.jogadores ||= {}; cache.sessoes ||= {}; cache.duelos ||= {};
    return cache;
}
let salvando = null;
function salvar() {
    clearTimeout(salvando);
    salvando = setTimeout(() => {
        try { fs.mkdirSync(path.dirname(DB), { recursive: true }); fs.writeFileSync(DB, JSON.stringify(ler(), null, 1)); }
        catch (e) { console.error("⚠️ espaço crush (salvar):", e?.message || e); }
    }, 300);
}

const limparJid = j => String(j || "").replace(/:\d+@/, "@");
const num = j => String(j || "").split("@")[0].split(":")[0];
const fmt = n => Number(n || 0).toLocaleString("pt-BR");
const token = () => crypto.randomBytes(12).toString("base64url");
const sortear = l => l[Math.floor(Math.random() * l.length)];

// o id do jogador: o próprio jid (LID ou número), sem o ":xx"
function idDe(msg) { return limparJid(msg?.key?.participant || msg?.key?.remoteJid); }

function jogador(id, nome) {
    const db = ler();
    const j = db.jogadores[id] ||= { nome: nome || num(id), melhor: 0, partidas: 0, total: 0, vitorias: 0, derrotas: 0, empates: 0, ultimoDuelo: null };
    if (nome) j.nome = String(nome).slice(0, 40);
    return j;
}

function ranking() {
    return Object.entries(ler().jogadores)
        .filter(([, j]) => j.melhor > 0)
        .sort((a, b) => b[1].melhor - a[1].melhor || b[1].vitorias - a[1].vitorias)
        .map(([id, j], i) => ({ id, pos: i + 1, ...j }));
}

// ───────────── endereço público ─────────────
function porta() { return Number(CFG.PORTA || process.env.SERVER_PORT || process.env.PORT || 3000); }
function urlPublica() {
    if (CFG.URL) return String(CFG.URL).replace(/\/+$/, "");
    if (ler().url) return ler().url;                         // salvo pelo .crushlink
    const ip = process.env.SERVER_IP;
    if (ip && ip !== "0.0.0.0" && !ip.startsWith("127.")) return `http://${ip}:${porta()}`;
    if (ipDescoberto) return `http://${ipDescoberto}:${porta()}`;   // achado sozinho ao ligar
    return "";
}

// 🌐 descobre sozinho o IP público da hospedagem (pra ninguém precisar configurar)
let ipDescoberto = "";
async function descobrirIp() {
    if (CFG.URL || ler().url || ipDescoberto) return;
    for (const u of ["https://api.ipify.org", "https://ifconfig.me/ip", "https://icanhazip.com"]) {
        try {
            const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
            const ip = (await r.text()).trim();
            if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) { ipDescoberto = ip; console.log(`🔮 ESPAÇO CRUSH: endereço do jogo → http://${ip}:${porta()}/crush`); return; }
        } catch {}
    }
    console.log("⚠️ ESPAÇO CRUSH: não achei o IP sozinho. Use .crushlink http://IP:PORTA");
}
const linkDe = t => `${urlPublica()}/crush?t=${t}`;

// ───────────── servidor web (sobe uma vez só) ─────────────
let sockAtual = null;
function definirSock(sock) { sockAtual = sock; iniciarServidor(); }

function responder(res, codigo, corpo, tipo = "application/json; charset=utf-8") {
    res.writeHead(codigo, { "Content-Type": tipo, "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
    res.end(typeof corpo === "string" || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo));
}
function lerCorpo(req) {
    return new Promise(res => {
        let d = ""; req.on("data", c => { d += c; if (d.length > 1e4) req.destroy(); });
        req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch { res({}); } });
        req.on("error", () => res({}));
    });
}

function iniciarServidor() {
    if (global.__espacoCrushServidor) return;
    const srv = http.createServer(async (req, res) => {
        try {
            const u = new URL(req.url, "http://x");
            const rota = u.pathname.replace(/\/+$/, "") || "/";
            if (req.method === "OPTIONS") return responder(res, 204, "");
            if (rota === "/" ) { res.writeHead(302, { Location: "/crush" }); return res.end(); }
            if (rota === "/crush") return responder(res, 200, fs.readFileSync(path.join(PASTA, "jogo.html")), "text/html; charset=utf-8");
            if (rota === "/crush/nagatoro.jpg") return responder(res, 200, fs.readFileSync(path.join(PASTA, "nagatoro.jpg")), "image/jpeg");
            if (rota === "/crush/rosto.png") return responder(res, 200, fs.readFileSync(path.join(PASTA, "rosto.png")), "image/png");
            if (rota === "/crush/api/info") return responder(res, 200, apiInfo(u.searchParams.get("t")));
            if (rota === "/crush/api/inicio" && req.method === "POST") return responder(res, 200, apiInicio((await lerCorpo(req)).t));
            if (rota === "/crush/api/fim" && req.method === "POST") return responder(res, 200, await apiFim(await lerCorpo(req)));
            if (rota === "/crush/api/novo" && req.method === "POST") return responder(res, 200, apiNovo((await lerCorpo(req)).t));
            return responder(res, 404, { ok: false, erro: "não achei" });
        } catch (e) {
            console.error("⚠️ espaço crush (web):", e?.message || e);
            return responder(res, 500, { ok: false, erro: "erro no servidor" });
        }
    });
    srv.on("error", e => { console.error(`⚠️ ESPAÇO CRUSH: não consegui abrir a porta ${porta()} (${e.code || e.message}).`); global.__espacoCrushServidor = null; });
    srv.listen(porta(), "0.0.0.0", () => console.log(`🔮 ESPAÇO CRUSH no ar na porta ${porta()} ${urlPublica() ? "→ " + urlPublica() + "/crush" : "(coloque ESPACO_CRUSH.URL no config)"}`));
    global.__espacoCrushServidor = srv;
    descobrirIp().catch(() => {});
    // ⏱️ fecha desafios vencidos
    setInterval(() => verificarPrazos().catch(() => {}), 30 * 1000).unref?.();
}

// ───────────── API do jogo ─────────────
function sessaoValida(t) {
    const s = ler().sessoes[t];
    if (!s) return [null, "Link inválido. Peça um novo no grupo."];
    if (s.fim) return [null, "Esse link já foi usado. Peça outro no grupo."];
    if (Date.now() > s.expira) return [null, "Esse link expirou. Peça outro no grupo."];
    return [s, null];
}
function apiInfo(t) {
    const [s, erro] = sessaoValida(t);
    if (!s) return { ok: false, erro };
    if (s.inicio) return { ok: false, erro: "Essa partida já começou em outro lugar. Cada link é de uma partida só." };
    const j = ler().jogadores[s.id];
    return { ok: true, modo: s.modo, nome: s.nome, oponente: s.oponente || null, duracao: DURACAO, recorde: j?.melhor || 0, whatsapp: linkWhatsApp() };
}
function apiInicio(t) {
    const [s, erro] = sessaoValida(t);
    if (!s) return { ok: false, erro };
    if (s.inicio) return { ok: false, erro: "Essa partida já começou. Cada link é de uma partida só." };
    s.inicio = Date.now(); salvar();
    return { ok: true, duracao: DURACAO };
}
async function apiFim({ t, pontos, jogadas, combo }) {
    const db = ler();
    const s = db.sessoes[t];
    if (!s || !s.inicio) return { ok: false, erro: "Partida não encontrada." };
    if (s.fim) return { ok: false, erro: "Essa partida já foi registrada." };
    const decorrido = (Date.now() - s.inicio) / 1000;
    pontos = Math.max(0, Math.floor(Number(pontos) || 0));
    jogadas = Math.max(0, Math.floor(Number(jogadas) || 0));
    // 🛡️ trava simples contra trapaça: tempo mínimo e pontos possíveis pra quantidade de jogadas
    const suspeito = decorrido < DURACAO - 3 || jogadas > DURACAO * 3 || pontos > jogadas * 4000 + 2000;
    if (suspeito) { pontos = 0; console.log(`🛡️ ESPAÇO CRUSH: partida suspeita de ${s.nome} (${decorrido.toFixed(0)}s, ${jogadas} jogadas)`); }
    s.fim = Date.now(); s.pontos = pontos; s.combo = Number(combo) || 1;

    const j = jogador(s.id, s.nome);
    j.partidas++; j.total += pontos;
    const novoRecorde = pontos > j.melhor;
    if (novoRecorde) j.melhor = pontos;
    salvar();

    if (s.modo === "duelo") {
        const d = db.duelos[s.duelo];
        if (d && d.estado === "jogando") {
            d.jogadores[s.id].pontos = pontos;
            const outro = Object.keys(d.jogadores).find(k => k !== s.id);
            const aguardando = d.jogadores[outro].pontos == null;
            if (!aguardando) await finalizarDuelo(d.id);
            salvar();
            return { ok: true, modo: "duelo", pontos, aguardando, oponente: d.jogadores[outro].nome };
        }
        return { ok: true, modo: "duelo", pontos, aguardando: false };
    }
    const r = ranking();
    return { ok: true, modo: "solo", pontos, novoRecorde, posicao: (r.find(x => x.id === s.id)?.pos) || null, total: r.length };
}

// 🔄 "JOGAR DE NOVO": depois que termina, gera um link novo (partida solo) pra mesma pessoa
function apiNovo(t) {
    const s = ler().sessoes[t];
    if (!s || !s.fim) return { ok: false, erro: "Termine a partida antes de jogar de novo." };
    if (s.proximo) return { ok: true, t: s.proximo };          // já gerou (clicou 2x)
    s.proximo = criarSessao({ id: s.id, nome: s.nome, modo: "solo" });
    salvar();
    return { ok: true, t: s.proximo };
}

// 📲 link pra voltar pro WhatsApp (abre a conversa com o bot)
function linkWhatsApp() {
    const n = num(sockAtual?.user?.id || "");
    return n ? `https://wa.me/${n}` : "https://wa.me/";
}

function criarSessao({ id, nome, modo, duelo, oponente, expira }) {
    const db = ler();
    // um link solo aberto por pessoa: o antigo deixa de valer
    if (modo === "solo") for (const [t, s] of Object.entries(db.sessoes)) if (s.id === id && s.modo === "solo" && !s.fim) delete db.sessoes[t];
    // faxina: tira sessões velhas (mais de 1 dia)
    for (const [t, s] of Object.entries(db.sessoes)) if (Date.now() - s.criado > 86400000) delete db.sessoes[t];
    const t = token();
    db.sessoes[t] = { id, nome, modo, duelo: duelo || null, oponente: oponente || null, criado: Date.now(), expira: expira || Date.now() + VALIDADE_LINK, inicio: null, fim: null, pontos: null };
    salvar();
    return t;
}

// ───────────── mensagens ─────────────
async function enviarLinkPV(sock, jidPV, { t, modo, oponente }) {
    const MB = require("../menuBotoes/menuBotoes");
    const link = linkDe(t);
    const texto = [
        `> ❲ ⛮ ❳  ${modo === "duelo" ? "Duelo valendo" : "Partida solo"}  ❲ ⛮ ❳`,
        modo === "duelo" ? `> ❲ Contra ❳  ${oponente}` : `> ❲ Vale ❳  ranking`,
        `> ❲ Tempo ❳  ${DURACAO} segundos`,
        `> ❲ Link ❳`,
        `> ${link}`,
        ``,
        modo === "duelo" ? `⏱️ Você tem 10 minutos pra jogar. É uma partida só, então capricha!` : `💜 O link vale uma partida só.`,
        `> ${RODAPE}`
    ].join("\n");
    try {
        await MB.enviarNativeFlow(sock, jidPV, { text: texto, footer: "‎", buttons: [MB.botaoUrl("🎮 JOGAR AGORA", link)] });
    } catch {
        await sock.sendMessage(jidPV, { text: texto });
    }
}

async function cardJogo() {
    try { return await require("../cards-nagatoro/cards-nagatoro").criarCardCrush(); } catch (e) { console.error("⚠️ card crush:", e?.message || e); return null; }
}

function semUrl(sock, msg) {
    return sock.sendMessage(msg.key.remoteJid, {
        text: `> ❲ ⛮ ❳  ${NOME_JOGO}  ❲ ⛮ ❳\n\n⚙️ O jogo ainda não tá configurado.\nMeu dono precisa mandar ${config.PREFIX}crushlink http://IP:PORTA (o endereço da hospedagem).\n> ${RODAPE}`
    }, { quoted: msg });
}

// .crush
async function crush(sock, msg, args = []) {
    sockAtual = sock; iniciarServidor();
    const from = msg.key.remoteJid;
    if (!urlPublica()) await descobrirIp().catch(() => {});
    if (!urlPublica()) return semUrl(sock, msg);

    // .crush @pessoa → desafio direto
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const alvo = ctx?.mentionedJid?.[0] || (args.length && ctx?.participant) || null;
    if (alvo) return criarDuelo(sock, msg, limparJid(alvo));

    const MB = require("../menuBotoes/menuBotoes");
    const texto = [
        `> ❲ ⛮ ❳  ${NOME_JOGO}  ❲ ⛮ ❳`,
        `> ❲ Combine 3 ou mais gemas no meio do Sistema Solar`,
        `> ❲ Rodada de ${DURACAO} segundos`,
        `> ❲ Foguete, bomba e o Globo da Nagatoro`,
        ``,
        `❲ ⛮ ❳  Como jogar  ❲ ⛮ ❳`,
        `❲ 🎮 Jogar só: o link chega no seu PV`,
        `❲ ⚔️ Desafiar: quem fizer mais pontos ganha`,
        `❲ 🏆 Ranking: ${config.PREFIX}rankcrush`,
        `> ${RODAPE}`
    ].join("\n");
    const img = await cardJogo();
    const botoes = [MB.botao("🎮 JOGAR SÓ", "crush_solo"), MB.botao("⚔️ DESAFIAR ALGUÉM", "crush_desafiar")];
    try {
        return await MB.enviarNativeFlow(sock, from, { text: texto, footer: "‎", imageBuffer: img || undefined, buttons: botoes, quoted: msg });
    } catch {
        return sock.sendMessage(from, img ? { image: img, caption: texto } : { text: texto }, { quoted: msg });
    }
}

async function jogarSo(sock, msg) {
    if (!urlPublica()) return semUrl(sock, msg);
    const from = msg.key.remoteJid;
    const id = idDe(msg), nome = msg.pushName || num(id);
    jogador(id, nome);
    const t = criarSessao({ id, nome, modo: "solo" });
    try {
        await enviarLinkPV(sock, id, { t, modo: "solo" });
    } catch (e) {
        return sock.sendMessage(from, { text: `⚠️ Não consegui te chamar no PV. Me manda um "oi" no privado e tenta de novo.` }, { quoted: msg });
    }
    if (from.endsWith("@g.us")) {
        return sock.sendMessage(from, {
            text: `> ❲ ⛮ ❳  Link enviado  ❲ ⛮ ❳\n> ❲ @${num(id)}, seu link chegou no PV 💜\n> ${RODAPE}`,
            mentions: [id]
        }, { quoted: msg });
    }
}

// ───────────── duelos ─────────────
async function criarDuelo(sock, msg, alvoId = null) {
    const from = msg.key.remoteJid;
    if (!from.endsWith("@g.us")) return sock.sendMessage(from, { text: "⚔️ Desafio só dentro de grupo, senpai." }, { quoted: msg });
    if (!urlPublica()) return semUrl(sock, msg);
    const db = ler();
    const id = idDe(msg), nome = msg.pushName || num(id);
    if (alvoId && alvoId === id) return sock.sendMessage(from, { text: "😏 Desafiar você mesmo(a)? Carência nível máximo." }, { quoted: msg });
    // já tem um desafio aberto dessa pessoa?
    const aberto = Object.values(db.duelos).find(d => d.desafiante === id && (d.estado === "aberto" || d.estado === "jogando"));
    if (aberto) return sock.sendMessage(from, { text: "⏳ Você já tem um desafio rolando. Termina ele primeiro." }, { quoted: msg });
    jogador(id, nome);

    const dId = token().slice(0, 10);
    db.duelos[dId] = { id: dId, grupo: from, desafiante: id, alvo: alvoId, estado: "aberto", criado: Date.now(), prazo: Date.now() + PRAZO_ACEITAR,
        jogadores: { [id]: { nome, pontos: null } } };
    salvar();

    const MB = require("../menuBotoes/menuBotoes");
    const texto = [
        `> ❲ ⛮ ❳  Desafio lançado  ❲ ⛮ ❳`,
        `> ❲ Desafiante ❳  @${num(id)}`,
        alvoId ? `> ❲ Desafiado(a) ❳  @${num(alvoId)}` : `> ❲ Desafiado(a) ❳  quem tiver coragem`,
        `> ❲ Jogo ❳  ${NOME_JOGO}`,
        `> ❲ Prazo pra aceitar ❳  5 minutos`,
        ``,
        alvoId ? `😏 E aí, vai aceitar ou vai fugir?` : `😏 Quem encara? O primeiro que tocar em ACEITAR joga.`,
        `> ${RODAPE}`
    ].join("\n");
    const mencoes = [id, alvoId].filter(Boolean);
    const botoes = [MB.botao("✅ ACEITAR DESAFIO", `crush_aceitar:${dId}`)];
    if (alvoId) botoes.push(MB.botao("❌ RECUSAR", `crush_recusar:${dId}`));
    try {
        await MB.enviarNativeFlow(sock, from, { text: texto, footer: "‎", buttons: botoes, quoted: msg, mentions: mencoes });
    } catch {
        await sock.sendMessage(from, { text: texto + `\n\nPra aceitar: ${config.PREFIX}aceitarcrush ${dId}`, mentions: mencoes }, { quoted: msg });
    }
}

async function aceitar(sock, msg, dId) {
    const from = msg.key.remoteJid;
    const db = ler(), d = db.duelos[dId];
    const id = idDe(msg), nome = msg.pushName || num(id);
    if (!d || d.estado !== "aberto") return sock.sendMessage(from, { text: "⌛ Esse desafio não tá mais aberto." }, { quoted: msg });
    if (id === d.desafiante) return sock.sendMessage(from, { text: "😏 Aceitar o próprio desafio? Não, né." }, { quoted: msg });
    if (d.alvo && d.alvo !== id) return sock.sendMessage(from, { text: "🙄 Esse desafio não é pra você, intrometido(a)." }, { quoted: msg });
    jogador(id, nome);
    d.jogadores[id] = { nome, pontos: null };
    d.estado = "jogando"; d.prazo = Date.now() + PRAZO_JOGAR; d.adversario = id;
    const nomeA = d.jogadores[d.desafiante].nome;
    const expira = d.prazo + 2 * 60 * 1000;
    const tA = criarSessao({ id: d.desafiante, nome: nomeA, modo: "duelo", duelo: dId, oponente: nome, expira });
    const tB = criarSessao({ id, nome, modo: "duelo", duelo: dId, oponente: nomeA, expira });
    salvar();
    await sock.sendMessage(from, {
        text: [
            `> ❲ ⛮ ❳  Duelo aceito  ❲ ⛮ ❳`,
            `> ❲ ⚔️ ❳  @${num(d.desafiante)}  vs  @${num(id)}`,
            `> ❲ Tempo ❳  ${DURACAO} segundos cada`,
            `> ❲ Prazo ❳  10 minutos pros dois jogarem`,
            ``,
            `📩 O link chegou no PV de cada um. O resultado sai aqui!`,
            `> ${RODAPE}`
        ].join("\n"),
        mentions: [d.desafiante, id]
    }, { quoted: msg });
    await enviarLinkPV(sock, d.desafiante, { t: tA, modo: "duelo", oponente: nome }).catch(() => {});
    await enviarLinkPV(sock, id, { t: tB, modo: "duelo", oponente: nomeA }).catch(() => {});
}

async function recusar(sock, msg, dId) {
    const from = msg.key.remoteJid;
    const db = ler(), d = db.duelos[dId];
    const id = idDe(msg);
    if (!d || d.estado !== "aberto") return;
    if (d.alvo && d.alvo !== id) return sock.sendMessage(from, { text: "🙄 Não é você quem decide esse desafio." }, { quoted: msg });
    d.estado = "fim"; d.resultado = "recusado"; salvar();
    return sock.sendMessage(from, {
        text: `> ❲ ⛮ ❳  Desafio recusado  ❲ ⛮ ❳\n> ❲ @${num(id)} correu do duelo contra @${num(d.desafiante)}\n\n😏 Medinho de perder, né?\n> ${RODAPE}`,
        mentions: [id, d.desafiante]
    }, { quoted: msg });
}

const DEBOCHE_VITORIA = [
    "Humilhação espacial. Alguém chama a NASA pro perdedor 🚀",
    "Perdeu feio. Até o Plutão teve mais moral 😏",
    "Foi atropelado(a) por um cometa. Descansa em paz 🪦",
    "Volta pro tutorial, perdedor(a)~ 💜"
];

async function finalizarDuelo(dId, porPrazo = false) {
    const db = ler(), d = db.duelos[dId];
    if (!d || d.estado !== "jogando") return;
    d.estado = "fim";
    const [a, b] = [d.desafiante, d.adversario];
    const A = d.jogadores[a], B = d.jogadores[b];
    const pa = A.pontos, pb = B.pontos;
    let vencedor = null, perdedor = null, wo = false;
    if (pa == null && pb == null) { d.resultado = "ninguem"; }
    else if (pa == null || pb == null) { wo = true; vencedor = pa == null ? b : a; perdedor = pa == null ? a : b; }
    else if (pa !== pb) { vencedor = pa > pb ? a : b; perdedor = pa > pb ? b : a; }
    d.resultado = vencedor ? "vitoria" : (d.resultado || "empate"); d.vencedor = vencedor;

    // 📊 estatísticas + último duelo no perfil
    const registrar = (eu, outro) => {
        const j = jogador(eu), o = d.jogadores[outro];
        const res = !vencedor ? (d.resultado === "ninguem" ? "cancelado" : "empate") : (vencedor === eu ? "vitoria" : "derrota");
        if (res === "vitoria") j.vitorias++; else if (res === "derrota") j.derrotas++; else if (res === "empate") j.empates++;
        j.ultimoDuelo = { oponente: outro, oponenteNome: o.nome, meus: d.jogadores[eu].pontos || 0, deles: o.pontos || 0, resultado: res, wo, ts: Date.now() };
    };
    if (d.resultado !== "ninguem") { registrar(a, b); registrar(b, a); }
    salvar();

    const sock = sockAtual; if (!sock) return;
    let texto, mencoes = [a, b];
    if (d.resultado === "ninguem") {
        texto = `> ❲ ⛮ ❳  Duelo cancelado  ❲ ⛮ ❳\n> ❲ @${num(a)} e @${num(b)} não jogaram a tempo\n\n🥱 Dois medrosos. Combinam.\n> ${RODAPE}`;
    } else if (!vencedor) {
        texto = `> ❲ ⛮ ❳  Empate  ❲ ⛮ ❳\n> ❲ @${num(a)} ❳  ${fmt(pa)}\n> ❲ @${num(b)} ❳  ${fmt(pb)}\n\n😳 Mesma pontuação? Isso é raro até no espaço.\n> ${RODAPE}`;
    } else {
        const pv = d.jogadores[vencedor].pontos, pp = d.jogadores[perdedor].pontos;
        texto = [
            `> ❲ ⛮ ❳  Resultado do duelo  ❲ ⛮ ❳`,
            `> ❲ 🏆 Vencedor(a) ❳  @${num(vencedor)}`,
            `> ❲ Pontos ❳  ${fmt(pv)}`,
            `> ❲ 💀 Perdedor(a) ❳  @${num(perdedor)}`,
            `> ❲ Pontos ❳  ${wo ? "não jogou (W.O.)" : fmt(pp)}`,
            ``,
            wo ? `🏃 Fugiu do duelo e perdeu sem jogar. Vergonha~` : sortear(DEBOCHE_VITORIA),
            `> ${RODAPE}`
        ].join("\n");
    }
    let img = null;
    try {
        if (d.resultado !== "ninguem") img = await require("../cards-nagatoro/cards-nagatoro").criarCardDueloCrush({
            nomeA: A.nome, pontosA: pa, nomeB: B.nome, pontosB: pb, vencedor: vencedor === a ? "A" : vencedor === b ? "B" : null
        });
    } catch (e) { console.error("⚠️ card duelo crush:", e?.message || e); }
    try { await sock.sendMessage(d.grupo, img ? { image: img, caption: texto, mentions: mencoes } : { text: texto, mentions: mencoes }); } catch {}
}

async function verificarPrazos() {
    const db = ler(), agora = Date.now();
    for (const d of Object.values(db.duelos)) {
        if (d.estado === "aberto" && agora > d.prazo) {
            d.estado = "fim"; d.resultado = "expirou"; salvar();
            if (sockAtual) await sockAtual.sendMessage(d.grupo, {
                text: `> ❲ ⛮ ❳  Desafio expirou  ❲ ⛮ ❳\n> ❲ Ninguém teve coragem de encarar @${num(d.desafiante)}\n> ${RODAPE}`,
                mentions: [d.desafiante]
            }).catch(() => {});
        } else if (d.estado === "jogando" && agora > d.prazo) {
            // quem já abriu o jogo ganha mais 2 min pra terminar a rodada
            const jogando = Object.keys(d.jogadores).some(k => {
                const s = Object.values(db.sessoes).find(s => s.duelo === d.id && s.id === k);
                return s && s.inicio && !s.fim && agora - s.inicio < (DURACAO + 60) * 1000;
            });
            if (!jogando) await finalizarDuelo(d.id, true);
        }
        // faxina: duelos encerrados há mais de 7 dias
        if (d.estado === "fim" && agora - d.criado > 7 * 86400000) delete db.duelos[d.id];
    }
}

// ───────────── botões ─────────────
async function processarBotao(sock, msg, idBotao) {
    sockAtual = sock; iniciarServidor();
    if (idBotao === "crush_solo") { await jogarSo(sock, msg); return true; }
    if (idBotao === "crush_desafiar") { await criarDuelo(sock, msg, null); return true; }
    if (idBotao.startsWith("crush_aceitar:")) { await aceitar(sock, msg, idBotao.slice(14)); return true; }
    if (idBotao.startsWith("crush_recusar:")) { await recusar(sock, msg, idBotao.slice(14)); return true; }
    return false;
}

// ───────────── .crushlink http://IP:PORTA (só o dono) ─────────────
async function crushLink(sock, msg, args = []) {
    const from = msg.key.remoteJid;
    let dono = false;
    try { dono = require("../utils-validacao/utils-validacao").ehDono([msg.key.participant || msg.key.remoteJid], config.OWNER_NUMBER); } catch {}
    if (!dono && !msg.key.fromMe) return sock.sendMessage(from, { text: "🙄 Só o meu dono mexe nisso." }, { quoted: msg });
    const url = String(args[0] || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\/[^\s]+$/i.test(url)) {
        return sock.sendMessage(from, { text: `> ❲ ⛮ ❳  Endereço do jogo  ❲ ⛮ ❳\n> ❲ Atual ❳  ${urlPublica() || "nenhum"}\n> ❲ Porta aberta ❳  ${porta()}\n\nUse: ${config.PREFIX}crushlink http://IP:PORTA\n(o IP e a porta aparecem no painel da hospedagem)\n> ${RODAPE}` }, { quoted: msg });
    }
    ler().url = url; salvar();
    iniciarServidor();
    return sock.sendMessage(from, { text: `> ❲ ⛮ ❳  Endereço salvo  ❲ ⛮ ❳\n> ${url}/crush\n\n✅ Abre esse link no navegador pra testar.\n> ${RODAPE}` }, { quoted: msg });
}

// ───────────── ranking ─────────────
async function rankCrush(sock, msg) {
    const from = msg.key.remoteJid;
    const r = ranking();
    const id = idDe(msg);
    const eu = r.find(x => x.id === id);
    const medalha = ["🥇", "🥈", "🥉"];
    const linhas = r.slice(0, 10).map((x, i) => `> ❲ ${medalha[i] || (i + 1) + "º"} ❳  ${x.nome} · ${fmt(x.melhor)}`);
    const texto = [
        `> ❲ ⛮ ❳  Ranking ${NOME_JOGO}  ❲ ⛮ ❳`,
        ...(linhas.length ? linhas : [`> ❲ Ninguém jogou ainda. Seja o(a) primeiro(a)!`]),
        ``,
        `❲ ⛮ ❳  Sua posição  ❲ ⛮ ❳`,
        eu ? `❲ #${eu.pos} de ${r.length} · recorde ${fmt(eu.melhor)} · ${eu.vitorias}V ${eu.derrotas}D` : `❲ Você ainda não jogou. Use ${config.PREFIX}crush`,
        `> ${RODAPE}`
    ].join("\n");
    let img = null;
    try {
        img = await require("../cards-nagatoro/cards-nagatoro").criarCardRankJornal({
            titulo: "RANKING ESPAÇO CRUSH", nomeGrupo: "Ranking geral", subtitulo: "NAGATORO • ESPAÇO CRUSH",
            lista: r.slice(0, 5).map(x => ({ nome: x.nome, direita: `${fmt(x.melhor)} pts • ${x.vitorias}V` }))
        });
    } catch (e) { console.error("⚠️ card rank crush:", e?.message || e); }
    return sock.sendMessage(from, img ? { image: img, caption: texto } : { text: texto }, { quoted: msg });
}

// ───────────── perfil ─────────────
// Linhas do jogo pro .perfil (ids = os jeitos que a pessoa pode estar salva)
function linhasPerfil(ids = []) {
    const db = ler();
    const id = ids.map(limparJid).find(i => db.jogadores[i]);
    if (!id) return null;
    const j = db.jogadores[id];
    const r = ranking(), pos = r.find(x => x.id === id)?.pos;
    const l = [
        `❲ ⛮ ❳  ${NOME_JOGO}  ❲ ⛮ ❳`,
        `❲ Ranking ❳  ${pos ? `#${pos} de ${r.length}` : "sem pontuação"}`,
        `❲ Recorde ❳  ${fmt(j.melhor)} pts`,
        `❲ Duelos ❳  ${j.vitorias}V · ${j.derrotas}D${j.empates ? ` · ${j.empates}E` : ""}`
    ];
    const u = j.ultimoDuelo;
    if (u && u.resultado !== "cancelado") {
        const emoji = u.resultado === "vitoria" ? "🏆 venceu" : u.resultado === "derrota" ? "💀 perdeu pra" : "🤝 empatou com";
        l.push(`❲ Último duelo ❳  ${emoji} ${u.oponenteNome}`);
        l.push(`❲ Placar ❳  ${fmt(u.meus)} x ${u.wo && !u.deles ? "W.O." : fmt(u.deles)}`);
    }
    return l.join("\n");
}

module.exports = { crush, crushLink, rankCrush, processarBotao, linhasPerfil, definirSock, iniciarServidor, urlPublica, _ler: ler, _apiFim: apiFim, _apiInicio: apiInicio, _apiInfo: apiInfo, _finalizarDuelo: finalizarDuelo };
