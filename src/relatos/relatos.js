/* =================================================
   📨 NAGATORO — RELATOS PRO DONO (bug, sugestão, avaliação e demora)
   📁 Arquivo: relatos.js

   .bug / .sugestao / .avalie
     • com texto junto (.bug o play travou) → já manda
     • com foto/vídeo junto (legenda ".bug texto") ou marcando uma foto → já manda
     • só o comando → o bot pede: "escreve ou manda um print" (3 minutos)
       e a PRÓXIMA mensagem da pessoa (texto, foto, vídeo, áudio) vai pro dono.
       "cancelar" desiste.
   Chega no PV do dono com: quem foi (nome + número), grupo, data/hora e
   os horários dos relatos anteriores dessa mesma pessoa.

   ⏱️ DEMORA: o nagatoro.js mede cada comando. Passou do tempo normal
   DAQUELE comando (música pode mais, menu pode menos), aparece o botão
   "📝 RELATAR DEMORA". Tocou → o dono recebe o que estava rodando e quanto demorou.
================================================= */
const fs = require("fs");
const path = require("path");
const config = require("../../config");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const ARQ = path.join(__dirname, "../../database/relatos.json");
const TIPOS = {
    bug:      { icone: "🐛", nome: "BUG",        pedir: "🐛 Me conta o que aconteceu: escreve a mensagem ou manda um *print/foto* do problema." },
    sugestao: { icone: "💡", nome: "SUGESTÃO",   pedir: "💡 Manda a sua ideia: escreve aqui ou manda uma foto/print." },
    avalie:   { icone: "⭐", nome: "AVALIAÇÃO",  pedir: "⭐ Escreve o que achou do bot (pode começar com a nota, ex.: *5 amei*)." },
    demora:   { icone: "⏱️", nome: "DEMORA",     pedir: "" }
};
const PRAZO_MS = 3 * 60 * 1000;
const pendentes = new Map();   // chat|pessoa -> { tipo, ate }
const demoras = new Map();     // token -> contexto do comando lento

// ── utilidades ──
const num = (j) => String(j || "").split("@")[0].split(":")[0];
const quemDe = (msg) => msg.key.participantAlt || msg.key.participant || msg.key.remoteJid;
const chave = (msg) => msg.key.remoteJid + "|" + num(msg.key.participant || msg.key.remoteJid);
const donoJid = () => String(config.OWNER_NUMBER || "").replace(/\D/g, "") + "@s.whatsapp.net";
const hora = (t = Date.now()) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

function ler() { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")); } catch { return { seq: 0, lista: [] }; } }
function salvar(db) { try { fs.mkdirSync(path.dirname(ARQ), { recursive: true }); fs.writeFileSync(ARQ, JSON.stringify(db, null, 2)); } catch {} }

function desembrulhar(m) {
    for (let i = 0; i < 6 && m; i++) {
        const d = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message;
        if (!d) break; m = d;
    }
    return m || null;
}
async function baixar(parte, tipo) {
    const s = await downloadContentFromMessage(parte, tipo); const b = [];
    for await (const p of s) b.push(p); return Buffer.concat(b);
}
// pega mídia da mensagem (ou da marcada) pra anexar ao relato
async function midiaDe(msg) {
    const base = desembrulhar(msg.message) || {};
    let alvo = base;
    if (!(base.imageMessage || base.videoMessage || base.audioMessage || base.documentMessage || base.stickerMessage)) {
        for (const v of Object.values(base)) if (v?.contextInfo?.quotedMessage) { alvo = desembrulhar(v.contextInfo.quotedMessage) || {}; break; }
    }
    try {
        if (alvo.imageMessage) return { image: await baixar(alvo.imageMessage, "image"), legenda: alvo.imageMessage.caption || "" };
        if (alvo.videoMessage) return { video: await baixar(alvo.videoMessage, "video"), legenda: alvo.videoMessage.caption || "" };
        if (alvo.audioMessage) return { audio: await baixar(alvo.audioMessage, "audio"), mimetype: alvo.audioMessage.mimetype || "audio/ogg; codecs=opus", ptt: !!alvo.audioMessage.ptt };
        if (alvo.stickerMessage) return { sticker: await baixar(alvo.stickerMessage, "sticker") };
        if (alvo.documentMessage) return { document: await baixar(alvo.documentMessage, "document"), mimetype: alvo.documentMessage.mimetype || "application/octet-stream", fileName: alvo.documentMessage.fileName || "arquivo", legenda: alvo.documentMessage.caption || "" };
    } catch (e) { console.error("⚠️ relatos: não baixei a mídia:", e?.message || e); }
    return null;
}
function textoDe(msg) {
    const m = desembrulhar(msg.message) || {};
    return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || "";
}
function tirarComando(t) {
    const P = String(config.PREFIX || ".").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return String(t || "").replace(new RegExp("^\\s*" + P + "\\s*(bug|sugestao|sugestão|avalie|avaliar)\\b", "i"), "").trim();
}

// ── envia pro dono ──
async function enviarAoDono(sock, msg, tipo, texto, midia, extra = "") {
    const T = TIPOS[tipo] || TIPOS.bug;
    const quem = quemDe(msg), nome = msg.pushName || "sem nome", grupoJid = msg.key.remoteJid;
    let grupoNome = grupoJid.endsWith("@g.us") ? "grupo" : "PV";
    if (grupoJid.endsWith("@g.us")) { try { grupoNome = (await sock.groupMetadata(grupoJid)).subject || grupoNome; } catch {} }

    const db = ler(); db.seq = (db.seq || 0) + 1;
    const anteriores = db.lista.filter(r => r.quem === num(quem)).slice(-5).map(r => `${r.hora} (${TIPOS[r.tipo]?.nome || r.tipo})`);
    db.lista.push({ id: db.seq, tipo, quem: num(quem), nome, grupo: grupoNome, hora: hora(), texto: String(texto || "").slice(0, 1000) });
    db.lista = db.lista.slice(-500); salvar(db);

    const cab = `${T.icone} *${T.nome} #${db.seq}*\n\n👤 ${nome} (@${num(quem)})\n👥 ${grupoJid.endsWith("@g.us") ? "Grupo: " + grupoNome : "No PV"}\n🕐 ${hora()}` +
        (extra ? `\n${extra}` : "") +
        (texto ? `\n\n📝 ${texto}` : "") +
        (anteriores.length ? `\n\n📚 Relatos anteriores dessa pessoa:\n• ${anteriores.join("\n• ")}` : "");
    const dono = donoJid();
    if (midia?.image) await sock.sendMessage(dono, { image: midia.image, caption: cab, mentions: [quem] });
    else if (midia?.video) await sock.sendMessage(dono, { video: midia.video, caption: cab, mentions: [quem] });
    else if (midia?.document) await sock.sendMessage(dono, { document: midia.document, mimetype: midia.mimetype, fileName: midia.fileName, caption: cab, mentions: [quem] });
    else {
        await sock.sendMessage(dono, { text: cab, mentions: [quem] });
        if (midia?.audio) await sock.sendMessage(dono, { audio: midia.audio, mimetype: midia.mimetype, ptt: midia.ptt });
        if (midia?.sticker) await sock.sendMessage(dono, { sticker: midia.sticker });
    }
    return db.seq;
}

const AGRADECER = {
    bug: ["🐛 Relatório #{n} enviado pro meu dono. Se for culpa sua, eu vou saber 😏", "🐛 Anotado (#{n}). Meu dono vai olhar. Obrigada por dedurar o bug~"],
    sugestao: ["💡 Sugestão #{n} entregue pro meu dono. Vamos ver se ela presta 😌", "💡 Mandei sua ideia (#{n}). Quem sabe vira comando, né~"],
    avalie: ["⭐ Avaliação #{n} enviada. Se for 5 estrelas, eu já sabia 😏", "⭐ Obrigada pela avaliação (#{n}). Meu dono vai ler~"],
    demora: ["⏱️ Avisei meu dono sobre a demora (#{n}). Valeu por relatar!"]
};
const sortear = (l) => l[Math.floor(Math.random() * l.length)];

// ── comando .bug / .sugestao / .avalie ──
async function cmdRelato(sock, msg, tipo, args = []) {
    const from = msg.key.remoteJid;
    const texto = args.join(" ").trim() || tirarComando(textoDe(msg));
    const midia = await midiaDe(msg);
    if (texto || midia) {
        const legenda = midia?.legenda && midia.legenda !== textoDe(msg) ? midia.legenda : "";
        const n = await enviarAoDono(sock, msg, tipo, [texto, legenda].filter(Boolean).join("\n"), midia);
        return sock.sendMessage(from, { text: sortear(AGRADECER[tipo]).replace("{n}", n) }, { quoted: msg });
    }
    pendentes.set(chave(msg), { tipo, ate: Date.now() + PRAZO_MS });
    return sock.sendMessage(from, { text: `${TIPOS[tipo].pedir}\n\n⏳ Tenho 3 minutos de paciência. Pra desistir, manda *cancelar*.` }, { quoted: msg });
}

/** Chamado em toda mensagem: se a pessoa tem relato pendente, essa mensagem vira o relato. */
async function processarRelatoPendente(sock, msg) {
    if (!pendentes.size || msg.key.fromMe) return false;
    const k = chave(msg), p = pendentes.get(k);
    if (!p) return false;
    if (Date.now() > p.ate) { pendentes.delete(k); return false; }
    const texto = textoDe(msg).trim();
    if (texto.startsWith(config.PREFIX)) return false; // comando novo: deixa passar
    if (/^cancelar$/i.test(texto)) { pendentes.delete(k); await sock.sendMessage(msg.key.remoteJid, { text: "👌 Cancelado. Nada foi enviado." }, { quoted: msg }); return true; }
    const midia = await midiaDe(msg);
    if (!texto && !midia) return false;
    pendentes.delete(k);
    const n = await enviarAoDono(sock, msg, p.tipo, texto, midia);
    await sock.sendMessage(msg.key.remoteJid, { text: sortear(AGRADECER[p.tipo]).replace("{n}", n) }, { quoted: msg });
    return true;
}

// ── ⏱️ DEMORA ──
// tempo normal de cada comando (em segundos). Passou disso → aparece o botão.
const LIMITE_DOWNLOAD = 90, LIMITE_MIDIA = 35, LIMITE_MENU = 12, LIMITE_PADRAO = 15;
const DOWNLOADS = new Set(["play", "musica", "dvcl-yt", "video", "baixarvideo", "tiktok", "instagram", "kwai", "pinterest", "dvcl-prt", "dvcl-ptr", "mediafire", "media-fire", "tomp3", "musica-aleatoria", "letra"]);
const MIDIA = new Set(["s", "sticker", "figurinha", "sf", "semfundo", "attp", "attp2", "attp3", "attp4", "attp5", "gif", "toimg", "artenome", "artenomegif", "meme", "logos", "efeitos", "gtts", "voz", "esquilo", "grave", "demonio", "robo", "eco", "nightcore", "rapido", "lento", "radio", "vaporwave", "reverso", "coral", "dueto", "8bit", "distorcao"]);
const NUNCA = new Set(["broadcast", "bc", "transmitir", "restart", "backup", "bug", "sugestao", "avalie", "jogodavelha", "velha", "ttt", "forca", "quiz", "adivinha"]);
function limiteDe(cmd) {
    if (DOWNLOADS.has(cmd)) return LIMITE_DOWNLOAD;
    if (MIDIA.has(cmd)) return LIMITE_MIDIA;
    if (/^menu|^brincadeiras$/.test(cmd)) return LIMITE_MENU;
    return LIMITE_PADRAO;
}
const OQUE = (cmd) => DOWNLOADS.has(cmd) ? "baixando mídia" : MIDIA.has(cmd) ? "montando figurinha/áudio" : /^menu/.test(cmd) ? "abrindo o menu" : "executando o comando";

/** Começa a vigiar um comando. Devolve { fim() } pra chamar quando ele terminar. */
function vigiarComando(sock, msg, cmd, args = []) {
    if (config.RELATAR_DEMORA === false || NUNCA.has(cmd)) return { fim() {} };
    const limite = limiteDe(cmd), inicio = Date.now();
    const ctx = { cmd, args: args.join(" ").slice(0, 120), inicio, limite, fimEm: 0, relatado: false, chat: msg.key.remoteJid, msg };
    const timer = setTimeout(async () => {
        const token = Math.random().toString(36).slice(2, 10);
        demoras.set(token, ctx); setTimeout(() => demoras.delete(token), 30 * 60 * 1000).unref?.();
        const quem = msg.key.participant || msg.key.participantAlt || msg.key.remoteJid;
        const texto = `⏳ @${num(quem)}, o *${config.PREFIX}${cmd}* tá demorando mais que o normal (passou de ${limite}s, ${OQUE(cmd)}).\n\nSe quiser, toca no botão que eu aviso meu dono.`;
        try {
            const { enviarNativeFlow } = require("../menuBotoes/menuBotoes");
            await enviarNativeFlow(sock, ctx.chat, {
                text: texto, footer: "🧣 " + (config.BOT_NAME || "Nagatoro"), quoted: msg, mentions: [quem],
                buttons: [{ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "📝 RELATAR DEMORA", id: "relatar_demora:" + token }) }]
            });
        } catch {
            try { await sock.sendMessage(ctx.chat, { text: texto.replace("toca no botão", `manda *${config.PREFIX}bug*`), mentions: [quem] }, { quoted: msg }); } catch {}
        }
    }, limite * 1000);
    timer.unref?.();
    return { fim() { clearTimeout(timer); ctx.fimEm = Date.now(); } };
}

/** Clique no botão "📝 RELATAR DEMORA" */
async function processarBotaoDemora(sock, msg, idBotao) {
    const token = String(idBotao).slice("relatar_demora:".length), ctx = demoras.get(token);
    if (!ctx) { await sock.sendMessage(msg.key.remoteJid, { text: `Esse aviso já expirou. Se ainda quiser relatar, manda *${config.PREFIX}bug*.` }, { quoted: msg }); return true; }
    if (ctx.relatado) { await sock.sendMessage(msg.key.remoteJid, { text: "👌 Essa demora já foi relatada, valeu!" }, { quoted: msg }); return true; }
    ctx.relatado = true;
    const s = (ms) => Math.round(ms / 1000);
    const status = ctx.fimEm ? `terminou em ${s(ctx.fimEm - ctx.inicio)}s` : `ainda rodando (${s(Date.now() - ctx.inicio)}s até agora)`;
    const extra = `⚙️ Comando: ${config.PREFIX}${ctx.cmd}${ctx.args ? " " + ctx.args : ""}\n🔎 O que fazia: ${OQUE(ctx.cmd)}\n⏱️ Normal: até ${ctx.limite}s · ${status}`;
    const n = await enviarAoDono(sock, msg, "demora", "", null, extra);
    await sock.sendMessage(msg.key.remoteJid, { text: sortear(AGRADECER.demora).replace("{n}", n) + `\nQuer explicar mais? Manda *${config.PREFIX}bug* com o que aconteceu.` }, { quoted: msg });
    return true;
}

module.exports = { cmdRelato, processarRelatoPendente, vigiarComando, processarBotaoDemora };
