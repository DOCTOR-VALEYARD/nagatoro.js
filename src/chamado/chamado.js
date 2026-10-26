/* =================================================
   📣 NAGATORO — QUANDO CHAMAM "BOT" OU "NAGATORO"
   📁 Arquivo: chamado.js

   Responde quando alguém fala "bot", "boot", "bots", "nagatoro",
   "nagatoro-san" ou "hayase" — no começo, no meio ou no fim da
   frase, maiúsculo/minúsculo, com letra repetida ("bottt",
   "nagatorooo"), com ou sem prefixo (.bot / .nagatoro) — ou quando
   marcam o número dela (@).

   Como ela responde:
   1. Se xingaram ela junto (ex.: "bot burro") → resposta ao xingamento
      (src/boot/boot.js — liga/desliga em .ativar)
   2. Se a IA estiver ligada no chat (.ia) → a IA responde com contexto
   3. Senão → áudio OU mensagem da situação "chamado", revezando
      (src/midias/audios/chamado + src/midias/mensagens/chamado)

   🛡️ Anti-spam: a mesma pessoa só dispara de novo depois de alguns
   segundos (ninguém consegue fazer ela floodar o grupo).
================================================= */

const { enviarAudioDaPasta } = require("../audio-pastas/audio-pastas");
const { bootHandler, temXingamento } = require("../boot/boot");
const { processarIA, iaAtivaNoChat } = require("../nagatoro-ia/nagatoro-ia");

const COOLDOWN_PESSOA_MS = 20 * 1000;
const COOLDOWN_CHAT_MS = 4 * 1000;
const ultimoPessoa = new Map();
const ultimoChat = new Map();

const NOMES = ["bot", "bots", "boot", "boots", "nagatoro", "nagatorosan", "nagatoro san", "hayase"];

function normalizar(texto) {
    return String(texto || "")
        .slice(0, 2000)
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[-_]/g, " ");
}

const REGEX_NOME = new RegExp(`(?<![a-z0-9])(?:${NOMES.map(n => n.replace(/ /g, "\\s*")).join("|")})(?![a-z0-9])`);

function falouONome(texto) {
    const base = normalizar(texto);
    if (!base) return false;
    if (REGEX_NOME.test(base)) return true;
    // letras repetidas: "bottt", "nagatorooo", "booot"
    const encurtado = base.replace(/(.)\1+/g, "$1");
    return REGEX_NOME.test(encurtado) || /(?<![a-z0-9])bo+t+s?(?![a-z0-9])/.test(base);
}

function numeroDe(jid) { return String(jid || "").split("@")[0].split(":")[0]; }

function marcouOBot(msg, sock) {
    const ids = [sock?.user?.id, sock?.user?.lid].filter(Boolean).map(numeroDe);
    const ctx = msg.message?.extendedTextMessage?.contextInfo
        || msg.message?.imageMessage?.contextInfo
        || msg.message?.videoMessage?.contextInfo;
    return (ctx?.mentionedJid || []).some(j => ids.includes(numeroDe(j)));
}

function foiChamada(sock, msg, body) {
    return falouONome(body) || marcouOBot(msg, sock);
}

function podeResponder(chat, pessoa) {
    const agora = Date.now();
    const kp = `${chat}::${pessoa}`;
    if (agora - (ultimoPessoa.get(kp) || 0) < COOLDOWN_PESSOA_MS) return false;
    if (agora - (ultimoChat.get(chat) || 0) < COOLDOWN_CHAT_MS) return false;
    ultimoPessoa.set(kp, agora);
    ultimoChat.set(chat, agora);
    return true;
}

// Responde o chamado. Retorna true se respondeu.
// { semCooldown: true } = veio de comando com prefixo (.bot / .nagatoro)
async function responderChamado(sock, msg, body, { semCooldown = false } = {}) {
    const from = msg.key.remoteJid;
    const autor = msg.key.participant || msg.key.participantAlt || from;
    if (!semCooldown && !podeResponder(from, autor)) return false;

    // 1) xingou ela junto? responde o xingamento
    if (temXingamento(body)) {
        try { if (await bootHandler(sock, msg, body)) return true; } catch {}
    }

    // 2) IA ligada nesse chat? ela responde com contexto
    if (iaAtivaNoChat(from)) {
        try {
            if (await processarIA(sock, msg, from, sock.user?.id || "0@c.us", { forcar: true })) return true;
        } catch {}
    }

    // 3) áudio ou mensagem debochada (revezando)
    const enviou = await enviarAudioDaPasta(sock, from, "chamado", { mentions: [autor], quoted: msg });
    return !!enviou;
}

module.exports = { foiChamada, falouONome, responderChamado };
