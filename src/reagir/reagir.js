const config = require("../../config");

// Reage (de verdade) na mensagem que a pessoa respondeu.
// <prefixo>reagir        → emoji aleatório
// <prefixo>reagir 🔥     → o emoji escolhido
async function reagir(sock, msg, args = []) {
    const from = msg.key.remoteJid;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (!ctx?.quotedMessage || !ctx.stanzaId) {
        return sock.sendMessage(from, {
            text: `😏 Responde a mensagem que você quer que eu reaja, senpai.\nEx.: responda e mande *${config.PREFIX}reagir 🔥*`
        }, { quoted: msg });
    }
    const reacoes = ["👍", "❤️", "😂", "😮", "😢", "🔥", "✨", "🎉", "🤡", "😏"];
    const escolhido = String(args[0] || "").trim();
    const reacao = escolhido && !/^[a-z0-9]+$/i.test(escolhido) ? escolhido : reacoes[Math.floor(Math.random() * reacoes.length)];
    await sock.sendMessage(from, {
        react: { text: reacao, key: { remoteJid: from, id: ctx.stanzaId, participant: ctx.participant, fromMe: false } }
    });
}
module.exports = { reagir };
