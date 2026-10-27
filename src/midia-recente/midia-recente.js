/* =================================================
   📦 NAGATORO — MÍDIA RECENTE (achar e baixar mídia marcada)
   📁 Arquivo: midia-recente.js

   Resolve o "eu marquei a mídia e ela diz que não marquei":
   - acharMidia(): encontra imagem/vídeo/GIF/figurinha em QUALQUER formato
     de mensagem do WhatsApp (temporária, visualização única, mensagem com
     botão, documento de imagem/vídeo, vídeo redondo...).
   - guarda as últimas mídias que passaram pelo bot (inclusive as que ELE
     mesmo mandou). Quando alguém responde uma mídia, o bot baixa da cópia
     original guardada — o WhatsApp às vezes manda a mensagem marcada sem
     a "chave" do arquivo, e aí o download falhava.
   - se o link da mídia expirou, pede pro WhatsApp reenviar (reupload).
================================================= */

const { downloadMediaMessage } = require("@whiskeysockets/baileys");

const LIMITE = 400;
const recentes = new Map(); // id da mensagem -> mensagem completa

const LOGGER_MUDO = { level: "silent", info() {}, debug() {}, warn() {}, error() {}, trace() {}, fatal() {}, child() { return LOGGER_MUDO; } };

const TIPOS = {
    imageMessage: "image",
    videoMessage: "video",
    ptvMessage: "video",
    stickerMessage: "sticker"
};

// 🔎 Procura a mídia dentro de qualquer "envelope" (até 7 níveis).
// Não entra em contextInfo (senão pegaria a mídia de OUTRA mensagem marcada).
function acharMidia(message, profundidade = 0, exigirChave = true) {
    if (!message || typeof message !== "object" || profundidade > 7) return null;
    for (const [campo, tipo] of Object.entries(TIPOS)) {
        const no = message[campo];
        if (no && typeof no === "object" && (!exigirChave || no.mediaKey || no.directPath || no.url || no.mimetype)) {
            return { campo, tipo, no, gif: !!no.gifPlayback };
        }
    }
    const doc = message.documentMessage;
    if (doc && /^(image|video)\//i.test(doc.mimetype || "")) {
        return { campo: "documentMessage", tipo: /^video/i.test(doc.mimetype) ? "video" : "image", no: doc, documento: true };
    }
    for (const [chave, valor] of Object.entries(message)) {
        if (chave === "contextInfo" || !valor || typeof valor !== "object" || Buffer.isBuffer(valor)) continue;
        const achado = acharMidia(valor, profundidade + 1, exigirChave);
        if (achado) return achado;
    }
    return null;
}

function guardar(msg) {
    try {
        const id = msg?.key?.id;
        if (!id || !msg.message || !acharMidia(msg.message)) return;
        recentes.delete(id);
        recentes.set(id, msg);
        while (recentes.size > LIMITE) recentes.delete(recentes.keys().next().value);
    } catch {}
}

// Guarda também tudo que o PRÓPRIO bot envia (GIF convertido, cards...).
function instalar(sock) {
    if (!sock || sock.__midiaRecenteInstalado) return;
    sock.__midiaRecenteInstalado = true;
    const original = sock.sendMessage.bind(sock);
    sock.sendMessage = async (...args) => {
        const enviada = await original(...args);
        guardar(enviada);
        return enviada;
    };
}

async function baixar(sock, msgCompleta) {
    return downloadMediaMessage(msgCompleta, "buffer", {}, {
        logger: LOGGER_MUDO,
        ...(sock?.updateMediaMessage ? { reuploadRequest: sock.updateMediaMessage } : {})
    });
}

/**
 * Pega a mídia da mensagem (enviada junto) ou da mensagem MARCADA.
 * Devolve { buffer, tipo: "image"|"video"|"sticker", gif, mimetype } ou null se não tem mídia.
 * Lança erro só se achou a mídia mas não conseguiu baixar.
 */
async function pegarMidia(sock, msg) {
    const from = msg.key.remoteJid;

    // 1) mídia enviada junto com o comando
    const direta = acharMidia(msg.message);
    if (direta) {
        const buffer = await baixar(sock, msg);
        return { buffer, tipo: direta.tipo, gif: direta.gif, mimetype: direta.no.mimetype };
    }

    // 2) mídia marcada (resposta)
    const ctx = acharContexto(msg.message);
    if (!ctx) return null;
    const citada = ctx.quotedMessage;
    // a original guardada (pelo "número" da mensagem marcada) resolve até quando o
    // WhatsApp manda a marcação SEM o conteúdo do vídeo/foto
    const original = ctx.stanzaId && recentes.get(ctx.stanzaId);
    const marcada = (citada && acharMidia(citada, 0, false)) || (original && acharMidia(original.message));
    if (!marcada) return null;

    const tentativas = [];
    if (original) tentativas.push(original);
    if (citada) tentativas.push({
        key: { remoteJid: from, id: ctx.stanzaId || "x", participant: ctx.participant, fromMe: false },
        message: citada
    });

    let ultimoErro = null;
    for (const m of tentativas) {
        try {
            const buffer = await baixar(sock, m);
            if (buffer?.length) return { buffer, tipo: marcada.tipo, gif: marcada.gif, mimetype: marcada.no.mimetype };
        } catch (e) { ultimoErro = e; }
    }
    throw ultimoErro || new Error("download da mídia marcada veio vazio");
}

// contextInfo pode estar em extendedTextMessage, imageMessage, videoMessage... (e dentro de envelopes)
function acharContexto(message, profundidade = 0) {
    if (!message || typeof message !== "object" || profundidade > 6) return null;
    for (const valor of Object.values(message)) {
        if (valor && typeof valor === "object" && (valor.contextInfo?.quotedMessage || valor.contextInfo?.stanzaId)) return valor.contextInfo;
    }
    for (const [chave, valor] of Object.entries(message)) {
        if (chave === "contextInfo" || !valor || typeof valor !== "object" || Buffer.isBuffer(valor)) continue;
        const achado = acharContexto(valor, profundidade + 1);
        if (achado) return achado;
    }
    return null;
}

function temMidia(msg) {
    if (acharMidia(msg?.message)) return true;
    const ctx = acharContexto(msg?.message);
    if (!ctx) return false;
    if (ctx.quotedMessage && acharMidia(ctx.quotedMessage, 0, false)) return true;
    const original = ctx.stanzaId && recentes.get(ctx.stanzaId);
    return !!(original && acharMidia(original.message));
}

module.exports = { instalar, guardar, pegarMidia, acharMidia, acharContexto, temMidia };
