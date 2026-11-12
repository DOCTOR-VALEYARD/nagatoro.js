/* =================================================
   🕹️ NAGATORO — MENU DE JOGOS + NAGATORO STRIKE (em breve)
   📁 Arquivo: jogos.js

   <prefixo>jogos / <prefixo>menujogos → menu só com os jogos (botões)
   jogos (sem prefixo)                 → a lista em texto
   <prefixo>strike                     → NAGATORO STRIKE: por enquanto mostra
                                         que não está disponível + contagem regressiva.
   Quando chegar a data, mostra que lançou (e o link, se STRIKE_URL estiver no config).
================================================= */
const config = require("../../config");

// 🚀 lançamento do NAGATORO STRIKE — 17 dias depois de 06/11/2026 (horário de Brasília)
// Pra mudar a data: config.STRIKE_LANCAMENTO = "2026-11-23T16:53:00-03:00"
const LANCAMENTO = new Date(config.STRIKE_LANCAMENTO || "2026-11-23T16:53:00-03:00").getTime();

const JOGOS = [
    ["jogodavelha", "⭕ Jogo da Velha", "Contra alguém do grupo ou contra a Nagatoro."],
    ["forca", "🪢 Forca", "Adivinhe a palavra antes de ser enforcado(a)."],
    ["quiz", "🧠 Quiz", "Perguntas e respostas valendo moral."],
    ["adivinha", "🔢 Adivinha", "Acerte o número que eu pensei."],
    ["roleta", "🎰 Roleta", "Tenta a sorte na roleta."],
    ["crush", "🔮 NAGATORO ESPAÇO CRUSH", "Combine gemas no espaço · solo ou desafio"],
    ["rankcrush", "🏆 Ranking Espaço Crush", "Quem manda no Sistema Solar"]
];

function contagem() {
    let ms = Math.max(0, LANCAMENTO - Date.now());
    const d = Math.floor(ms / 86400000); ms -= d * 86400000;
    const h = Math.floor(ms / 3600000); ms -= h * 3600000;
    const m = Math.floor(ms / 60000);
    return { d, h, m, dias: d + (h || m ? 1 : 0), acabou: LANCAMENTO - Date.now() <= 0 };
}

const DEBOCHE_ESPERA = [
    "Calma, ansioso(a). Jogo bom demora pra ficar pronto 😏",
    "Ainda não, senpai. Vai treinando no jogo da velha enquanto isso 🙄",
    "Tá doido(a) pra levar headshot, né? Aguenta aí~ 🎯",
    "Meu dono tá terminando. Se ficar perguntando, atrasa mais um dia 😌"
];
const sortear = (l) => l[Math.floor(Math.random() * l.length)];

async function strike(sock, msg) {
    const from = msg.key.remoteJid;
    const c = contagem();
    const data = new Date(LANCAMENTO).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (c.acabou) {
        const link = config.STRIKE_URL || "";
        return sock.sendMessage(from, {
            text: `🔫 *NAGATORO STRIKE*\n\n🟢 *LANÇADO!*\n${link ? "🎮 Jogue aqui: " + link : "O link de batalha sai no canal do meu dono. Fica de olho 👀"}\n\n⚔️ Desafie outros grupos · melhor de 5 (quem fizer 3 primeiro)`
        }, { quoted: msg });
    }
    const barra = (() => { const total = 17 * 86400000, feito = Math.min(1, 1 - (LANCAMENTO - Date.now()) / total); const n = Math.round(feito * 10); return "▰".repeat(n) + "▱".repeat(10 - n); })();
    return sock.sendMessage(from, {
        text: `🔫 *NAGATORO STRIKE*\n\n🔒 *AINDA NÃO DISPONÍVEL*\n\n⏳ Faltam *${c.d}d ${String(c.h).padStart(2, "0")}h ${String(c.m).padStart(2, "0")}min*\n${barra}\n📅 Chega em ${data}\n\n🎮 FPS online · batalhas entre grupos · terceira pessoa · skins\n\n😏 ${sortear(DEBOCHE_ESPERA)}`
    }, { quoted: msg });
}

function textoMenuJogos() {
    const P = config.PREFIX, c = contagem();
    const linhas = JOGOS.map(([cmd, nome, desc]) => `${nome}\n   ${P}${cmd} · ${cmd === "strike" && !c.acabou ? `em ${c.dias} dias` : desc}`);
    return `🕹️ *MENU DE JOGOS*\n\n${linhas.join("\n\n")}\n\n🎮 Os jogos seguem o botão de brincadeiras (ligar/desligar no ${P}menu).`;
}

async function menuJogosTexto(sock, msg) {
    return sock.sendMessage(msg.key.remoteJid, { text: textoMenuJogos() }, { quoted: msg });
}

async function menuJogos(sock, msg) {
    const from = msg.key.remoteJid;
    try {
        const MB = require("../menuBotoes/menuBotoes");
        const c = contagem();
        const rows = JOGOS.map(([cmd, nome, desc]) => MB.linhaLista(`cmd:${cmd}`, nome, cmd === "strike" && !c.acabou ? `🔒 Em breve · faltam ${c.dias} dias` : desc));
        const extras = [
            MB.botao("🟢 LIGAR JOGOS", "brincadeiras_ligar"),
            MB.botao("🔴 DESLIGAR JOGOS", "brincadeiras_desligar"),
            MB.botao("BY : DOCTOR VALEYARD", "zoar_dono")
        ];
        await MB.enviarListaWhatsApp(sock, from, {
            text: `〔 🕹️ MENU DE JOGOS — ${config.BOT_NAME || "NAGATORO"} 〕\n\nStatus: ${require("../brincadeiras-control/brincadeiras-control").status()}\n\nToque em *VER TUDO* e escolha o jogo:`,
            title: "🎮 JOGOS",
            sections: [{ title: "🕹️ JOGOS", rows }],
            footer: "👑 ᴅᴏᴄᴛᴏʀ ᴠᴀʟᴇʏᴀʀᴅ",
            quoted: msg,
            extraButtons: extras,
            messageParamsJson: JSON.stringify({ bottom_sheet: { in_thread_buttons_limit: 1, divider_indices: [1, 2, 3, 999], list_title: "🕹️ MENU DE JOGOS", button_title: "📋 VER TUDO" } })
        });
    } catch (e) {
        console.error("⚠️ menu de jogos (botões) falhou, mandando texto:", e?.message || e);
        return menuJogosTexto(sock, msg);
    }
}

module.exports = { strike, menuJogos, menuJogosTexto, textoMenuJogos, JOGOS };
