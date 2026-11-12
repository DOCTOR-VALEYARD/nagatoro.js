/* =================================================
   📰 NAGATORO — PLANTÃO DE NOTÍCIAS
   📁 Arquivo: src/noticias/noticias.js

   • $noticias                → manchetes do Brasil agora
   • $noticias <categoria>    → mundo, tecnologia, esportes, famosos,
                                economia, saude, ciencia, golpes
   • $noticias <assunto>      → pesquisa (ex.: $noticias flamengo)
   • $plantao 1 / 0           → (ADM) liga/desliga o PLANTÃO URGENTE no grupo
   • $plantao teste           → (ADM) mostra como fica um alerta
   • $plantao                 → status

   Card próprio (foto do bot inteira, sem cortar) + botões que abrem a
   reportagem direto no navegador. Nenhum link aparece escrito na mensagem.
   O PLANTÃO URGENTE verifica as notícias sozinho e, quando sai algo
   realmente importante, manda no grupo marcando todo mundo
   (só nos grupos onde ele foi ligado e onde o bot é ADM).

   Fonte: Google Notícias (grátis, sem chave), reserva: G1.
   Ajustes opcionais no config.js → NOTICIAS: { ... } (veja CFG abaixo).
================================================= */
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const config = require("../../config");

// ⚙️ ajustes (dá pra sobrescrever em config.js → NOTICIAS: { ... })
const CFG = Object.assign({
    INTERVALO_MIN: 10,          // de quanto em quanto tempo o plantão verifica
    JANELA_MIN: 90,             // só alerta notícia publicada nos últimos X minutos
    INTERVALO_ALERTA_MIN: 45,   // espera mínima entre 2 alertas no mesmo grupo
    MAX_ALERTAS_DIA: 5,         // máximo de alertas por grupo por dia
    SILENCIO_INICIO: 0,         // não manda alerta de 0h…
    SILENCIO_FIM: 7,            // …até 7h (horário de Brasília)
    BOTOES_NA_TELA: 1,          // botões que aparecem na mensagem (o resto vai pra "VER REPORTAGENS")
    COMENTARIO_IA: true,        // comentário curtinho da Nagatoro no $noticias
}, config.NOTICIAS || {});

const ARQ = path.join(__dirname, "../../database/noticias-plantao.json");
const FONTES_DIR = path.join(__dirname, "../midias/assets/fonts");
const UA = { "User-Agent": "Mozilla/5.0 (Linux; Android 13) NagatoroBot/5.0", "Accept-Language": "pt-BR,pt;q=0.9" };
const GN = "hl=pt-BR&gl=BR&ceid=BR:pt-419";

// ═════════════════════ 🗂️ CATEGORIAS ═════════════════════
const CATEGORIAS = {
    brasil:     { nome: "Brasil",     url: `https://news.google.com/rss?${GN}`,                                             g1: "https://g1.globo.com/rss/g1/" },
    mundo:      { nome: "Mundo",      url: `https://news.google.com/rss/headlines/section/topic/WORLD?${GN}`,              g1: "https://g1.globo.com/rss/g1/mundo/" },
    tecnologia: { nome: "Tecnologia", url: `https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?${GN}`,         g1: "https://g1.globo.com/rss/g1/tecnologia/" },
    esportes:   { nome: "Esportes",   url: `https://news.google.com/rss/headlines/section/topic/SPORTS?${GN}`,             g1: "https://g1.globo.com/esportes/feed/rss2.xml" },
    famosos:    { nome: "Famosos",    url: `https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?${GN}`,      g1: "https://g1.globo.com/rss/g1/pop-arte/" },
    economia:   { nome: "Economia",   url: `https://news.google.com/rss/headlines/section/topic/BUSINESS?${GN}`,           g1: "https://g1.globo.com/rss/g1/economia/" },
    saude:      { nome: "Saúde",      url: `https://news.google.com/rss/headlines/section/topic/HEALTH?${GN}`,             g1: "https://g1.globo.com/rss/g1/bemestar/" },
    ciencia:    { nome: "Ciência",    url: `https://news.google.com/rss/headlines/section/topic/SCIENCE?${GN}`,            g1: "https://g1.globo.com/rss/g1/ciencia-e-saude/" },
    golpes:     { nome: "Golpes",     url: `https://news.google.com/rss/search?q=${encodeURIComponent("golpe whatsapp OR golpe pix OR golpe digital OR fraude bancária when:7d")}&${GN}`, g1: "https://g1.globo.com/rss/g1/tecnologia/" },
};
const APELIDOS = {
    br: "brasil", nacional: "brasil", geral: "brasil", hoje: "brasil",
    internacional: "mundo", tec: "tecnologia", tech: "tecnologia", tecnologias: "tecnologia",
    esporte: "esportes", futebol: "esportes", famoso: "famosos", entretenimento: "famosos", fofoca: "famosos",
    dinheiro: "economia", saúde: "saude", ciência: "ciencia", golpe: "golpes", seguranca: "golpes", segurança: "golpes",
};

// ═════════════════════ 💾 BANCO ═════════════════════
function ler() { try { return JSON.parse(fs.readFileSync(ARQ, "utf8")) || {}; } catch { return {}; } }
function salvar(d) {
    try { fs.mkdirSync(path.dirname(ARQ), { recursive: true }); fs.writeFileSync(ARQ, JSON.stringify(d, null, 2)); } catch (e) { console.error("⚠️ noticias: não salvou:", e.message); }
}

// ═════════════════════ 📡 BUSCAR NOTÍCIAS ═════════════════════
function decodificar(t) {
    return String(t || "")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&amp;/g, "&");
}
const tag = (bloco, nome) => { const m = bloco.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`, "i")); return m ? decodificar(m[1]).trim() : ""; };
const semHtml = t => String(t || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function lerRss(xml, fontePadrao) {
    const itens = [];
    const blocos = String(xml || "").match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
    for (const b of blocos) {
        const fonte = semHtml(tag(b, "source")) || fontePadrao || "";
        let titulo = semHtml(tag(b, "title"));
        if (fonte && titulo.endsWith(` - ${fonte}`)) titulo = titulo.slice(0, -(fonte.length + 3)).trim();
        const link = semHtml(tag(b, "link")) || (b.match(/<link>([^<]+)/i) || [])[1] || "";
        if (!titulo || !/^https?:\/\//i.test(link)) continue;
        const data = Date.parse(tag(b, "pubDate")) || Date.now();
        // Google Notícias junta a mesma notícia de vários jornais na descrição
        const desc = tag(b, "description");
        const relacionados = [];
        const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>(?:[\s\S]*?<font[^>]*>([\s\S]*?)<\/font>)?/gi;
        let m;
        while ((m = re.exec(desc))) {
            const t = semHtml(decodificar(m[2])), f = semHtml(decodificar(m[3] || ""));
            if (t && /^https?:\/\//i.test(m[1])) relacionados.push({ titulo: t, fonte: f, link: decodificar(m[1]) });
        }
        const id = semHtml(tag(b, "guid")) || link;
        itens.push({ id, titulo, link, fonte, data, relacionados });
    }
    return itens;
}

const _cache = new Map();
async function buscar(chave, termo) {
    const cat = CATEGORIAS[chave];
    const url = cat ? cat.url : `https://news.google.com/rss/search?q=${encodeURIComponent(termo + " when:3d")}&${GN}`;
    const c = _cache.get(url);
    if (c && Date.now() - c.em < 8 * 60 * 1000) return c.itens;
    let itens = [];
    try {
        const r = await axios.get(url, { timeout: 15000, headers: UA, responseType: "text" });
        itens = lerRss(r.data);
    } catch (e) { console.warn("⚠️ noticias Google:", e.message); }
    if (!itens.length && cat?.g1) {
        try {
            const r = await axios.get(cat.g1, { timeout: 15000, headers: UA, responseType: "text" });
            itens = lerRss(r.data, "G1");
        } catch (e) { console.warn("⚠️ noticias G1:", e.message); }
    }
    // sem repetidas, mais novas primeiro
    const vistos = new Set();
    itens = itens.filter(i => { const k = i.titulo.toLowerCase().slice(0, 60); if (vistos.has(k)) return false; vistos.add(k); return true; })
        .sort((a, b) => b.data - a.data);
    if (itens.length) _cache.set(url, { em: Date.now(), itens });
    return itens;
}

// ═════════════════════ 🕐 DATAS ═════════════════════
const FUSO = { timeZone: "America/Sao_Paulo" };
function haQuanto(ts) {
    const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    return d === 1 ? "ontem" : `há ${d} dias`;
}
function horaBR(d = new Date()) { return d.toLocaleTimeString("pt-BR", { ...FUSO, hour: "2-digit", minute: "2-digit" }); }
function dataBR(d = new Date()) { return d.toLocaleDateString("pt-BR", { ...FUSO, weekday: "long", day: "2-digit", month: "long", year: "numeric" }); }
function dataCurta(d = new Date()) { return d.toLocaleDateString("pt-BR", FUSO); }
function horaNumBR() { return Number(new Date().toLocaleString("en-US", { ...FUSO, hour: "numeric", hour12: false })) % 24; }
function diaBR() { return new Date().toLocaleDateString("en-CA", FUSO); }

// ═════════════════════ 🖼️ FOTO DO BOT ═════════════════════
let _foto = { em: 0, buf: null };
async function fotoDoBot(sock) {
    if (_foto.buf && Date.now() - _foto.em < 60 * 60 * 1000) return _foto.buf;
    let buf = null;
    try {
        const id = String(sock?.user?.id || "").replace(/:\d+@/, "@");
        if (id) {
            const url = await sock.profilePictureUrl(id, "image");
            if (url) buf = Buffer.from((await axios.get(url, { responseType: "arraybuffer", timeout: 15000 })).data);
        }
    } catch {}
    if (!buf) {
        // sem foto de perfil → usa a arte do bot (a mesma do menu / configurar-bot)
        try {
            const { resolverCaminhoSalvo } = require("../caminhos/caminhos");
            const db = JSON.parse(fs.readFileSync(path.join(__dirname, "../../database/botconfig.json"), "utf8")) || {};
            const c = db.BOT_PHOTO ? resolverCaminhoSalvo(db.BOT_PHOTO) : null;
            if (c && /\.(png|jpe?g|webp)$/i.test(c) && fs.existsSync(c)) buf = fs.readFileSync(c);
        } catch {}
    }
    if (!buf) { try { buf = fs.readFileSync(path.join(__dirname, "../midias/imagens/menu.png")); } catch {} }
    _foto = { em: Date.now(), buf };
    return buf;
}

// ═════════════════════ 🎨 CARD ═════════════════════
let _fontes = false;
function fontes(GlobalFonts) {
    if (_fontes) return; _fontes = true;
    for (const [arq, fam] of [["Poppins-Bold.ttf", "NT-Bold"], ["Poppins-Medium.ttf", "NT-Medium"], ["Poppins-Regular.ttf", "NT-Regular"]]) {
        try { const f = path.join(FONTES_DIR, arq); if (fs.existsSync(f)) GlobalFonts.registerFromPath(f, fam); } catch {}
    }
}
const COR = { roxo: "#9b5cff", lilas: "#cdb4ff", rosa: "#ff5cc8", vermelho: "#ff3b5c", branco: "#ffffff", cinza: "#a99cc9", fundo1: "#07031a", fundo2: "#1b0a3a" };

function caixa(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function quebrar(ctx, texto, largura, maxLinhas) {
    const palavras = String(texto).split(/\s+/).filter(Boolean), todas = [];
    let atual = "";
    for (const p of palavras) {
        const t = atual ? atual + " " + p : p;
        if (atual && ctx.measureText(t).width > largura) { todas.push(atual); atual = p; }
        else atual = t;
    }
    if (atual) todas.push(atual);
    if (todas.length <= maxLinhas) return todas;
    // não coube: corta e põe reticências na última linha
    const linhas = todas.slice(0, maxLinhas);
    let ult = linhas[maxLinhas - 1] + " " + todas[maxLinhas];
    while (ult.length > 3 && ctx.measureText(ult + "…").width > largura) ult = ult.slice(0, -1);
    linhas[maxLinhas - 1] = ult.replace(/[\s,.;:-]+$/, "") + "…";
    return linhas;
}
function fundo(ctx, W, H, urgente) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, COR.fundo1); g.addColorStop(0.55, COR.fundo2); g.addColorStop(1, "#0b0420");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const brilhos = urgente
        ? [[0.12, 0.15, 0.55, "rgba(255,59,92,0.22)"], [0.9, 0.85, 0.6, "rgba(155,92,255,0.28)"]]
        : [[0.1, 0.1, 0.55, "rgba(155,92,255,0.30)"], [0.92, 0.9, 0.6, "rgba(255,92,200,0.16)"]];
    for (const [x, y, r, c] of brilhos) {
        const n = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, W * r);
        n.addColorStop(0, c); n.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
    }
    // estrelinhas (sempre no mesmo lugar, pra ficar com cara de arte pronta)
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 160; i++) { ctx.globalAlpha = 0.15 + rnd() * 0.6; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * 1.4 + 0.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // raio diagonal (rachadura no tempo)
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = urgente ? COR.vermelho : COR.lilas; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.62, 0); ctx.lineTo(W * 0.55, H * 0.35); ctx.lineTo(W * 0.66, H * 0.5); ctx.lineTo(W * 0.58, H); ctx.stroke(); ctx.restore();
}
async function painelFoto(ctx, loadImage, foto, x, y, w, h, cor) {
    ctx.save();
    caixa(ctx, x, y, w, h, 28); ctx.clip();
    ctx.fillStyle = "#120726"; ctx.fillRect(x, y, w, h);
    let img = null;
    try { if (foto) img = await loadImage(foto); } catch {}
    if (img) {
        // fundo: a própria foto ampliada e escurecida; frente: a foto INTEIRA, sem cortar
        const cobre = Math.max(w / img.width, h / img.height);
        try { ctx.filter = "blur(18px)"; } catch {}
        ctx.globalAlpha = 0.45;
        ctx.drawImage(img, x + (w - img.width * cobre) / 2, y + (h - img.height * cobre) / 2, img.width * cobre, img.height * cobre);
        try { ctx.filter = "none"; } catch {}
        ctx.globalAlpha = 1;
        const cabe = Math.min((w - 24) / img.width, (h - 24) / img.height);
        ctx.drawImage(img, x + (w - img.width * cabe) / 2, y + (h - img.height * cabe) / 2, img.width * cabe, img.height * cabe);
    }
    ctx.restore();
    ctx.save(); ctx.shadowColor = cor; ctx.shadowBlur = 26; ctx.strokeStyle = cor; ctx.lineWidth = 3;
    caixa(ctx, x, y, w, h, 28); ctx.stroke(); ctx.restore();
}
function pilula(ctx, x, y, texto, cor, fonte = "22px NT-Bold") {
    ctx.font = fonte;
    const w = ctx.measureText(texto).width + 36, h = 40;
    ctx.fillStyle = cor; caixa(ctx, x, y, w, h, 20); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle"; ctx.fillText(texto, x + 18, y + h / 2 + 1);
    ctx.textBaseline = "alphabetic";
    return w;
}
function colunaEsquerda(ctx, W, H, rotulo, cor) {
    const x = 50, w = 360;
    ctx.textAlign = "left";
    ctx.fillStyle = COR.branco; ctx.font = "44px NT-Bold";
    ctx.fillText(String(config.BOT_NAME || "NAGATORO").toUpperCase().slice(0, 14), x, 520);
    ctx.fillStyle = cor; ctx.font = "22px NT-Bold";
    ctx.fillText(rotulo, x, 556);
    ctx.fillStyle = COR.branco; ctx.font = "96px NT-Bold";
    ctx.fillText(horaBR(), x - 4, 680);
    ctx.fillStyle = COR.cinza; ctx.font = "24px NT-Regular";
    const linhas = quebrar(ctx, dataBR(), w, 2);
    linhas.forEach((l, i) => ctx.fillText(i === 0 ? l.charAt(0).toUpperCase() + l.slice(1) : l, x, 722 + i * 32));
    ctx.fillStyle = "rgba(205,180,255,0.55)"; ctx.font = "18px NT-Medium";
    ctx.fillText("HORÁRIO DE BRASÍLIA", x, H - 92);
}
function rodape(ctx, W, H, cor, fonteTxt) {
    ctx.fillStyle = "rgba(10,4,28,0.75)"; ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = cor; ctx.fillRect(0, H - 64, W, 3);
    ctx.font = "20px NT-Medium"; ctx.textBaseline = "middle";
    ctx.textAlign = "left"; ctx.fillStyle = COR.lilas;
    ctx.fillText(`BY ${String(config.OWNER_NAME || "DOCTOR VALEYARD").toUpperCase()}`, 50, H - 31);
    ctx.textAlign = "right"; ctx.fillStyle = COR.cinza;
    ctx.fillText(fonteTxt, W - 50, H - 31);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

async function cardManchetes(sock, { titulo, categoria, itens }) {
    const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
    fontes(GlobalFonts);
    const W = 1280, H = 960;
    const cv = createCanvas(W, H), ctx = cv.getContext("2d");
    fundo(ctx, W, H, false);
    await painelFoto(ctx, loadImage, await fotoDoBot(sock), 50, 50, 360, 420, COR.roxo);
    colunaEsquerda(ctx, W, H, "PLANTÃO DE NOTÍCIAS", COR.lilas);

    // lado direito
    const X = 460, LW = W - X - 50;
    let px = X;
    px += pilula(ctx, px, 52, "● AO VIVO", COR.vermelho) + 12;
    pilula(ctx, px, 52, categoria.toUpperCase(), "rgba(155,92,255,0.85)");
    ctx.fillStyle = COR.branco; ctx.font = "50px NT-Bold"; ctx.textAlign = "left";
    ctx.fillText(titulo, X, 148);
    ctx.fillStyle = COR.roxo; ctx.fillRect(X, 166, 120, 5);

    const topo = 196, alt = (H - 64 - 24 - topo) / 5;
    itens.slice(0, 5).forEach((n, i) => {
        const y = topo + i * alt;
        // cartão de vidro
        ctx.fillStyle = i === 0 ? "rgba(155,92,255,0.16)" : "rgba(255,255,255,0.045)";
        caixa(ctx, X, y, LW, alt - 14, 18); ctx.fill();
        ctx.strokeStyle = i === 0 ? "rgba(155,92,255,0.55)" : "rgba(205,180,255,0.12)"; ctx.lineWidth = 1.5;
        caixa(ctx, X, y, LW, alt - 14, 18); ctx.stroke();
        // número
        const cx = X + 44, cy = y + (alt - 14) / 2;
        ctx.fillStyle = i === 0 ? COR.roxo : "rgba(155,92,255,0.25)";
        ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COR.branco; ctx.font = "24px NT-Bold"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1).padStart(2, "0"), cx, cy + 1);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        // manchete + fonte
        const tx = X + 92, tw = LW - 92 - 24;
        ctx.font = i === 0 ? "29px NT-Bold" : "27px NT-Medium"; ctx.fillStyle = COR.branco;
        const linhas = quebrar(ctx, n.titulo, tw, 2);
        const blocoAlt = linhas.length * 34 + 30;
        let ty = y + (alt - 14 - blocoAlt) / 2 + 26;
        linhas.forEach(l => { ctx.fillText(l, tx, ty); ty += 34; });
        ctx.font = "20px NT-Regular"; ctx.fillStyle = COR.lilas;
        ctx.fillText(`${(n.fonte || "Notícia").toUpperCase()}  ·  ${haQuanto(n.data)}`, tx, ty + 2);
    });
    rodape(ctx, W, H, COR.roxo, "FONTE: GOOGLE NOTÍCIAS");
    return cv.toBuffer("image/jpeg", 92);
}

async function cardUrgente(sock, n) {
    const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
    fontes(GlobalFonts);
    const W = 1280, H = 960;
    const cv = createCanvas(W, H), ctx = cv.getContext("2d");
    fundo(ctx, W, H, true);
    await painelFoto(ctx, loadImage, await fotoDoBot(sock), 50, 50, 360, 420, COR.vermelho);
    colunaEsquerda(ctx, W, H, "PLANTÃO URGENTE", "#ff8da1");

    const X = 460, LW = W - X - 50;
    let px = X;
    px += pilula(ctx, px, 52, "● URGENTE", COR.vermelho) + 12;
    pilula(ctx, px, 52, "PLANTÃO", "rgba(155,92,255,0.85)");

    // manchete grande (o bloco todo fica centralizado na vertical)
    let tam = 62, linhas = [];
    for (; tam >= 38; tam -= 4) {
        ctx.font = `${tam}px NT-Bold`;
        linhas = quebrar(ctx, n.titulo, LW, 5);
        if (linhas.length <= 4) break;
    }
    const outros = [...new Set(n.relacionados.map(r => r.fonte).filter(f => f && f !== n.fonte))];
    ctx.font = "24px NT-Regular";
    const linhasVeic = outros.length ? quebrar(ctx, outros.slice(0, 10).join("  ·  "), LW - 52, 3) : [];
    const altTitulo = linhas.length * tam * 1.18;
    const altCaixa = outros.length ? 76 + linhasVeic.length * 34 : 0;
    const total = altTitulo + 30 + 50 + (outros.length ? 40 + altCaixa : 0);
    const topo = 112, livre = H - 64 - 40 - topo;
    let y = topo + Math.max(0, (livre - total) / 2) + tam * 0.85;

    ctx.font = `${tam}px NT-Bold`; ctx.fillStyle = COR.branco; ctx.textAlign = "left";
    linhas.forEach(l => { ctx.fillText(l, X, y); y += tam * 1.18; });
    y += 4 - tam * 0.85 + 6;
    ctx.fillStyle = COR.vermelho; ctx.fillRect(X, y, 140, 6);
    y += 54;
    ctx.font = "26px NT-Medium"; ctx.fillStyle = COR.lilas;
    ctx.fillText(`${(n.fonte || "Notícia").toUpperCase()}  ·  ${haQuanto(n.data)}`, X, y);
    if (outros.length) {
        const cy = y + 40;
        ctx.fillStyle = "rgba(255,255,255,0.05)"; caixa(ctx, X, cy, LW, altCaixa, 18); ctx.fill();
        ctx.strokeStyle = "rgba(255,59,92,0.35)"; ctx.lineWidth = 1.5; caixa(ctx, X, cy, LW, altCaixa, 18); ctx.stroke();
        ctx.font = "20px NT-Bold"; ctx.fillStyle = "#ff8da1";
        ctx.fillText(`REPERCUTINDO EM ${outros.length + 1} VEÍCULOS`, X + 26, cy + 42);
        ctx.font = "24px NT-Regular"; ctx.fillStyle = COR.branco;
        linhasVeic.forEach((l, i) => ctx.fillText(l, X + 26, cy + 82 + i * 34));
    }
    rodape(ctx, W, H, COR.vermelho, `FONTE: GOOGLE NOTÍCIAS  ·  ${dataCurta()}`);
    return cv.toBuffer("image/jpeg", 92);
}

// ═════════════════════ 🤖 IA (opcional) ═════════════════════
async function perguntarIA(sistema, usuario, ms = 15000) {
    let chamarIA;
    try { ({ chamarIA } = require("../nagatoro-ia/nagatoro-ia")); } catch { return null; }
    try {
        const r = await Promise.race([chamarIA([{ role: "system", content: sistema }, { role: "user", content: usuario }], config.AI_MODEL), new Promise(res => setTimeout(() => res(null), ms))]);
        return r ? String(r).replace(/https?:\/\/\S+/g, "").trim() : null;
    } catch { return null; }
}

// ═════════════════════ 🔘 ENVIO COM BOTÕES ═════════════════════
function corta(t, n) { t = String(t || ""); return t.length > n ? t.slice(0, n - 1).trim() + "…" : t; }

async function enviarComBotoes(sock, jid, { texto, imagem, links, tituloLista, quoted, mentions }) {
    const { enviarNativeFlow, botaoUrl } = require("../menuBotoes/menuBotoes");
    const botoes = links.slice(0, 10).map(l => botaoUrl(corta(l.rotulo, 60), l.url));
    const total = botoes.length;
    try {
        return await enviarNativeFlow(sock, jid, {
            text: texto,
            footer: `👑 ${config.OWNER_NAME || "Doctor Valeyard"}`,
            buttons: botoes,
            imageBuffer: imagem,
            quoted,
            mentions,
            messageParamsJson: JSON.stringify({
                bottom_sheet: {
                    in_thread_buttons_limit: Math.max(0, Math.min(Number(CFG.BOTOES_NA_TELA) || 0, total)),
                    divider_indices: [...Array(Math.max(0, total - 1)).keys()].map(i => i + 1).concat(999),
                    list_title: tituloLista,
                    button_title: "📰 VER REPORTAGENS"
                }
            })
        });
    } catch (e) {
        // se o WhatsApp recusar os botões, manda o card mesmo assim (sem link escrito)
        console.warn("⚠️ noticias botões:", e.message);
        return sock.sendMessage(jid, { image: imagem, caption: texto, mentions }, quoted ? { quoted } : undefined);
    }
}

// ═════════════════════ 📰 $noticias ═════════════════════
const _espera = new Map();
const NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

function textoAjuda() {
    const P = config.PREFIX;
    return [
        "📰 *Categorias do plantão:*",
        "",
        `▸ ${P}noticias · Brasil agora`,
        `▸ ${P}noticias mundo`,
        `▸ ${P}noticias tecnologia`,
        `▸ ${P}noticias esportes`,
        `▸ ${P}noticias famosos`,
        `▸ ${P}noticias economia`,
        `▸ ${P}noticias saude`,
        `▸ ${P}noticias ciencia`,
        `▸ ${P}noticias golpes`,
        "",
        `🔎 Ou pesquisa qualquer assunto: ${P}noticias flamengo`,
        `🚨 ADM: ${P}plantao 1 liga o plantão urgente no grupo`,
    ].join("\n");
}

async function cmdNoticias(sock, msg, args, categoriaFixa) {
    definirSock(sock);
    const from = msg.key.remoteJid;
    const quem = msg.key.participant || msg.key.participantAlt || from;
    const pedido = String((args || []).join(" ")).trim();
    const chaveBruta = pedido.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

    if (/^(ajuda|help|categorias|lista)$/.test(chaveBruta)) return sock.sendMessage(from, { text: textoAjuda() }, { quoted: msg });

    const ult = _espera.get(quem) || 0;
    if (Date.now() - ult < 20000) {
        return sock.sendMessage(from, { text: `⏳ Calma, repórter ansioso. Espera *${Math.ceil((20000 - (Date.now() - ult)) / 1000)}s* pra pedir de novo~` }, { quoted: msg });
    }
    _espera.set(quem, Date.now());

    const chave = categoriaFixa || (chaveBruta ? (CATEGORIAS[chaveBruta] ? chaveBruta : APELIDOS[chaveBruta] || APELIDOS[pedido.toLowerCase()]) : "brasil");
    const pesquisa = !chave && pedido ? pedido.slice(0, 80) : "";
    const nomeCat = chave ? CATEGORIAS[chave].nome : corta(pesquisa, 22);

    try { await sock.sendMessage(from, { react: { text: "📰", key: msg.key } }); } catch {}
    const itens = (await buscar(chave, pesquisa)).slice(0, 5);
    if (!itens.length) {
        _espera.delete(quem);
        return sock.sendMessage(from, { text: pesquisa ? `🔎 Não achei nada recente sobre *${pesquisa}*. Tenta outro assunto~` : "📡 As fontes de notícia não responderam agora. Tenta daqui a pouco~" }, { quoted: msg });
    }

    let card;
    try { card = await cardManchetes(sock, { titulo: pesquisa ? "RESULTADOS DA BUSCA" : "MANCHETES DE AGORA", categoria: nomeCat, itens }); }
    catch (e) { console.error("❌ noticias card:", e.message); card = await fotoDoBot(sock); }

    let comentario = null;
    if (CFG.COMENTARIO_IA) {
        comentario = await perguntarIA(
            "Você é a Nagatoro, bot debochada de WhatsApp. Escreva UM comentário curtinho (no máximo 18 palavras) sobre a manchete principal, em português. " +
            "Se a notícia for triste, grave, de morte, doença, tragédia ou violência, seja séria e respeitosa, sem nenhuma piada. " +
            "Sem opinião política, sem tomar lado, sem inventar fatos que não estão no título. Não use links nem aspas.",
            itens[0].titulo, 12000);
        if (comentario) comentario = corta(comentario.replace(/\s+/g, " "), 160);
    }

    const linhas = [
        `📰 *PLANTÃO DA ${String(config.BOT_NAME || "NAGATORO").toUpperCase()}*`,
        `🗂️ ${pesquisa ? "Busca" : "Categoria"}: *${nomeCat}*`,
        `🕐 ${dataCurta()} · ${horaBR()}`,
        "",
        ...itens.map((n, i) => `${NUM[i]} ${n.titulo}\n      _${n.fonte || "Notícia"} · ${haQuanto(n.data)}_`),
    ];
    if (comentario) linhas.push("", `💬 *${config.BOT_NAME || "Nagatoro"}:* ${comentario}`);
    linhas.push("", "👇 Toca em *VER REPORTAGENS* pra abrir a matéria no navegador", `📚 Outras categorias: *${config.PREFIX}noticias ajuda*`);

    return enviarComBotoes(sock, from, {
        texto: linhas.join("\n"),
        imagem: card,
        links: itens.map((n, i) => ({ rotulo: `${i + 1}. ${n.titulo}`, url: n.link })),
        tituloLista: `📰 ${nomeCat.toUpperCase()} · REPORTAGENS`,
        quoted: msg,
        mentions: [quem]
    });
}

// ═════════════════════ 🚨 PLANTÃO URGENTE ═════════════════════
// palavras de acontecimento forte (precisa ter pelo menos uma)
const RE_EVENTO = new RegExp("\\b(" + [
    "urgente", "ultima hora", "morre", "morreu", "morte d[eo]", "falece\\w*", "faleceu",
    "e preso", "foi pres[oa]", "sao presos", "prisao d[eo]", "presa", "solt[oa]", "soltura", "libertad[oa]", "deixa a prisao",
    "internad[oa]", "internacao", "hospitalizad[oa]", "levad[oa] ao hospital", "uti", "cirurgia", "infarto", "avc",
    "renuncia", "cassad[oa]", "cassacao", "impeachment", "afastad[oa]", "condenad[oa]", "absolvid[oa]", "indiciad[oa]",
    "atentado", "ataque", "explosao", "tiroteio", "massacre", "sequestro", "terremoto", "tsunami", "furacao", "enchente", "deslizamento",
    "queda de aviao", "aviao cai", "acidente aereo", "naufragio", "tragedia", "incendio", "desabamento", "rompimento de barragem",
    "guerra", "invasao", "golpe de estado", "estado de emergencia", "estado de calamidade", "toque de recolher", "apagao",
    "eleit[oa]", "vence a eleicao", "resultado da eleicao", "stf decide", "stf manda", "decreta", "sancion\\w*",
    "aumento da gasolina", "salario minimo", "pix fora do ar", "whatsapp fora do ar", "instabilidade no whatsapp"
].join("|") + ")\\b", "i");
// coisa que NÃO é urgente nunca (fofoca, horóscopo, receita, jogo comum…)
const RE_IGNORAR = /\b(horoscopo|receita|bbb|reality|novela|signo|loteria|mega-sena|quina|lotofacil|palpite|onde assistir|escalacao|ao vivo: assista|promocao|cupom|ofertas?)\b/i;
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function ehUrgente(n) {
    const t = norm(n.titulo);
    if (RE_IGNORAR.test(t) || !RE_EVENTO.test(t)) return false;
    const veiculos = new Set([n.fonte, ...n.relacionados.map(r => r.fonte)].filter(Boolean)).size;
    const resposta = await perguntarIA(
        "Você é editor-chefe de um plantão de notícias no Brasil. Responda SOMENTE 'SIM' ou 'NAO'. " +
        "SIM só se for notícia URGENTE e de interesse NACIONAL que quase todo brasileiro gostaria de saber AGORA " +
        "(ex.: morte, prisão, soltura ou internação de um presidente, ex-presidente, ministro ou figura muito famosa; tragédia grande; " +
        "decisão que muda a vida de todo mundo; ataque; desastre natural grave; queda geral do WhatsApp/PIX). " +
        "NAO para notícias locais, rotina política, fofoca, esporte comum, opinião, análise, previsão ou notícia antiga.",
        `Manchete: ${n.titulo}\nVeículo: ${n.fonte}\nOutros títulos da mesma notícia: ${n.relacionados.slice(0, 5).map(r => r.titulo).join(" | ")}`,
        20000);
    if (resposta) return /^\W*sim\b/i.test(resposta.trim());
    // IA fora do ar: só alerta se muitos jornais estão dando a mesma notícia
    return veiculos >= 4;
}

let sockAtual = null, _intervalo = null, _rodando = false;

function definirSock(sock) {
    if (sock) sockAtual = sock;
    if (!_intervalo) {
        _intervalo = setInterval(() => verificarPlantao().catch(e => console.warn("⚠️ plantão:", e.message)), Math.max(3, Number(CFG.INTERVALO_MIN) || 10) * 60000);
        _intervalo.unref?.();
        setTimeout(() => verificarPlantao().catch(() => {}), 60000).unref?.();
    }
}
function iniciarPlantao(sock) { definirSock(sock); }

function gruposAtivos(db) { return Object.entries(db.grupos || {}).filter(([, g]) => g && g.ativo).map(([jid]) => jid); }

async function botEhAdm(sock, jid) {
    try { return await require("../grupo/grupo").isBotAdmin(sock, jid); } catch { return false; }
}

async function textoAlerta(n) {
    const veiculos = new Set([n.fonte, ...n.relacionados.map(r => r.fonte)].filter(Boolean));
    const relatorio = await perguntarIA(
        "Você escreve o relatório de um plantão de notícias. Em português, 2 ou 3 frases curtas, tom sério e neutro, sem opinião política, sem piada. " +
        "Use SOMENTE as informações dos títulos abaixo: não invente nomes, números, causas nem detalhes. " +
        "Se os títulos não explicam algo, não diga. Não use links nem aspas.",
        `Manchete principal: ${n.titulo}\nOutros títulos sobre o mesmo fato:\n${n.relacionados.slice(0, 6).map(r => `- ${r.titulo} (${r.fonte})`).join("\n")}`,
        20000);
    const linhas = [
        "🚨 *PLANTÃO URGENTE*",
        `🕐 ${dataCurta()} · ${horaBR()}`,
        "",
        `📰 *${n.titulo}*`,
        "",
        `🏷️ Fonte: ${n.fonte || "Notícia"} · ${haQuanto(n.data)}`,
    ];
    if (veiculos.size > 1) linhas.push(`📡 Repercutindo em ${veiculos.size} veículos`);
    if (relatorio) linhas.push("", "🧾 *Relatório:*", corta(relatorio.replace(/\s+/g, " "), 420));
    linhas.push("", "👇 Toca nos botões pra ler a reportagem completa");
    return linhas.join("\n");
}

function linksAlerta(n) {
    const lista = [{ rotulo: `📰 ${n.fonte || "Reportagem"}: ${n.titulo}`, url: n.link }];
    const usadas = new Set([n.fonte]);
    for (const r of n.relacionados) {
        if (lista.length >= 5) break;
        if (!r.link || r.link === n.link || usadas.has(r.fonte)) continue;
        usadas.add(r.fonte);
        lista.push({ rotulo: `🗞️ ${r.fonte || "Outro veículo"}: ${r.titulo}`, url: r.link });
    }
    return lista;
}

async function enviarAlerta(sock, jid, n) {
    let mentions = [];
    try { mentions = (await sock.groupMetadata(jid)).participants.map(p => p.id).filter(Boolean); } catch {}
    let card;
    try { card = await cardUrgente(sock, n); } catch (e) { console.error("❌ plantão card:", e.message); card = await fotoDoBot(sock); }
    const texto = n._texto || (n._texto = await textoAlerta(n));
    return enviarComBotoes(sock, jid, { texto, imagem: card, links: linksAlerta(n), tituloLista: "🚨 PLANTÃO · REPORTAGENS", mentions });
}

async function verificarPlantao() {
    const sock = sockAtual;
    if (!sock || _rodando) return;
    const db = ler();
    const grupos = gruposAtivos(db);
    if (!grupos.length) return;
    const h = horaNumBR();
    const ini = Number(CFG.SILENCIO_INICIO), fim = Number(CFG.SILENCIO_FIM);
    const silencio = ini === fim ? false : ini < fim ? (h >= ini && h < fim) : (h >= ini || h < fim);
    if (silencio) return;

    _rodando = true;
    try {
        _cache.delete(CATEGORIAS.brasil.url);
        const itens = await buscar("brasil");
        const vistos = new Set(db.vistos || []);
        const janela = (Number(CFG.JANELA_MIN) || 90) * 60000;
        let escolhida = null;
        for (const n of itens.slice(0, 25)) {
            const chave = norm(n.titulo).slice(0, 80);
            if (vistos.has(n.id) || vistos.has(chave)) continue;
            if (Date.now() - n.data > janela) continue;
            vistos.add(n.id); vistos.add(chave);
            if (await ehUrgente(n)) { escolhida = n; break; }
        }
        db.vistos = [...vistos].slice(-600);
        salvar(db);
        if (!escolhida) return;

        console.log(`🚨 PLANTÃO URGENTE: ${escolhida.titulo}`);
        const hoje = diaBR();
        for (const jid of grupos) {
            const atual = ler();
            const g = atual.grupos?.[jid];
            if (!g?.ativo) continue;
            if (g.dia !== hoje) { g.dia = hoje; g.hoje = 0; }
            if (g.hoje >= (Number(CFG.MAX_ALERTAS_DIA) || 5)) continue;
            if (Date.now() - (g.ultimo || 0) < (Number(CFG.INTERVALO_ALERTA_MIN) || 45) * 60000) continue;
            if (!(await botEhAdm(sock, jid))) continue;
            try {
                await enviarAlerta(sock, jid, escolhida);
                g.ultimo = Date.now(); g.hoje = (g.hoje || 0) + 1;
                atual.grupos[jid] = g; salvar(atual);
            } catch (e) { console.warn("⚠️ plantão envio:", jid, e.message); }
            await new Promise(r => setTimeout(r, 4000));
        }
    } finally { _rodando = false; }
}

// ═════════════════════ 🛡️ $plantao (ADM) ═════════════════════
async function cmdPlantao(sock, msg, args) {
    definirSock(sock);
    const from = msg.key.remoteJid;
    const P = config.PREFIX;
    if (!from.endsWith("@g.us")) return sock.sendMessage(from, { text: "🚨 O plantão urgente é só pra grupo, senpai." }, { quoted: msg });
    const autor = msg.key.participant || msg.key.participantAlt || from;
    let adm = !!msg.key.fromMe;
    if (!adm) { try { adm = await require("../grupo/grupo").isAdmin(sock, from, autor); } catch {} }
    if (!adm) return sock.sendMessage(from, { text: "❌ Só administrador mexe no plantão do grupo." }, { quoted: msg });

    const op = norm((args || [])[0] || "");
    const db = ler(); db.grupos = db.grupos || {};
    const g = db.grupos[from] || {};

    if (["1", "on", "ligar", "ativar"].includes(op)) {
        g.ativo = true; db.grupos[from] = g; salvar(db);
        const botAdm = await botEhAdm(sock, from);
        return sock.sendMessage(from, { text: [
            "🚨 *PLANTÃO URGENTE LIGADO*",
            "",
            "Eu fico de olho nas notícias e, quando sair algo realmente importante, mando aqui marcando todo mundo, com o relatório e os botões das reportagens.",
            "",
            `⏱️ Verifico a cada ${CFG.INTERVALO_MIN} min · no máximo ${CFG.MAX_ALERTAS_DIA} alertas por dia`,
            `🌙 Silêncio das ${CFG.SILENCIO_INICIO}h às ${CFG.SILENCIO_FIM}h`,
            botAdm ? "✅ Sou ADM aqui, tá tudo certo." : "⚠️ Ainda não sou ADM aqui. Me dá ADM, senão eu não mando os alertas.",
            "",
            `🧪 Ver como fica: *${P}plantao teste*  ·  Desligar: *${P}plantao 0*`,
        ].join("\n") }, { quoted: msg });
    }
    if (["0", "off", "desligar", "desativar"].includes(op)) {
        g.ativo = false; db.grupos[from] = g; salvar(db);
        return sock.sendMessage(from, { text: "🔕 *Plantão urgente desligado* neste grupo." }, { quoted: msg });
    }
    if (op === "teste") {
        await sock.sendMessage(from, { text: "🧪 Montando um alerta de teste com a notícia mais quente de agora…" }, { quoted: msg }).catch(() => {});
        const itens = await buscar("brasil");
        const n = itens.sort((a, b) => (b.relacionados.length - a.relacionados.length) || (b.data - a.data))[0];
        if (!n) return sock.sendMessage(from, { text: "📡 As fontes não responderam agora. Tenta daqui a pouco~" }, { quoted: msg });
        // teste: não marca todo mundo
        let card;
        try { card = await cardUrgente(sock, n); } catch (e) { console.error("❌ plantão card:", e.message); card = await fotoDoBot(sock); }
        const texto = (await textoAlerta(n)).replace("🚨 *PLANTÃO URGENTE*", "🧪 *TESTE DO PLANTÃO URGENTE*");
        return enviarComBotoes(sock, from, { texto, imagem: card, links: linksAlerta(n), tituloLista: "🚨 PLANTÃO · REPORTAGENS", quoted: msg });
    }
    const botAdm = await botEhAdm(sock, from);
    return sock.sendMessage(from, { text: [
        "🚨 *PLANTÃO URGENTE*",
        "",
        `📍 Neste grupo: ${g.ativo ? "🟢 *LIGADO*" : "🔴 *DESLIGADO*"}`,
        `🛡️ Sou ADM: ${botAdm ? "sim" : "não (preciso ser pra mandar)"}`,
        g.ultimo ? `🕐 Último alerta: ${dataCurta(new Date(g.ultimo))} · ${horaBR(new Date(g.ultimo))}` : "🕐 Nenhum alerta enviado ainda",
        "",
        `▸ *${P}plantao 1* liga`,
        `▸ *${P}plantao 0* desliga`,
        `▸ *${P}plantao teste* mostra como fica`,
    ].join("\n") }, { quoted: msg });
}

module.exports = { cmdNoticias, cmdPlantao, iniciarPlantao, verificarPlantao, _lerRss: lerRss, _ehUrgente: ehUrgente };
