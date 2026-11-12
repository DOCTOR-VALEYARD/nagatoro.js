// src/signo/signo.js
// Horóscopo do dia: puxa de API pública (inglês), traduz pro português,
// guarda em cache por signo/dia e, se tudo falhar, usa as frases locais (dvcld).
const config = require("../../config");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const mensagens = require("../dvcld/dvcld");

const SIGNOS = {
    aries:       { en: "aries",       simbolo: "♈", nome: "Áries" },
    touro:       { en: "taurus",      simbolo: "♉", nome: "Touro" },
    gemeos:      { en: "gemini",      simbolo: "♊", nome: "Gêmeos" },
    cancer:      { en: "cancer",      simbolo: "♋", nome: "Câncer" },
    leao:        { en: "leo",         simbolo: "♌", nome: "Leão" },
    virgem:      { en: "virgo",       simbolo: "♍", nome: "Virgem" },
    libra:       { en: "libra",       simbolo: "♎", nome: "Libra" },
    escorpiao:   { en: "scorpio",     simbolo: "♏", nome: "Escorpião" },
    sagitario:   { en: "sagittarius", simbolo: "♐", nome: "Sagitário" },
    capricornio: { en: "capricorn",   simbolo: "♑", nome: "Capricórnio" },
    aquario:     { en: "aquarius",    simbolo: "♒", nome: "Aquário" },
    peixes:      { en: "pisces",      simbolo: "♓", nome: "Peixes" },
};

// aceita também o nome em inglês e apelidos comuns
const APELIDOS = {
    aries: "aries", taurus: "touro", gemini: "gemeos", cancer: "cancer", leo: "leao",
    virgo: "virgem", libra: "libra", scorpio: "escorpiao", escorpio: "escorpiao",
    sagittarius: "sagitario", sagitarius: "sagitario", capricorn: "capricornio",
    aquarius: "aquario", pisces: "peixes", peixe: "peixes", gemeo: "gemeos",
};

const CORES = ["🔴 Vermelho", "🟢 Verde", "🟡 Amarelo", "🔵 Azul", "🟠 Laranja", "🟣 Roxo",
    "🩷 Rosa", "⚪ Branco", "⚫ Preto", "🟤 Marrom", "💛 Dourado", "🩵 Turquesa", "🤍 Prata", "💜 Lilás"];

const ZOEIRAS = [
    "Se der errado, a culpa é de Mercúrio, não sua. Talvez.",
    "Os astros falaram. Se vai ouvir, aí já é problema seu.",
    "Lembrando: horóscopo não paga boleto.",
    "Hoje o universo tá do seu lado. Ou pelo menos não tá contra.",
    "Se nada disso acontecer, finge que aconteceu.",
    "Signo não é desculpa pra responder seco no zap.",
    "Os planetas alinharam, agora alinha tua vida também.",
    "Leu? Agora vai beber água e parar de culpar o signo.",
];

const VERSOS = [
    "“Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.” — Salmos 37:5",
    "“Tudo posso naquele que me fortalece.” — Filipenses 4:13",
    "“O choro pode durar uma noite, mas a alegria vem pela manhã.” — Salmos 30:5",
    "“Lâmpada para os meus pés é a tua palavra.” — Salmos 119:105",
    "“Não temas, porque eu sou contigo.” — Isaías 41:10",
];

// cache: { "aries|2026-11-06": { texto, fonte } }
const CACHE = new Map();

function hojeBR() {
    // data no fuso de Brasília (YYYY-MM-DD)
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// número pseudo-aleatório fixo por (signo + dia): muda todo dia, igual pra todo mundo no mesmo dia
function semente(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

function normalizar(s) {
    const n = String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
    if (SIGNOS[n]) return n;
    return APELIDOS[n] || null;
}

// tenta achar o texto da previsão em qualquer formato de JSON
function extrairTexto(d) {
    if (!d) return null;
    if (typeof d === "string") return d.length > 30 ? d : null;
    const campos = ["horoscope_data", "horoscope", "prediction", "description", "text", "reading"];
    for (const c of campos) if (typeof d[c] === "string" && d[c].length > 30) return d[c];
    for (const k of ["data", "result", "results"]) {
        if (d[k]) { const t = extrairTexto(Array.isArray(d[k]) ? d[k][0] : d[k]); if (t) return t; }
    }
    return null;
}

async function buscarIngles(en) {
    // todas ao mesmo tempo: vale a primeira que responder com texto
    const pega = async (req) => { const r = await req; const t = extrairTexto(r.data); if (!t) throw new Error("vazio"); return t.trim(); };
    const H = { timeout: 7000, headers: { "User-Agent": "Mozilla/5.0" } };
    return Promise.any([
        pega(axios.get(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${en}&day=TODAY`, H)),
        pega(axios.get(`https://freehoroscopeapi.com/api/v1/get-horoscope/daily?sign=${en}`, H)),
        pega(axios.get(`https://freehoroscopeapi.com/api/v1/daily?sign=${en}`, H)),
        pega(axios.get(`https://ohmanda.com/api/horoscope/${en}/`, H)),
        pega(axios.post(`https://aztro.sameerkumar.website/?sign=${en}&day=today`, {}, H)),
    ]).catch(() => null);
}

async function traduzir(texto) {
    try {
        const r = await axios.get(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(texto)}`,
            { timeout: 7000 }
        );
        const out = r.data[0].map(x => x[0]).join("").trim();
        return out || null;
    } catch { return null; }
}

async function previsaoDoDia(chave) {
    const dia = hojeBR();
    const id = `${chave}|${dia}`;
    if (CACHE.has(id)) return CACHE.get(id);

    // limpa cache de dias anteriores
    for (const k of CACHE.keys()) if (!k.endsWith(dia)) CACHE.delete(k);

    let res = null;
    // 0) varredura no site (João Bidu), igual notícia: texto em português, cor, palpite e link
    try {
        const site = await require("../apis-publicas/apis-publicas").horoscopoSite(SIGNOS[chave].nome);
        if (site) { res = { texto: site.texto, online: "site", site }; CACHE.set(id, res); return res; }
    } catch {}
    const ingles = await buscarIngles(SIGNOS[chave].en);
    if (ingles) {
        const pt = await traduzir(ingles);
        if (pt) res = { texto: pt, online: true };
    }
    if (!res) {
        // reserva 1: a IA grátis da Nagatoro escreve o horóscopo do dia (já em português)
        const [a, m, d] = dia.split("-");
        const txt = await require("../apis-publicas/apis-publicas").horoscopoIA(SIGNOS[chave].nome, `${d}/${m}/${a}`);
        if (txt) res = { texto: txt, online: "ia" };
        if (res) { CACHE.set(id, res); return res; }
    }
    if (!res) {
        // reserva 2: frase local, mas fixa no dia (não muda a cada comando)
        const lista = mensagens[chave] || [];
        const rnd = semente(`frase|${id}`);
        res = { texto: lista.length ? lista[Math.floor(rnd() * lista.length)] : "Os astros tão de folga hoje. Tenta mais tarde.", online: false };
        // não guarda a reserva por muito tempo: deixa tentar a API de novo na próxima
        return res;
    }
    CACHE.set(id, res);
    return res;
}

function listaSignos() {
    return Object.values(SIGNOS).map(s => `${s.simbolo} ${s.nome}`).join("  ");
}

class Cassi {
    static async getHoroscope(sock, from, msg, sign) {
        const caminhoImagem = path.join(__dirname, "../midias/imagens/menu.png");
        const P = config.PREFIX;

        if (!sign || !String(sign).trim()) {
            return sock.sendMessage(from, {
                text: `🔮 Fala teu signo, né.\nUso: ${P}signo leão\n\n${listaSignos()}`
            }, { quoted: msg });
        }

        const chave = normalizar(sign);
        if (!chave) {
            return sock.sendMessage(from, {
                text: `❌ "${sign}" não é signo, é invenção.\nEscolhe um desses:\n\n${listaSignos()}`
            }, { quoted: msg });
        }

        try { await sock.sendMessage(from, { react: { text: "🔮", key: msg.key } }); } catch {}

        const s = SIGNOS[chave];
        const dia = hojeBR();
        const { texto, online, site } = await previsaoDoDia(chave);

        // sorte do dia: muda todo dia, igual pra todo mundo do mesmo signo
        const rnd = semente(`sorte|${chave}|${dia}`);
        const numero = site && site.palpite && site.palpite.length ? site.palpite.join(", ") : 1 + Math.floor(rnd() * 60);
        const cor = site && site.cor ? site.cor.charAt(0) + site.cor.slice(1).toLowerCase() : CORES[Math.floor(rnd() * CORES.length)];
        const hora = `${String(6 + Math.floor(rnd() * 17)).padStart(2, "0")}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}`;
        const energia = 40 + Math.floor(rnd() * 61);
        const amor = 20 + Math.floor(rnd() * 81);
        const grana = 10 + Math.floor(rnd() * 91);
        const zoeira = ZOEIRAS[Math.floor(rnd() * ZOEIRAS.length)];
        const verso = VERSOS[Math.floor(rnd() * VERSOS.length)];

        const [a, m, d] = dia.split("-");
        const remetente = msg.key.participant || msg.key.remoteJid;
        const idUsuario = remetente.split("@")[0];

        const legenda =
`${s.simbolo} *${s.nome.toUpperCase()}* — ${d}/${m}/${a}
Pra: @${idUsuario}

📜 ${texto}

🍀 ${site && site.palpite && site.palpite.length ? "Palpite" : "Número"}: *${numero}*  •  🎨 ${cor}  •  ⏰ ${hora}
⚡ Energia ${energia}%  •  ❤️ Amor ${amor}%  •  💸 Grana ${grana}%

😏 ${zoeira}
📖 ${verso}

${online === "site" ? `📰 ${site.fonte}\n🔗 ${site.link}\n` : online === "ia" ? "✨ Previsão do dia" : online ? "🌐 Previsão do dia (traduzida)" : "📦 Previsão reserva (API fora do ar)"} • só diversão
🤍 ${config.BOT_NAME}`;

        if (fs.existsSync(caminhoImagem)) {
            return sock.sendMessage(from, {
                image: fs.readFileSync(caminhoImagem),
                caption: legenda,
                mentions: [remetente]
            }, { quoted: msg });
        }
        return sock.sendMessage(from, { text: legenda, mentions: [remetente] }, { quoted: msg });
    }
}

module.exports = { Cassi };
