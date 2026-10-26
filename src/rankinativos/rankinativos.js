/* =================================================
   📉 RANKING DE INATIVOS — quem ainda não falou HOJE no grupo
   📁 Arquivo: rankinativos.js

   Usa a mesma contagem do relatório diário (src/relatorio). Mostra os
   membros que não mandaram nenhuma mensagem desde 00:00 de hoje.
================================================= */

const config = require("../../config");
const { obterStats } = require("../relatorio/relatorio");

const LIMITE_LISTA = 40;

function idsDoParticipante(p) {
    return [p.id, p.lid, p.jid, p.phoneNumber, p.phoneNumberJid].filter(Boolean).map(String);
}

async function rankinativos(sock, msg) {
    const from = msg.key.remoteJid;
    if (!from.endsWith("@g.us")) {
        return sock.sendMessage(from, { text: "👥 Esse comando só funciona em grupos." }, { quoted: msg });
    }

    let meta;
    try { meta = await sock.groupMetadata(from); } catch {
        return sock.sendMessage(from, { text: "❌ Não consegui ler os membros do grupo agora." }, { quoted: msg });
    }

    const falaram = new Set(Object.keys(obterStats(from).usuarios || {}));
    const botNumero = String(sock.user?.id || "").split(":")[0].split("@")[0];

    const inativos = (meta.participants || []).filter(p => {
        const ids = idsDoParticipante(p);
        if (ids.some(id => id.split("@")[0] === botNumero)) return false;
        return !ids.some(id => falaram.has(id));
    });

    if (!inativos.length) {
        return sock.sendMessage(from, {
            text: `🔥 *NINGUÉM PARADO HOJE!*\n\nTodo mundo já deu sinal de vida. Milagre, hein? 😏\n\n🤖 ${config.BOT_NAME}`
        }, { quoted: msg });
    }

    const lista = inativos.slice(0, LIMITE_LISTA);
    const linhas = lista.map((p, i) => `${i + 1}. @${String(p.id).split("@")[0]}${p.admin ? " 🛡️" : ""}`);
    const resto = inativos.length - lista.length;

    return sock.sendMessage(from, {
        text: `😴 *INATIVOS DE HOJE*\n\n📊 *${inativos.length}* de *${meta.participants.length}* membros ainda não falaram nada hoje.\n\n${linhas.join("\n")}${resto > 0 ? `\n\n…e mais *${resto}*.` : ""}\n\n💡 A contagem zera todo dia à meia-noite.\n🤖 ${config.BOT_NAME}`,
        mentions: lista.map(p => p.id)
    }, { quoted: msg });
}

module.exports = { rankinativos };
