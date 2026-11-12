/* =================================================
   👉 NAGATORO — CUTUCAR (antigo .tang, que só dizia "Ei, @pessoa!")
   <prefixo>cutucar @pessoa  → cutuca quem você marcou
   <prefixo>cutucar          → a Nagatoro escolhe alguém do grupo
   (o .tang continua funcionando, é o mesmo comando)
================================================= */
const config = require("../../config");

const FRASES = [
    "👉 @{alvo}, acorda! @{autor} tá te cutucando. Responde logo que eu não sou pombo-correio 🙄",
    "👉 Cutuquei @{alvo} a mando de @{autor}. Se doeu, reclama com ele(a) 😏",
    "👉 @{alvo}… @{alvo}… @{alvo}! Ah, agora sim. @{autor} quer atenção, coitado(a) 🥱",
    "👉 Ô @{alvo}, sumiu por quê? @{autor} sentiu sua falta. Que fofo, eca 🤢",
    "👉 @{alvo}, tô cutucando porque @{autor} não tem coragem de chamar no PV 🤭",
    "👉 *CUTUCADA NÍVEL MÁXIMO* em @{alvo}! Patrocínio: @{autor} 💥"
];
const SORTEADO = [
    "🎯 Ninguém marcado? Então eu escolho: @{alvo}, você foi cutucado(a) aleatoriamente. Azar o seu 😏",
    "🎯 Rodei a roleta e caiu em @{alvo}. Cutucado(a)! Agora fala alguma coisa aí 🙄"
];

const num = (j) => String(j || "").split("@")[0].split(":")[0];
const sortear = (l) => l[Math.floor(Math.random() * l.length)];

async function cutucar(sock, msg) {
    const from = msg.key.remoteJid;
    const autor = msg.key.participant || msg.key.participantAlt || from;
    if (!from.endsWith("@g.us")) return sock.sendMessage(from, { text: "👉 Cutucar é só em grupo, senpai." }, { quoted: msg });

    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    let alvo = ctx.mentionedJid?.[0] || ctx.participant || null;
    let frase = FRASES;
    if (!alvo) {
        try {
            const meta = await sock.groupMetadata(from);
            const meus = [num(sock.user?.id), num(sock.user?.lid)].filter(Boolean);
            const lista = (meta.participants || []).filter(p => num(p.id) !== num(autor) && !meus.includes(num(p.id)) && !meus.includes(num(p.phoneNumber)));
            alvo = lista.length ? sortear(lista).id : null;
        } catch {}
        frase = SORTEADO;
    }
    if (!alvo) return sock.sendMessage(from, { text: `❌ Marque alguém: *${config.PREFIX}cutucar @pessoa*` }, { quoted: msg });
    if (num(alvo) === num(autor)) return sock.sendMessage(from, { text: "😏 Cutucar a si mesmo(a)? Carência nível máximo." }, { quoted: msg });

    const texto = sortear(frase).split("{alvo}").join(num(alvo)).split("{autor}").join(num(autor));
    // 🎌 gif de anime cutucando (nekos.best); se a API cair, vai só o texto como antes
    try {
        const g = await require("../apis-publicas/apis-publicas").gifAnime("cutucar");
        if (g) return sock.sendMessage(from, { video: g.video, gifPlayback: true, caption: texto, mentions: [alvo, autor] }, { quoted: msg });
    } catch {}
    return sock.sendMessage(from, { text: texto, mentions: [alvo, autor] }, { quoted: msg });
}

module.exports = { cutucar };
