/* =================================================
   🛡️ NAGATORO — BASE DOS SISTEMAS DE SEGURANÇA
   (antip • antib • antir • antig)

   Funções compartilhadas: configuração por grupo, cache de admins,
   desembrulhar mensagem e rodapé padrão. Tudo protegido com try/catch:
   nenhuma falha aqui pode derrubar o bot.
================================================= */
const config = require("../../config");
const { getDB, saveDB } = require("../grupo-db/grupo-db");
const { ehDono } = require("../utils-validacao/utils-validacao");

// ── Normaliza id (tira :device e @dominio) ──
function norm(id) {
    return String(id || "").split(":")[0].split("@")[0];
}

// ── Configuração por grupo, guardada em grupos.json → db[grupo].seg[sistema] ──
function lerCfg(grupo, sistema, padrao = {}) {
    try {
        const db = getDB();
        const atual = db?.[grupo]?.seg?.[sistema] || {};
        return { ...padrao, ...atual };
    } catch { return { ...padrao }; }
}

function salvarCfg(grupo, sistema, valores) {
    try {
        const db = getDB();
        if (!db[grupo]) db[grupo] = {};
        if (!db[grupo].seg) db[grupo].seg = {};
        db[grupo].seg[sistema] = { ...(db[grupo].seg[sistema] || {}), ...valores };
        saveDB(db);
        return db[grupo].seg[sistema];
    } catch (e) {
        console.error(`⚠️ [${sistema}] falha ao salvar config:`, e?.message || e);
        return null;
    }
}

// ── Cache curto de metadados (evita consultar o WhatsApp a cada mensagem) ──
const cacheMeta = new Map(); // grupo -> { meta, quando }
const TTL_META = 30 * 1000;

async function metaGrupo(sock, grupo, forcar = false) {
    const c = cacheMeta.get(grupo);
    if (!forcar && c && Date.now() - c.quando < TTL_META) return c.meta;
    try {
        const meta = await sock.groupMetadata(grupo);
        cacheMeta.set(grupo, { meta, quando: Date.now() });
        if (cacheMeta.size > 500) cacheMeta.delete(cacheMeta.keys().next().value);
        return meta;
    } catch { return c?.meta || null; }
}

function limparCacheMeta(grupo) { cacheMeta.delete(grupo); }

function acharParticipante(meta, id) {
    const alvo = norm(id);
    return (meta?.participants || []).find(p =>
        [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).some(x => norm(x) === alvo)
    );
}

// Dono do bot e o próprio bot nunca são punidos
function ehIntocavel(sock, ids) {
    const lista = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (ehDono(lista, config.OWNER_NUMBER)) return true;
    const eu = [sock.user?.id, sock.user?.lid].filter(Boolean).map(norm);
    return lista.some(i => eu.includes(norm(i)));
}

async function ehAdminGrupo(sock, grupo, ids) {
    const lista = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (ehIntocavel(sock, lista)) return true;
    const meta = await metaGrupo(sock, grupo);
    if (!meta) return false;
    return lista.some(i => !!acharParticipante(meta, i)?.admin);
}

async function botEhAdmin(sock, grupo) {
    const meta = await metaGrupo(sock, grupo);
    if (!meta) return false;
    const eu = [sock.user?.id, sock.user?.lid].filter(Boolean);
    return eu.some(i => !!acharParticipante(meta, i)?.admin);
}

// ── Autor da mensagem ──
function autorMsg(msg) {
    return msg?.key?.participant || msg?.key?.participantAlt || msg?.key?.remoteJid;
}

// ── Desembrulha efêmera / visualização única / documento com legenda / editada ──
function conteudoReal(message) {
    let m = message || {};
    for (let i = 0; i < 6; i++) {
        const interno = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message
            || m.viewOnceMessageV2Extension?.message || m.documentWithCaptionMessage?.message || m.editedMessage?.message;
        if (!interno) break;
        m = interno;
    }
    return m;
}

function textoDe(m) {
    return String(
        m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption ||
        m?.videoMessage?.caption || m?.documentMessage?.caption || ""
    );
}

// ── Ações seguras (nunca lançam erro) ──
async function apagar(sock, grupo, key) {
    try { await sock.sendMessage(grupo, { delete: key }); return true; } catch { return false; }
}
async function remover(sock, grupo, jid) {
    try { await sock.groupParticipantsUpdate(grupo, [jid], "remove"); return true; } catch { return false; }
}
async function enviar(sock, grupo, conteudo, opcoes) {
    try { return await sock.sendMessage(grupo, conteudo, opcoes); } catch { return null; }
}

function rodape() {
    return `🧣 ${config.BOT_NAME} • 🌹 ${config.OWNER_NAME}`;
}

function onOff(v) { return v ? "✅ ATIVADO" : "❌ DESATIVADO"; }

// Interpreta on/off/1/0/ligar/desligar
function lerEstado(arg) {
    const a = String(arg || "").toLowerCase();
    if (["on", "1", "ligar", "ativar", "sim"].includes(a)) return true;
    if (["off", "0", "desligar", "desativar", "nao", "não"].includes(a)) return false;
    return null;
}

// Mapa com limite de tamanho (nenhum rastreador cresce sem fim)
function mapaLimitado(limite = 5000) {
    const m = new Map();
    const setOriginal = m.set.bind(m);
    m.set = (k, v) => {
        if (!m.has(k) && m.size >= limite) m.delete(m.keys().next().value);
        return setOriginal(k, v);
    };
    return m;
}

module.exports = {
    norm, lerCfg, salvarCfg, metaGrupo, limparCacheMeta, acharParticipante,
    ehIntocavel, ehAdminGrupo, botEhAdmin, autorMsg, conteudoReal, textoDe,
    apagar, remover, enviar, rodape, onOff, lerEstado, mapaLimitado
};
