// src/menudono.js
const config = require("../../config");
const fs = require("fs");
const path = require("path");

async function menudono(sock, msg) {
    const from = msg.key.remoteJid;
    const caminhoImagem = path.join(__dirname, "../midias/imagens/menu.png"); // ✅ Pega direto da pasta src/

    // ✅ LAYOUT NOVO — MESMO PADRÃO FLORAL DO MENU PRINCIPAL
    const resposta = `🧣┈┈┈┈┈┈┈┈┈┈┈┈┈┈🧣
✨ 『 ${config.BOT_NAME} 』✨
🧣┈┈┈┈┈┈┈┈┈┈┈┈┈┈🧣

🔐 ᶜᵒᵐᵃⁿᵈᵒˢ ᴱˣᶜˡᵘˢⁱᵛᵒˢ: ${config.OWNER_NAME}

🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┈🖤
💻 ᴍɪ́ᴅɪᴀ & ꜰᴇʀʀᴀᴍᴇɴᴛᴀs
🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┈🖤
🧣 ${config.PREFIX}ᵖˡᵃʸ [nome]
🧣 ${config.PREFIX}ˢ / ˢᵗⁱᶜᵏᵉʳ
🧣 ${config.PREFIX}ᶠ / ᵍⁱᶠ
🧣 ${config.PREFIX}ᵗᵒⁱᵐᵍ

🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┈🖤
💰 sɪsᴛᴇᴍᴀ ᴇᴄᴏɴᴏ̂ᴍɪᴄᴏ
🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┈🖤
🧣 ${config.PREFIX}ˢᵃˡᵈᵒ
🧣 ${config.PREFIX}ʳᵒᵘᵇᵃʳ @user
🧣 ${config.PREFIX}ˡᵒʲᵃ
🧣 ${config.PREFIX}ᵍᵃˢᵗᵃʳ

🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┷🖤
🎮 ᴅɪᴠᴇʀsᴀ̃ᴏ & ᴊᴏɢᴏs
🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┈🖤
🧣 ${config.PREFIX}ᶠᵒʳᶜᵃ
🧣 ${config.PREFIX}ᵃᵈⁱᵛⁱⁿʰᵃ
🧣 ${config.PREFIX}ᵠᵘⁱᶻ
🧣 ${config.PREFIX}ᵈᵘᵉˡᵒ @user
🧣 ${config.PREFIX}ʳᵒˡᵉᵗᵃ

🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┷🖤
⚙️ ᴄᴏɴᴛʀᴏʟᴇ ɢᴇʀᴀʟ
🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┷🖤
🧣 ${config.PREFIX}ᵃᵗⁱᵛᵃʳ
🧣 ${config.PREFIX}ᶜᵒⁿᶠⁱᵍᵘʳᵃʳ

🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┈🖤
🖤 ᴾˡᵃᵗᵃᶠᵒʳᵐᵃ: ${config.BOT_NAME}
🖤 ˢⁱˢᵗᵉᵐᵃ: ${config.BOT_NAME}
🖤 ᴬᶜᵉˢˢᵒ: ᴬᵈᵐⁱⁿⁱˢᵗʳᵃᵈᵒʳ / ᴰᵒⁿᵒ
🖤┈┈┈┈┈┈┈┈┈┈┈┈┈┈🖤`;

    // ✅ VERIFICA SE A FOTO EXISTE — SE TIVER ENVIA COM IMAGEM, SE NÃO ENVIA SÓ TEXTO SEM DAR ERRO
    if (fs.existsSync(caminhoImagem)) {
        const bufferImagem = fs.readFileSync(caminhoImagem);
        await sock.sendMessage(from, {
            image: bufferImagem,
            caption: resposta
        }, { quoted: msg });
    } else {
        // Aviso leve se faltar a imagem — não quebra nada
        const semImagem = resposta + `\n\n⚠️ *Aviso:* Imagem do menu não encontrada!`;
        await sock.sendMessage(from, { text: semImagem }, { quoted: msg });
    }
}

module.exports = { menudono };

