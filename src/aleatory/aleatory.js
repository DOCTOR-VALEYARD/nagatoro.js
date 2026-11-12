/* 🎲 ALEATÓRIO — agora serve pra alguma coisa
   <prefixo>aleatory             → número de 1 a 100
   <prefixo>aleatory 1 6         → número entre 1 e 6 (vira dado)
   <prefixo>aleatory pizza, lanche, açaí → a Nagatoro escolhe uma opção */
const config = require("../../config");
const sorteio = (l) => l[Math.floor(Math.random() * l.length)];
async function aleatory(sock, msg, args = []) {
    const from = msg.key.remoteJid;
    const texto = (args || []).join(" ").trim();
    const P = config.PREFIX;
    // opções separadas por vírgula, "ou" ou "|"
    const opcoes = texto.split(/\s*(?:,|\||\bou\b)\s*/i).map(s => s.trim()).filter(Boolean);
    if (opcoes.length >= 2 && !opcoes.every(o => /^-?\d+$/.test(o))) {
        const escolha = sorteio(opcoes);
        const frase = sorteio([
            "Escolhi *{x}*. Não me agradece, só obedece 😏",
            "*{x}*, óbvio. Nem sei por que você ainda tava em dúvida 🙄",
            "Vai de *{x}*. Se der errado a culpa é sua, eu só sorteei~",
            "*{x}*! Pronto, decidi sua vida de novo 😌"
        ]).replace("{x}", escolha);
        return sock.sendMessage(from, { text: `🎲 *A NAGATORO DECIDIU*\n\n📋 Opções: ${opcoes.join(" · ")}\n\n${frase}` }, { quoted: msg });
    }
    const nums = texto.match(/-?\d+/g)?.map(Number) || [];
    let min = 1, max = 100;
    if (nums.length >= 2) { min = Math.min(nums[0], nums[1]); max = Math.max(nums[0], nums[1]); }
    else if (nums.length === 1) { max = Math.max(1, nums[0]); }
    const n = min + Math.floor(Math.random() * (max - min + 1));
    return sock.sendMessage(from, {
        text: `🎲 *ALEATÓRIO*\n\n🎯 Deu: *${n}*\n📊 Entre ${min} e ${max}\n\n💡 ${P}aleatory 1 6 (dado) · ${P}aleatory pizza, lanche, açaí`
    }, { quoted: msg });
}
module.exports = { aleatory };
