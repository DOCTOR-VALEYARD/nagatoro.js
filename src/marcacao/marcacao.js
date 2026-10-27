/* =================================================
   🧷 NAGATORO — MARCAÇÃO (responder mensagem) SEMPRE FUNCIONANDO
   📁 Arquivo: marcacao.js

   Todos os comandos (s, gif, sf, limpar, reagir, ban...) leem a
   mensagem marcada em:  msg.message.extendedTextMessage.contextInfo

   Dependendo da versão do WhatsApp/Baileys e do grupo (mensagem
   temporária, visualização única, mensagem editada...), a marcação
   pode chegar "embrulhada" ou SEM o conteúdo da mensagem marcada —
   e aí o comando dizia "responda uma mensagem" mesmo marcando.

   Este módulo arruma a mensagem ANTES dos comandos lerem:
   1) desembrulha (temporária, visualização única, editada, etc.)
   2) põe a marcação no lugar padrão (extendedTextMessage.contextInfo)
   3) se veio só o "id" da marcada, completa com a mensagem original
      guardada aqui (as últimas 3000 que passaram pelo bot, inclusive
      as que ele mesmo enviou)
   4) se a mídia marcada veio sem a chave de download, troca pela
      original guardada (que tem a chave)
================================================= */

const LIMITE = 3000;
const guardadas = new Map(); // id -> mensagem (já desembrulhada)

const EMBRULHOS = [
    "ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension",
    "documentWithCaptionMessage", "editedMessage", "deviceSentMessage", "botInvokeMessage",
    "futureProofMessage", "groupMentionedMessage", "associatedChildMessage", "lottieStickerMessage"
];
const CONTEUDOS = [
    "conversation", "extendedTextMessage", "imageMessage", "videoMessage", "audioMessage",
    "stickerMessage", "documentMessage", "ptvMessage", "contactMessage", "locationMessage",
    "buttonsResponseMessage", "listResponseMessage", "templateButtonReplyMessage",
    "interactiveResponseMessage", "pollCreationMessage", "pollCreationMessageV3", "reactionMessage", "protocolMessage"
];
const MIDIAS = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage", "ptvMessage"];

function ehObjeto(v) { return v && typeof v === "object" && !Buffer.isBuffer(v) && !(v instanceof Uint8Array); }

// Tira os "embrulhos" e devolve o conteúdo de verdade (sem mexer no original)
function desembrulhar(m) {
    for (let i = 0; i < 8 && ehObjeto(m); i++) {
        if (CONTEUDOS.some(c => m[c] != null)) return m;
        const emb = EMBRULHOS.find(e => ehObjeto(m[e]?.message));
        if (!emb) return m;
        m = m[emb].message;
    }
    return m;
}

function guardar(msg) {
    try {
        const id = msg?.key?.id;
        if (!id || !ehObjeto(msg.message)) return;
        guardadas.delete(id);
        guardadas.set(id, { key: msg.key, message: desembrulhar(msg.message) });
        while (guardadas.size > LIMITE) guardadas.delete(guardadas.keys().next().value);
    } catch {}
}

function pegarGuardada(id) { return id ? guardadas.get(id) : null; }

// Acha o contextInfo que tem marcação (stanzaId/quotedMessage) em qualquer nível
function acharContexto(m, prof = 0) {
    if (!ehObjeto(m) || prof > 6) return null;
    for (const v of Object.values(m)) {
        if (ehObjeto(v) && ehObjeto(v.contextInfo) && (v.contextInfo.stanzaId || v.contextInfo.quotedMessage)) return v.contextInfo;
    }
    for (const [k, v] of Object.entries(m)) {
        if (k === "contextInfo" || !ehObjeto(v)) continue;
        const achado = acharContexto(v, prof + 1);
        if (achado) return achado;
    }
    return null;
}

function semChave(no) { return ehObjeto(no) && !no.mediaKey; }

/**
 * Arruma a mensagem recebida (mexe no próprio objeto msg).
 * Seguro: se não tiver nada pra arrumar, não muda nada.
 */
function normalizar(msg) {
    try {
        if (!ehObjeto(msg?.message)) return msg;

        // 1) desembrulha o topo (mantém os campos originais também)
        const dentro = desembrulhar(msg.message);
        if (dentro !== msg.message) {
            for (const [k, v] of Object.entries(dentro)) if (msg.message[k] == null) msg.message[k] = v;
        }

        // 2) acha a marcação onde quer que ela tenha vindo
        const ctx = acharContexto(msg.message);
        if (!ctx) return msg;

        // 3) completa com a original guardada
        const original = pegarGuardada(ctx.stanzaId);
        if (ctx.quotedMessage) {
            const q = desembrulhar(ctx.quotedMessage);
            if (q !== ctx.quotedMessage) for (const [k, v] of Object.entries(q)) if (ctx.quotedMessage[k] == null) ctx.quotedMessage[k] = v;
            // 4) mídia marcada sem chave de download → usa a da original
            if (original) {
                for (const tipo of MIDIAS) {
                    if (semChave(ctx.quotedMessage[tipo]) && original.message?.[tipo]?.mediaKey) ctx.quotedMessage[tipo] = original.message[tipo];
                }
            }
        } else if (original?.message) {
            ctx.quotedMessage = original.message;
        }
        if (!ctx.participant && original?.key) {
            ctx.participant = original.key.participant || (original.key.fromMe ? undefined : original.key.remoteJid);
        }

        // 5) põe no lugar padrão que todos os comandos leem
        const m = msg.message;
        const jaNoLugar = m.extendedTextMessage?.contextInfo === ctx
            || m.imageMessage?.contextInfo === ctx || m.videoMessage?.contextInfo === ctx
            || m.stickerMessage?.contextInfo === ctx || m.documentMessage?.contextInfo === ctx;
        if (!jaNoLugar) {
            if (ehObjeto(m.extendedTextMessage)) m.extendedTextMessage.contextInfo = ctx;
            else if (typeof m.conversation === "string") m.extendedTextMessage = { text: m.conversation, contextInfo: ctx };
            else {
                const alvo = ["imageMessage", "videoMessage", "documentMessage", "stickerMessage"].find(t => ehObjeto(m[t]));
                if (alvo) m[alvo].contextInfo = ctx;
                else m.extendedTextMessage = { text: "", contextInfo: ctx };
            }
        }
    } catch (e) {
        console.error("⚠️ marcação:", e?.message || e);
    }
    return msg;
}

// Cópia profunda (mantém o tipo dos objetos e não copia os bytes de mídia)
function clonar(v, prof = 0) {
    if (!v || typeof v !== "object" || prof > 12) return v;
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return v;
    if (Array.isArray(v)) return v.map(x => clonar(x, prof + 1));
    const novo = Object.create(Object.getPrototypeOf(v));
    for (const k of Object.keys(v)) novo[k] = clonar(v[k], prof + 1);
    return novo;
}

// Guarda também tudo que o PRÓPRIO bot envia (pra quem responder a mensagem dele)
// ⚠️ IMPORTANTE: quando o bot responde CITANDO uma mensagem ({ quoted: msg }), o Baileys
// APAGA a marcação (contextInfo) de dentro da mensagem citada — e era a mensagem ORIGINAL
// do comando. Aí o ⏳ que sai antes de cada comando apagava a marcação e o .s/.limpar
// achavam que ninguém tinha marcado nada. Agora o Baileys recebe uma CÓPIA.
function instalar(sock) {
    if (!sock || sock.__marcacaoInstalada) return;
    sock.__marcacaoInstalada = true;
    const original = sock.sendMessage.bind(sock);
    sock.sendMessage = async (...args) => {
        try {
            const op = args[2];
            if (op && op.quoted && op.quoted.message) args[2] = { ...op, quoted: { ...op.quoted, message: clonar(op.quoted.message) } };
        } catch {}
        const enviada = await original(...args);
        guardar(enviada);
        return enviada;
    };
}

module.exports = { normalizar, guardar, instalar, desembrulhar, pegarGuardada };
