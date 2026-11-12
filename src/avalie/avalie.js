const config = require("../../config");
async function avalie(sock, msg, args = []) {
    const from = msg.key.remoteJid;
    const estrelas = Math.max(1, Math.min(5, parseInt(args[0], 10) || 5));
    const resp = `
╭─「 ⭐ *AVALIAÇÃO* 」
│
│ ${"⭐".repeat(estrelas)} ${estrelas}/5 estrelas
│ ✅ Sua avaliação foi registrada
│ 
│ 💖 Obrigado pelo feedback!
╰───────────────────────────`;
    await sock.sendMessage(from, { text: resp }, { quoted: msg });
}
module.exports = { avalie };
