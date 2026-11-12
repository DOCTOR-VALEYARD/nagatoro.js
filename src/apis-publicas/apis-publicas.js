// src/apis-publicas/apis-publicas.js
// APIs públicas e grátis (sem chave) usadas DENTRO de comandos que já existem.
// Tudo aqui é "plano A": se a API cair, cada comando continua com o jeito antigo dele.
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const UA = { "User-Agent": "NagatoroBot/5.0 (bot de WhatsApp)" };
const get = (url, ms = 6000, extra = {}) => axios.get(url, { timeout: ms, headers: UA, ...extra });

/* ───────────────────────── 📖 VERSÍCULO (bible-api.com, Almeida) ───────────────────────── */
const LIVROS = {
    GEN: "Gênesis", EXO: "Êxodo", LEV: "Levítico", NUM: "Números", DEU: "Deuteronômio", JOS: "Josué", JDG: "Juízes", RUT: "Rute",
    "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Reis", "2KI": "2 Reis", "1CH": "1 Crônicas", "2CH": "2 Crônicas", EZR: "Esdras",
    NEH: "Neemias", EST: "Ester", JOB: "Jó", PSA: "Salmos", PRO: "Provérbios", ECC: "Eclesiastes", SNG: "Cânticos", ISA: "Isaías",
    JER: "Jeremias", LAM: "Lamentações", EZK: "Ezequiel", DAN: "Daniel", HOS: "Oseias", JOL: "Joel", AMO: "Amós", OBA: "Obadias",
    JON: "Jonas", MIC: "Miqueias", NAM: "Naum", HAB: "Habacuque", ZEP: "Sofonias", HAG: "Ageu", ZEC: "Zacarias", MAL: "Malaquias",
    MAT: "Mateus", MRK: "Marcos", LUK: "Lucas", JHN: "João", ACT: "Atos", ROM: "Romanos", "1CO": "1 Coríntios", "2CO": "2 Coríntios",
    GAL: "Gálatas", EPH: "Efésios", PHP: "Filipenses", COL: "Colossenses", "1TH": "1 Tessalonicenses", "2TH": "2 Tessalonicenses",
    "1TI": "1 Timóteo", "2TI": "2 Timóteo", TIT: "Tito", PHM: "Filemom", HEB: "Hebreus", JAS: "Tiago", "1PE": "1 Pedro", "2PE": "2 Pedro",
    "1JN": "1 João", "2JN": "2 João", "3JN": "3 João", JUD: "Judas", REV: "Apocalipse"
};
// livros com versículos curtos e de conselho (fica bonito no perfil)
const LIVROS_CONSELHO = "PSA,PRO,ECC,ISA,MAT,JHN,ROM,1CO,PHP,COL,1TH,JAS,1PE,1JN";
const _poolVers = [];
let _buscandoVers = false;

async function _buscarVersiculos(qtd = 6) {
    if (_buscandoVers) return; _buscandoVers = true;
    try {
        for (let i = 0; i < qtd * 2 && _poolVers.length < 12; i++) {
            try {
                const r = await get(`https://bible-api.com/data/almeida/random/${LIVROS_CONSELHO}`, 5000);
                const v = r.data && (r.data.random_verse || r.data.verse || r.data);
                const texto = String(v?.text || "").replace(/\s+/g, " ").trim();
                if (!texto || texto.length > 190) continue;            // só os curtinhos
                const livro = LIVROS[v.book_id] || v.book || v.book_name || "";
                if (!livro) continue;
                _poolVers.push([texto, `${livro} ${v.chapter}:${v.verse}`]);
            } catch { break; }
        }
    } finally { _buscandoVers = false; }
}

/** um versículo novo a cada perfil; se a API estiver fora, usa a lista local */
async function versiculoAleatorio(listaLocal) {
    if (_poolVers.length < 4) _buscarVersiculos().catch(() => {});
    if (!_poolVers.length) {
        // primeira vez: espera um pouquinho a API, sem travar o perfil
        await Promise.race([_buscarVersiculos(2).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
    }
    if (_poolVers.length) return _poolVers.splice(Math.floor(Math.random() * _poolVers.length), 1)[0];
    const l = listaLocal && listaLocal.length ? listaLocal : [["O Senhor é o meu pastor; nada me faltará.", "Salmos 23:1"]];
    return l[Math.floor(Math.random() * l.length)];
}

/* ───────────────────────── 🎬 GIF DE ANIME (nekos.best) ───────────────────────── */
// categoria do bot → categoria da API
const CAT_GIF = { matar: "shoot", tapa: "slap", chute: "kick", beijar: "kiss", abracar: "hug", cutucar: "poke", tang: "poke" };

function _ffmpeg(args) {
    return new Promise((resolve, reject) => {
        const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
        let e = ""; p.stderr.on("data", d => { e += d; });
        p.once("error", reject);
        p.once("close", c => c === 0 ? resolve() : reject(new Error(e.slice(-400))));
        setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 20000);
    });
}

/** devolve { video: Buffer(mp4), anime } ou null */
async function gifAnime(comando) {
    const cat = CAT_GIF[comando]; if (!cat) return null;
    const tmp = path.join(os.tmpdir(), `nekos_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    try {
        const r = await get(`https://nekos.best/api/v2/${cat}`, 5000);
        const item = r.data?.results?.[0]; if (!item?.url) return null;
        const g = await get(item.url, 9000, { responseType: "arraybuffer", maxContentLength: 12 * 1024 * 1024 });
        fs.writeFileSync(tmp + ".gif", Buffer.from(g.data));
        await _ffmpeg(["-y", "-i", tmp + ".gif", "-movflags", "faststart", "-pix_fmt", "yuv420p",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-an", "-t", "8", tmp + ".mp4"]);
        return { video: fs.readFileSync(tmp + ".mp4"), anime: item.anime_name || "" };
    } catch { return null; }
    finally { for (const x of [".gif", ".mp4"]) { try { fs.unlinkSync(tmp + x); } catch {} } }
}

/* ───────────────────────── 🎶 LETRA (lrclib.net) ───────────────────────── */
/** { artista, musica, letra } ou null
 *  Funciona com ou sem o " - ": primeiro descobre artista e música pelo nome digitado
 *  (sugestão do lyrics.ovh, que usa a busca do Deezer), depois procura a letra no LRCLIB e no lyrics.ovh. */
async function letraLRCLIB(entrada) {
    const limpar = t => String(t || "").replace(/\[\d+:\d+(?:\.\d+)?\]\s?/g, "").trim();
    const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ");
    const PARAR = new Set(["e", "de", "da", "do", "das", "dos", "a", "o", "as", "os", "the", "feat", "ft", "part", "com"]);
    const palavras = t => norm(t).split(/\s+/).filter(w => w && !PARAR.has(w));
    const alvo = palavras(entrada);
    // nota de 0 a 1: quantas palavras que a pessoa digitou aparecem no artista + nome da música
    const nota = (artista, musica) => {
        const tem = new Set(palavras(`${artista} ${musica}`));
        if (!alvo.length) return 0;
        const acertos = alvo.filter(w => tem.has(w)).length;
        const daMusica = palavras(musica).filter(w => alvo.includes(w)).length;   // tem que acertar pelo menos 1 palavra do nome da música
        return daMusica ? acertos / alvo.length : 0;
    };
    const MIN = 0.6;   // precisa bater pelo menos 60% das palavras

    const buscaLRC = async (url) => {
        const r = await get(url, 7000);
        return (Array.isArray(r.data) ? r.data : (r.data ? [r.data] : []))
            .filter(x => (x.plainLyrics || x.syncedLyrics) && !x.instrumental)
            .map(x => ({ artista: x.artistName || "", musica: x.trackName || "", letra: limpar(x.plainLyrics || x.syncedLyrics), n: nota(x.artistName, x.trackName) }));
    };
    const daOVH = async (a, m) => {
        const r = await get(`https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(m)}`, 8000);
        if (!r.data?.lyrics) return [];
        return [{ artista: a, musica: m, letra: limpar(r.data.lyrics), n: nota(a, m) }];
    };
    const melhor = (listas) => {
        const todos = listas.flat().filter(x => x && x.letra && x.n >= MIN);
        todos.sort((a, b) => b.n - a.n);
        return todos[0] ? { artista: todos[0].artista, musica: todos[0].musica, letra: todos[0].letra } : null;
    };
    const juntos = (tarefas) => Promise.allSettled(tarefas).then(rs => rs.filter(r => r.status === "fulfilled").map(r => r.value));

    // 1) com " - " → artista e música já separados (aí confia mais e aceita o resultado direto)
    if (entrada.includes(" - ")) {
        const [a, m] = entrada.split(" - ").map(x => x.trim());
        const l = (await juntos([
            buscaLRC(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(a)}&track_name=${encodeURIComponent(m)}`),
            daOVH(a, m)
        ])).flat().filter(x => x.letra);
        l.sort((x, y) => y.n - x.n);
        if (l[0]) return { artista: l[0].artista, musica: l[0].musica, letra: l[0].letra };
    }
    // 2) descobre artista + música pelo texto (busca do Deezer) e escolhe o que MAIS PARECE com o digitado
    let candidatos = [];
    try {
        const s = await get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(entrada)}`, 7000);
        candidatos = (s.data?.data || []).map(x => [x.artist?.name, x.title_short || x.title]).filter(x => x[0] && x[1])
            .map(([a, m]) => ({ a, m, n: nota(a, m) })).filter(x => x.n >= MIN).sort((x, y) => y.n - x.n).slice(0, 3);
    } catch {}
    for (const c of candidatos) {
        const r = melhor(await juntos([
            buscaLRC(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(c.a)}&track_name=${encodeURIComponent(c.m)}`),
            daOVH(c.a, c.m)
        ]));
        if (r) return r;
    }
    // 3) busca livre no LRCLIB + jeitos de separar "artista música" sem o traço
    const pal = entrada.split(/\s+/).filter(Boolean), tarefas = [buscaLRC(`https://lrclib.net/api/search?q=${encodeURIComponent(entrada)}`)];
    for (let k = 1; k < pal.length && k <= 4; k++) {
        tarefas.push(buscaLRC(`https://lrclib.net/api/search?artist_name=${encodeURIComponent(pal.slice(0, k).join(" "))}&track_name=${encodeURIComponent(pal.slice(k).join(" "))}`));
    }
    return melhor(await juntos(tarefas));
}

/* ───────────────────────── 📍 entende "Franca SP", "franca - sp", "franca/sp", "Franca, SP, Brasil" ───────────────────────── */
const UFS = { AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
    GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
    PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
    SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins" };
function separarCidade(entrada) {
    let t = String(entrada || "").trim().replace(/\s*[,/\-–]\s*/g, " ").replace(/\s+/g, " ");
    let pais = null, uf = null;
    const partes = t.split(" ");
    if (partes.length > 1 && /^(brasil|brazil|br)$/i.test(partes[partes.length - 1])) { pais = "BR"; partes.pop(); }
    if (partes.length > 1 && UFS[partes[partes.length - 1].toUpperCase()]) { uf = partes.pop().toUpperCase(); pais = "BR"; }
    return { cidade: partes.join(" "), uf, estado: uf ? UFS[uf] : null, pais };
}

/* ───────────────────────── 🌦️ TEMPO (open-meteo.com) ───────────────────────── */
const WMO = {
    0: ["☀️", "céu limpo"], 1: ["🌤️", "poucas nuvens"], 2: ["⛅", "parcialmente nublado"], 3: ["☁️", "nublado"],
    45: ["🌫️", "neblina"], 48: ["🌫️", "neblina com geada"], 51: ["🌦️", "garoa fraca"], 53: ["🌦️", "garoa"], 55: ["🌧️", "garoa forte"],
    61: ["🌧️", "chuva fraca"], 63: ["🌧️", "chuva"], 65: ["🌧️", "chuva forte"], 66: ["🌧️", "chuva congelada"], 67: ["🌧️", "chuva congelada forte"],
    71: ["❄️", "neve fraca"], 73: ["❄️", "neve"], 75: ["❄️", "neve forte"], 80: ["🌦️", "pancadas de chuva"], 81: ["🌧️", "pancadas fortes"],
    82: ["⛈️", "temporal"], 95: ["⛈️", "trovoadas"], 96: ["⛈️", "trovoadas com granizo"], 99: ["⛈️", "trovoadas com granizo forte"]
};
/** dados prontos pra mensagem, ou null */
async function tempoOpenMeteo(cidade) {
    try {
        const loc = separarCidade(cidade);
        const g = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc.cidade)}&count=10&language=pt&format=json` +
            (loc.pais ? `&countryCode=${loc.pais}` : ""), 6000);
        const lista = g.data?.results || [];
        const sa = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // com estado (SP, MG...) escolhe a cidade daquele estado; sem estado, prefere a do Brasil
        const l = (loc.estado && lista.find(x => sa(x.admin1) === sa(loc.estado))) || lista.find(x => x.country_code === "BR") || lista[0];
        if (!l) return null;
        const f = await get(`https://api.open-meteo.com/v1/forecast?latitude=${l.latitude}&longitude=${l.longitude}` +
            `&current=temperature_2m,apparent_temperature,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code` +
            `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&timezone=auto&forecast_days=1&wind_speed_unit=ms`, 6000);
        const c = f.data.current, d = f.data.daily;
        const [icone, descricao] = WMO[c.weather_code] || ["🌡️", "tempo variável"];
        const hora = s => String(s || "").split("T")[1] || "--:--";
        return {
            icone, descricao, cidade: l.name, pais: l.country_code || l.country || "", estado: l.admin1 || "",
            temp: Math.round(c.temperature_2m), sensacao: Math.round(c.apparent_temperature),
            min: Math.round(d.temperature_2m_min[0]), max: Math.round(d.temperature_2m_max[0]),
            umidade: c.relative_humidity_2m, pressao: Math.round(c.pressure_msl), vento: c.wind_speed_10m,
            chuva: d.precipitation_probability_max?.[0], nascer: hora(d.sunrise[0]), por: hora(d.sunset[0])
        };
    } catch { return null; }
}

/* ───────────────────────── 📰 HORÓSCOPO DO SITE (João Bidu, Tribuna de Minas) ─────────────────────────
   Faz a "varredura" no site, igual comando de notícia: pega o post de hoje, recorta o trecho do signo
   e devolve com cor, palpite e o link pra ler completo. Site WordPress: usa a API do WP e, se não der, o RSS. */
const _entidades = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…" };
function _txt(html) {
    return String(html || "")
        .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&([a-z]+);/gi, (m, n) => _entidades[n.toLowerCase()] ?? m)
        .replace(/[ \t\u00a0]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}
const _semAcento = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const SITE_HORO = "https://tribunademinas.com.br";
let _horoSite = { dia: null, post: null };

async function _postHoroscopoHoje() {
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (_horoSite.dia === hoje && _horoSite.post) return _horoSite.post;
    const recente = d => (Date.now() - new Date(d).getTime()) < 30 * 3600 * 1000;
    let post = null;
    try {   // 1) API do WordPress
        const r = await get(`${SITE_HORO}/wp-json/wp/v2/posts?search=${encodeURIComponent("horóscopo de hoje")}&per_page=3&_fields=date,link,title,content`, 8000);
        const p = (Array.isArray(r.data) ? r.data : []).find(x => /hor[oó]scopo/i.test(_txt(x.title?.rendered)) && recente(x.date));
        if (p) post = { link: p.link, html: p.content?.rendered || "" };
    } catch {}
    if (!post) {
        try {   // 2) RSS de busca do WordPress
            const r = await get(`${SITE_HORO}/feed/?s=${encodeURIComponent("horóscopo de hoje")}`, 8000);
            for (const item of String(r.data).split(/<item>/i).slice(1)) {
                const titulo = _txt((item.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
                const data = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1];
                if (!/hor[oó]scopo/i.test(titulo) || !data || !recente(data)) continue;
                const link = _txt((item.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]);
                let html = (item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) || [])[1] || "";
                html = html.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
                post = { link, html }; break;
            }
        } catch {}
    }
    if (post && /<h[2-4]/i.test(post.html)) _horoSite = { dia: hoje, post };
    return post;
}

/** { texto, cor, palpite:[n], link, fonte } ou null — nomePT ex.: "Leão" */
async function horoscopoSite(nomePT) {
    try {
        const post = await _postHoroscopoHoje(); if (!post) return null;
        const partes = post.html.split(/<h[2-4][^>]*>/i).slice(1);
        const alvo = _semAcento(nomePT);
        for (const parte of partes) {
            const [cab, corpo = ""] = parte.split(/<\/h[2-4]>/i);
            if (!_semAcento(_txt(cab)).includes(alvo)) continue;
            let t = _txt(corpo);
            const cp = t.match(/Cor:\s*([^\n]+?)\s*Palpite:\s*([\d ,]+)/i);
            if (cp) t = t.replace(cp[0], "");
            t = t.replace(/\n+/g, " ").trim();
            if (t.length < 20) return null;
            if (t.length > 420) t = t.slice(0, 420).replace(/\s+\S*$/, "") + "…";
            return {
                texto: t, cor: cp ? cp[1].trim() : null,
                palpite: cp ? cp[2].split(/[ ,]+/).filter(Boolean).map(Number) : [],
                link: post.link, fonte: "João Bidu · Tribuna de Minas"
            };
        }
    } catch {}
    return null;
}

/* ───────────────────────── 🔮 HORÓSCOPO pela IA grátis (reserva do .signo) ───────────────────────── */
async function horoscopoIA(nomeSigno, dataBR) {
    try {
        const config = require("../../config");
        const { chamarIA } = require("../nagatoro-ia/nagatoro-ia.js");
        const t = await chamarIA([
            { role: "system", content: "Você escreve horóscopos curtos de entretenimento em português do Brasil." },
            { role: "user", content: `Escreva o horóscopo de hoje (${dataBR}) para o signo de ${nomeSigno}. ` +
                "2 a 3 frases, tom leve e positivo, falando de humor do dia, amor ou trabalho. " +
                "Sem emojis, sem título, sem aspas, sem prometer nada certo. Responda só com o texto." }
        ], config.AI_MODEL);
        const txt = String(t || "").replace(/^["'“]|["'”]$/g, "").trim();
        return txt.length > 30 && txt.length < 700 ? txt : null;
    } catch { return null; }
}

module.exports = { separarCidade, versiculoAleatorio, gifAnime, letraLRCLIB, tempoOpenMeteo, horoscopoIA, horoscopoSite, CAT_GIF };
