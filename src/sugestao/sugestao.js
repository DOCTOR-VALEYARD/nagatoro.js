const config = require("../../config");
async function sugestao(sock, msg, args = []) {
    const from = msg.key.remoteJid;
    if (!args.length) {
        return sock.sendMessage(from, {
            text: `❌ Use: ${config.PREFIX}sugestao [ideia]`
        }, { quoted: msg });
    }
    
    const ideia = args.join(" ");
    const resp = `
╭─「 💡 *SUGESTÃO RECEBIDA* 」
│
│ 📝 Ideia: ${ideia}
│ ✅ Registrada com sucesso
│ 🎯 Será analisada
│
│ 👑 Obrigado pelas sugestões!
╰───────────────────────────`;
    await sock.sendMessage(from, { text: resp }, { quoted: msg });

    // 📬 manda a sugestão pro PV do dono
    try {
        const autor = msg.key.participantAlt || msg.key.participant || from;
        const dono = `${String(config.OWNER_NUMBER).replace(/\D/g, "")}@s.whatsapp.net`;
        await sock.sendMessage(dono, {
            text: `💡 *NOVA SUGESTÃO*\n\n👤 @${String(autor).split("@")[0]}\n💬 ${from.endsWith("@g.us") ? "Grupo" : "PV"}: ${from}\n\n📝 ${ideia}`,
            mentions: [autor]
        });
    } catch {}
}
module.exports = { sugestao };
