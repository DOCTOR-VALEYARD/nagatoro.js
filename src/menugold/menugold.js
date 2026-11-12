const config = require("../../config");
async function menugold(sock, msg) {
    const from = msg.key.remoteJid;
    const resposta = ` 🧣┈┈┈┈┈┈┈┈┈┈┈┈🧣
✨ 『 ${config.BOT_NAME} 』✨
🧣┈┈┈┈┈┈┈┈┈┈┈┈🧣

💰 ᴍᴇɴᴜ ɢᴏʟᴅ 💰

🖤┈┈┈┈┈┈┈┈┈┈┈┈🖤
💸 ᴇᴄᴏɴᴏᴍɪᴀ & ᴍᴏᴇᴅᴀs
🖤┈┈┈┈┈┈┈┈┈┈┈┈🖤
🧣 ${config.PREFIX}ˢᵃˡᵈᵒ ➜ ᵛᵉʳ ˢᵃˡᵈᵒ ᴳᵒˡᵈ
🧣 ${config.PREFIX}ʳᵒᵘᵇᵃʳ [@user] ➜ ʳᵒᵘᵇᵃʳ ᴳᵒˡᵈ
🧣 ${config.PREFIX}ˡᵒʲᵃ ➜ ᶜᵒᵐᵖʳᵃʳ ⁱᵗᵉⁿˢ
🧣 ${config.PREFIX}ᵈᵘᵉˡᵒ [@user] ➜ ᵃᵖᵒˢᵗᵃʳ ᴳᵒˡᵈ
🧣 ${config.PREFIX}ʳᵉˢᵍᵃᵗᵃʳ ➜ ʳᵉˢᵍᵃᵗᵃʳ ᵗᵒᵏᵉⁿ

🖤┈┈┈┈┈┈┈┈┈┈┈┈🖤
🏆 ʀᴀɴᴋɪɴɢ
🖤┈┈┈┈┈┈┈┈┈┈┈┈🖤
🧣 ${config.PREFIX}ʳᵃⁿᵏ ➜ ᵛᵉʳ ʳᵃⁿᵏⁱⁿᵍ
🧣 ${config.PREFIX}ᵖᵉʳᶠⁱˡ ➜ ˢᵉᵘ ᵖᵉʳᶠⁱˡ

🖤┈┈┈┈┈┈┈┈┈┈┈┈🖤
📊 ᴄᴏɴᴠᴇʀsᴀ̃ᴏ
🖤┈┈┈┈┈┈┈┈┈┈┈┈🖤
🧣 1000 ᴳᵒˡᵈ = 1 ᴾʳᵉᵐⁱᵘᵐ
🖤┈┈┈┈┈┈┈┈┈┈┈┈🖤
`;
    await sock.sendMessage(from, { text: resposta }, { quoted: msg });
}
module.exports = { menugold };
