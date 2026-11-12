// src/avatar-pixel/avatar-pixel.js
// 👾 Bonequinho pixel art para quem está SEM foto de perfil (ou esconde a foto).
// • Mesmo número = sempre o mesmo boneco.
// • O número NÃO sai do bot: vai só um código embaralhado (hash) como "semente".
// • Cada boneco é baixado uma vez e guardado em src/dados/avatares (depois sai na hora, mesmo sem internet).
// • Estilo escolhido pelo Doctor Valeyard: pixel-art sem chapéu, óculos, barba e acessórios.
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PASTA = path.join(__dirname, "../dados/avatares");
const OPCOES = "hatProbability=0&glassesProbability=0&beardProbability=0&accessoriesProbability=0";
// sempre cabelo curto (boneco "homem"), como o Doctor Valeyard pediu
const CABELO_CURTO = "hair=" + Array.from({ length: 24 }, (_, i) => "short" + String(i + 1).padStart(2, "0")).join(",");

// 😏 frases para quando o bot "desenha" a foto da pessoa
const FRASES = [
    "📸 _Sem foto de perfil? Relaxa, eu desenhei uma pra você. De nada~ 😏_",
    "👾 _Não tinha foto, então resolvi botar uma. Ficou até mais bonito que o original, né? Hehe~_",
    "🎨 _Escondeu a foto? Tranquilo, fiz um retrato seu em 8 bits. Arte gratuita, senpai._",
    "🕹️ _Perfil sem foto é coisa de NPC... então te transformei em um. Combina, né?_",
    "🖌️ _Foto escondida detectada. Desenhei você do jeito que imaginei. Não reclama~_",
    "👀 _Vergonha de mostrar a cara? Sem problema, agora você é pixel art. Kimo~_",
];
const frasePixel = () => FRASES[Math.floor(Math.random() * FRASES.length)];

function semente(id) {
    const numero = String(id || "").split("@")[0].split(":")[0].replace(/\D/g, "") || String(id || "anonimo");
    return crypto.createHash("sha256").update("nagatoro-pixel|" + numero).digest("hex").slice(0, 20);
}

async function baixar(url) {
    const r = await axios.get(url, { responseType: "arraybuffer", timeout: 5000, headers: { "User-Agent": "NagatoroBot/5.0" } });
    const b = Buffer.from(r.data);
    // confere que é PNG de verdade
    if (b.length < 100 || b[0] !== 0x89 || b[1] !== 0x50) throw new Error("não é png");
    return b;
}

/** Buffer PNG 512x512 do boneco da pessoa, ou null se nada responder */
async function avatarPixel(id) {
    const s = semente(id);
    const arq = path.join(PASTA, s + "-h.png");
    try { if (fs.existsSync(arq)) return fs.readFileSync(arq); } catch {}
    const fontes = [
        `https://api.dicebear.com/10.x/pixel-art/png?seed=${s}&size=512&${OPCOES}&${CABELO_CURTO}`,
        `https://api.dicebear.com/9.x/pixel-art/png?seed=${s}&size=512&${OPCOES}&${CABELO_CURTO}`,
        `https://api.dicebear.com/10.x/pixel-art/png?seed=${s}&size=512&${OPCOES}`,
        `https://pixelavatar.onrender.com/${s}?size=512&bg=purple-dark`,
    ];
    for (const url of fontes) {
        try {
            const b = await baixar(url);
            try { fs.mkdirSync(PASTA, { recursive: true }); fs.writeFileSync(arq, b); } catch {}
            return b;
        } catch { /* tenta a próxima */ }
    }
    return null;
}

// 👾 .pixel [@pessoa] — mostra o bonequinho pixel de alguém (ou o seu), com deboche
const LEGENDAS = [
    "👾 Esse é o @{u} na versão NPC. Fiel ao original, né? Hehe~",
    "🕹️ @{u} em 8 bits. Até em pixel dá pra ver a cara de quem não sabe nada~",
    "🎮 Personagem desbloqueado: @{u}. Nível 1, habilidade especial: falar besteira.",
    "👾 Olha o @{u} pixelado. Melhorou bastante, sinceramente~",
    "🕹️ @{u} virou boneco de videogame. Pena que é o que morre na primeira fase, hehe~",
    "🎨 Retrato oficial do @{u}. Pixel art grátis, aproveita que hoje eu tô boazinha.",
];
async function comandoPixel(sock, msg) {
    const from = msg.key.remoteJid;
    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    const alvo = ctx.mentionedJid?.[0] || ctx.participant || msg.key.participant || msg.key.participantAlt || from;
    let ref = alvo;
    // no grupo, prefere o número de verdade (assim o boneco bate com o da entrada e do perfil)
    try {
        if (String(from).endsWith("@g.us")) {
            const meta = await sock.groupMetadata(from);
            const p = (meta.participants || []).find(x => [x.id, x.lid, x.phoneNumber].includes(alvo));
            if (p?.phoneNumber) ref = p.phoneNumber;
        }
    } catch {}
    try { await sock.sendMessage(from, { react: { text: "👾", key: msg.key } }); } catch {}
    const img = await avatarPixel(ref);
    const u = String(alvo).split("@")[0].split(":")[0];
    if (!img) return sock.sendMessage(from, { text: "😩 Meu lápis de pixel quebrou agora. Tenta daqui a pouco~" }, { quoted: msg });
    const leg = LEGENDAS[Math.floor(Math.random() * LEGENDAS.length)].replace("{u}", u);
    return sock.sendMessage(from, { image: img, caption: leg, mentions: [alvo] }, { quoted: msg });
}

module.exports = { avatarPixel, frasePixel, comandoPixel };
