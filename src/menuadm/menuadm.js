// src/menuadm.js
const config = require("../../config");
const fs = require("fs");
const path = require("path");


// ═══════════════════════════════════════════════════════════════
// 🛡️ MENU ADMINISTRATIVO
// ═══════════════════════════════════════════════════════════════

async function menuadm(sock, msg) {

    const from =
        msg?.key?.remoteJid;

    if (!from) {
        return;
    }


    // 🔐 Somente administradores podem abrir o painel administrativo.
    try {
        // (antes comparava só p.id/p.lid: dono e quem vinha pelo número ficavam de fora)
        const autor = msg.key.participant || msg.key.participantAlt || msg.key.remoteJid;
        const { ehDono } = require("../utils-validacao/utils-validacao");
        const admin = !!msg.key.fromMe || ehDono([autor, msg.key.participantAlt], config.OWNER_NUMBER)
            || await require("../grupo/grupo").isAdmin(sock, from, autor);
        if (!admin) return sock.sendMessage(from, { text: "❌ O menu administrativo é exclusivo para administradores." }, { quoted: msg });
    } catch {
        return sock.sendMessage(from, { text: "❌ Não consegui verificar sua permissão de administrador." }, { quoted: msg });
    }

    // ═════════════════════════════════════════════════════════════
    // 🖼️ IMAGEM DO MENU
    // ═════════════════════════════════════════════════════════════

    const caminhoImagem =
        path.join(
            __dirname, "../midias/imagens/menu.png"
        );


    // ═════════════════════════════════════════════════════════════
    // 📋 MENU
    // ═════════════════════════════════════════════════════════════

    const resposta = `🧣━━━━━━〔 🛡️ 〕━━━━━━🧣
ᴍᴇɴᴜ ᴀᴅᴍɪɴɪsᴛʀᴀᴛɪᴠᴏ
🧣━━━━━━〔 🛡️ 〕━━━━━━🧣

🔐 ᵃʳᵉᵃ ᵉˣᶜˡᵘˢⁱᵛᵃ ᵖᵃʳᵃ ᵃᵈᵐⁱⁿⁱˢᵗʳᵃᵈᵒʳᵉˢ

━━━━〔 📊 〕━━━━
ʀᴇsᴜᴍᴏ ᴇ ᴀᴛɪᴠɪᴅᴀᴅᴇ
━━━━〔 📊 〕━━━━
> 🧣 ${config.PREFIX}ʳᵉˢᵘᵐᵒ
> 🧣 ${config.PREFIX}ᵃᵗⁱᵛⁱᵈᵃᵈᵉˢ
> 🧣 ${config.PREFIX}ᵗᵒᵖ10
> 🧣 ${config.PREFIX}ʳᵃⁿᵏᵃᵗⁱᵛᵒ
> 🧣 ${config.PREFIX}ᵗᵉᵐᵖᵒ
> 🧣 ${config.PREFIX}ʳᵉˡᵃᵗᵒʳⁱᵒ

━━━━〔 ⚔️ 〕━━━━
           ᵍʳᵘᵖᵒˢ 
━━━━〔 ⚔️ 〕━━━━
> 🧣 ${config.PREFIX}ᵇᵃⁿ
> 🧣 ${config.PREFIX}ᵏⁱᶜᵏ
> 🧣 ${config.PREFIX}ᵖʳᵒᵐᵒᵛᵉʳ
> 🧣 ${config.PREFIX}ʳᵉᵇᵃⁱˣᵃʳ
> 🧣 ${config.PREFIX}ᵃᵛⁱˢᵒ
> 🧣 ${config.PREFIX}ᵐᵃʳᶜᵃʳ
> 🧣 ${config.PREFIX}ʰⁱᵈᵉᵗᵃᵍ
> 🧣 ${config.PREFIX}ᶜⁱᵗᵃʳ
> 🧣 ${config.PREFIX}ˢᵃⁱʳ
> 🧣 ${config.PREFIX}ᵃᵇʳⁱʳ
> 🧣 ${config.PREFIX}ᶠᵉᶜʰᵃʳ
> 🧣 ${config.PREFIX}ᶠⁱˣᵃʳ

━━━━〔 🔒 〕━━━━
    sᴇɢᴜʀᴀɴᴄ̧ᴀ 
━━━━〔 🔒 〕━━━━
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱˡⁱⁿᵏ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱⁿᵒᵗᵃ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱˡᵒᶜ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱᵈᵒᶜ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱᶠᵃᵏᵉ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱᵖᵃˡᵃᵛʳᵃᵒ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱˢᵖᵃᵐ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱᶠˡᵒᵒᵈ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱᵖ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱᵇ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱʳ
> 🧣 ${config.PREFIX}ᵃⁿᵗⁱᵍ
> 🧣 ${config.PREFIX}ᵈᵛᶜˡ-ᵃᵘᵗᵒ
> 🧣 ${config.PREFIX}ᵈᵛᶜˡ1
> 🧣 ${config.PREFIX}ᵈᵛᶜˡ0
> 🧣 ${config.PREFIX}ᵇᵉᵐᵛⁱⁿᵈᵒ
> 🧣 ${config.PREFIX}ᵃᶜᵉⁱᵗᵃʳ
> 🧣 ${config.PREFIX}ᵐᵉⁿᶜᵃᵒ
> 🧣 ${config.PREFIX}ˢᵃᵘᵈᵃᶜᵃᵒ
> 🧣 ${config.PREFIX}ᵇˡᵃᶜᵏˡⁱˢᵗ
> 🧣 ${config.PREFIX}ˡⁱˢᵗᵃ
> 🧣 ${config.PREFIX}ˡⁱᵐᵖᵃʳᵇᵒᵗ
> 🧣 ${config.PREFIX}ᵃᵗⁱᵛᵃʳ

━━━━〔 🧰 〕━━━━
    ꜰᴇʀʀᴀᴍᴇɴᴛᴀs
━━━━〔 🧰 〕━━━━
> 🧣 ${config.PREFIX}ᵃᵈᵈ
> 🧣 ${config.PREFIX}ˡⁱˢᵗᵃ
> 🧣 ${config.PREFIX}ᵗⁱʳᵃʳˡⁱˢᵗᵃ
> 🧣 ${config.PREFIX}ˡᵒᵍᵇᵃⁿ
> 🧣 ${config.PREFIX}ᵐᵒᵈᵘˡᵒˢ
> 🧣 ${config.PREFIX}ᶜᵃˡᶜ
> 🧣 ${config.PREFIX}ʷⁱᵏⁱ
> 🧣 ${config.PREFIX}ᵉⁿᶜᵘʳᵗᵃʳ
> 🧣 ${config.PREFIX}ᵗʳᵃᵈᵘᶻⁱʳ
> 🧣 ${config.PREFIX}ᵇᵃˢᵉ64
> 🧣 ${config.PREFIX}ᵐᵈ5
> 🧣 ${config.PREFIX}ˢᵖᵒⁱˡᵉʳ
> 🧣 ${config.PREFIX}ˤʳᶜᵒᵈᵉ
> 🧣 ${config.PREFIX}ᵐᵉ
> 🧣 ${config.PREFIX}ᵃᵈᵐˢ

━━━━〔 ⚡ 〕━━━━
             ᴀᴅᴍɪɴ 
━━━━〔 ⚡ 〕━━━━
🖤 sistema: ${config.BOT_NAME}
🖤 responsável: ${config.OWNER_NAME}
🖤 ᵃᶜᵉˢˢᵒ: ᵃᵈᵐⁱⁿⁱˢᵗʳᵃᵗⁱᵛᵒ
🖤 ˢᵗᵃᵗᵘˢ: ᴏᴘᴇʀᴀᴄɪᴏɴᴀʟ 🟢`;


    // ═════════════════════════════════════════════════════════════
    // 📤 ENVIO
    // ═════════════════════════════════════════════════════════════

    try {

        if (fs.existsSync(caminhoImagem)) {

            const bufferImagem =
                fs.readFileSync(
                    caminhoImagem
                );


            await sock.sendMessage(
                from,
                {
                    image: bufferImagem,
                    caption: resposta
                },
                {
                    quoted: msg
                }
            );

            return;
        }


        // ─────────────────────────────────────────────────────────
        // ⚠️ FALLBACK SEM IMAGEM
        // ─────────────────────────────────────────────────────────

        await sock.sendMessage(
            from,
            {
                text:
                    `${resposta}\n\n` +
                    `⚠️ *Imagem do menu não localizada.*`
            },
            {
                quoted: msg
            }
        );

    } catch (erro) {

        console.error(
            "❌ Erro ao enviar menu administrativo:",
            erro
        );
    }
}


// ═══════════════════════════════════════════════════════════════
// 📦 EXPORTAÇÃO
// ═══════════════════════════════════════════════════════════════

module.exports = {
    menuadm
};