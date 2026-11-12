// src/gerar-imagem/gerar-imagem.js
// 🎨 .gerarimagem <descrição> — cria uma imagem com IA, grátis e sem chave.
//   1º Pollinations (sem chave; ~1 imagem a cada 15 s por IP)
//   2º Kavel (sem chave; poucas por dia por IP, com marca d'água)
// ✍️ Antes de desenhar, a IA de texto da Nagatoro entende o pedido: separa o que é
//   pra ficar ESCRITO (nome, frase) e monta a cena em inglês, fiel ao que pediram.
//   O texto é escrito por código em cima da imagem (nunca sai letra errada).
//   "meu nome" vira o nome de quem pediu.
// Todo mundo pode usar. Tem filtro de conteúdo e espera entre pedidos.
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const config = require("../../config");

const UA = { "User-Agent": "NagatoroBot/5.0" };
const ESPERA_USUARIO_MS = 45 * 1000;   // cada pessoa: 1 imagem a cada 45 s
const ESPERA_GLOBAL_MS = 16 * 1000;    // o bot todo: 1 imagem a cada 16 s (limite do Pollinations sem chave)
const _ultimoUsuario = new Map();
let _fila = Promise.resolve(), _ultimaGlobal = 0;

// 🚫 filtro: nada adulto, violento pesado, ódio ou com criança em contexto errado
// (palavras inteiras, pra não bloquear coisa inocente tipo "continua", "sexta-feira" ou "bola rolando")
const PROIBIDO = new RegExp("\\b(" + [
    "nu", "nua", "nus", "nuas", "pelad[oa]s?", "sexo", "sexual", "sexy", "porn\\w*", "hentai", "xxx", "nsfw", "erotic\\w*", "erotico", "seios?",
    "bunda", "penis", "vagina", "buceta", "transando", "transar", "orgia", "fetiche", "lingerie", "fio dental", "sem roupa", "pau duro",
    "naked", "nude", "nudes", "boobs?", "breasts?", "dick", "pussy", "cock", "stripper", "strip",
    "estupro", "rape", "gore", "decapitad\\w*", "esquartej\\w*", "tortura\\w*", "suicid\\w*", "enforcad\\w*",
    "nazista", "nazi", "suastica", "kkk", "terrorista", "massacre", "tiroteio"
].join("|") + ")\\b", "i");
const CRIANCA = /\b(crianca|criancas|menin[oa]s? de \d+|infantil|bebes?|child|children|kids?|loli|shota|novinh[oa]s?|\d+ anos)\b/i;
const SENSIVEL = /\b(beij\w*|namor\w*|roupa curta|sem roupa|cama|banho|kiss\w*|bed|sexy|gostos\w*|biquini|bikini)\b/i;

function normal(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function bloqueado(prompt) {
    const t = normal(prompt);
    if (PROIBIDO.test(t)) return true;
    if (CRIANCA.test(t) && SENSIVEL.test(t)) return true;   // criança + qualquer coisa sensível = bloqueia
    return false;
}

async function traduzirIngles(texto) {
    try {
        const r = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(texto)}`, { timeout: 7000 });
        const t = r.data[0].map(x => x[0]).join("").trim();
        return t || texto;
    } catch { return texto; }
}

function ehImagem(b) {
    if (!b || b.length < 2000) return false;
    const jpg = b[0] === 0xff && b[1] === 0xd8, png = b[0] === 0x89 && b[1] === 0x50;
    const webp = b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP";
    return jpg || png || webp;
}

function paraJpg(buffer) {
    // webp → jpg (o WhatsApp manda melhor como jpg)
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return Promise.resolve(buffer);
    return new Promise((resolve) => {
        const base = path.join(os.tmpdir(), `gimg_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        try { fs.writeFileSync(base + ".in", buffer); } catch { return resolve(buffer); }
        const p = spawn("ffmpeg", ["-y", "-i", base + ".in", "-q:v", "3", base + ".jpg"], { stdio: "ignore" });
        const fim = (ok) => { let out = buffer; try { if (ok) out = fs.readFileSync(base + ".jpg"); } catch {} for (const x of [".in", ".jpg"]) { try { fs.unlinkSync(base + x); } catch {} } resolve(out); };
        p.once("error", () => fim(false)); p.once("close", c => fim(c === 0));
        setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, 20000);
    });
}

async function viaPollinations(promptEn) {
    const seed = Math.floor(Math.random() * 1e9);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptEn)}?width=1024&height=1024&model=flux&safe=true&nologo=true&seed=${seed}`;
    const r = await axios.get(url, { responseType: "arraybuffer", timeout: 90000, headers: UA });
    const b = Buffer.from(r.data);
    if (!ehImagem(b)) throw new Error("pollinations não devolveu imagem");
    return b;
}

async function viaKavel(promptEn) {
    const anon = crypto.randomBytes(12).toString("hex");
    const H = { ...UA, "content-type": "application/json", "x-anon-id": anon };
    const r = await axios.post("https://www.kavel.ai/api/ai/generate", {
        provider: "kie", mediaType: "image", model: "kavel-image-v1", scene: "text-to-image",
        prompt: promptEn, options: { aspect_ratio: "1:1" }
    }, { headers: H, timeout: 20000 });
    if (r.data?.code !== 0) throw new Error("kavel recusou: " + (r.data?.message || "?"));
    const txt = JSON.stringify(r.data);
    const taskId = r.data?.data?.taskId || r.data?.data?.task_id || r.data?.data?.id || (txt.match(/"task_?[iI]d"\s*:\s*"([^"]+)"/) || [])[1];
    if (!taskId) throw new Error("kavel sem taskId");
    const inicio = Date.now();
    while (Date.now() - inicio < 90000) {
        await new Promise(res => setTimeout(res, 3000));
        const q = await axios.get(`https://www.kavel.ai/api/ai/anon-query?taskId=${encodeURIComponent(taskId)}&provider=kie&mediaType=image`, { headers: H, timeout: 15000 });
        if (q.data?.code !== 0) throw new Error("kavel: " + (q.data?.message || "erro"));
        const st = String(q.data?.data?.status || "").toLowerCase();
        if (/fail|error|reject/.test(st)) throw new Error("kavel falhou");
        if (st === "success") {
            const s = JSON.stringify(q.data);
            const link = (s.match(/https?:\\?\/\\?\/[^"\s]+?\.(?:webp|png|jpe?g)/i) || [])[0];
            if (!link) throw new Error("kavel sem link");
            const img = await axios.get(link.replace(/\\\//g, "/"), { responseType: "arraybuffer", timeout: 30000, headers: UA });
            const b = Buffer.from(img.data);
            if (!ehImagem(b)) throw new Error("kavel link sem imagem");
            return b;
        }
    }
    throw new Error("kavel demorou demais");
}

// ═════════════ ✍️ ENTENDER O PEDIDO + ESCREVER TEXTO ═════════════
const FONTE = path.join(__dirname, "../midias/assets/fonts/Poppins-Bold.ttf");
let _fonteOk = false;

function ehCriador(msg) {
    try {
        const k = msg.key || {};
        const ids = [k.participant, k.participantAlt, k.participantPn, k.participantLid];
        if (!String(k.remoteJid || "").endsWith("@g.us")) ids.push(k.remoteJid, k.remoteJidAlt, k.senderPn, k.senderLid);
        const { ehDono } = require("../utils-validacao/utils-validacao");
        if (ehDono(ids.filter(Boolean), config.OWNER_NUMBER)) return true;
        const lid = String(config.OWNER_LID || "").replace(/\D/g, "");
        return !!lid && ids.some(i => String(i || "").split("@")[0].split(":")[0] === lid);
    } catch { return false; }
}

// "meu nome" → o nome de verdade de quem pediu
function trocarMeuNome(prompt, msg) {
    const nome = (ehCriador(msg) ? String(config.OWNER_NAME || "") : String(msg.pushName || "")).trim();
    if (!nome) return prompt;
    return prompt.replace(/\bmeu nome\b/gi, `o nome "${nome}"`);
}

function comLimite(promessa, ms) {
    return Promise.race([promessa, new Promise(r => setTimeout(() => r(null), ms))]);
}

async function planejarComIA(pedido) {
    let chamarIA;
    try { ({ chamarIA } = require("../nagatoro-ia/nagatoro-ia")); } catch { return null; }
    const sistema =
        "Você prepara pedidos para um gerador de imagens. Responda SOMENTE um JSON assim: {\"texto\":\"...\",\"prompt\":\"...\"}. " +
        "texto: as palavras exatas que a pessoa quer ESCRITAS na imagem (nome, frase, letreiro), copiadas igualzinho, sem traduzir; " +
        "se ela não pediu nada escrito, use \"\". " +
        "prompt: a cena em INGLÊS, detalhada (assunto, cenário, cores, iluminação, estilo), de 20 a 60 palavras, fiel ao pedido. " +
        "Não invente pessoas, personagens nem objetos que ela não pediu. Nunca coloque o texto escrito dentro do prompt. " +
        "Nada adulto, violento ou de ódio.";
    const r = await comLimite(chamarIA([{ role: "system", content: sistema }, { role: "user", content: pedido }], config.AI_MODEL), 25000);
    const json = String(r || "").match(/\{[\s\S]*\}/);
    if (!json) return null;
    try {
        const d = JSON.parse(json[0]);
        let texto = String(d.texto || "").trim().slice(0, 60);
        const prompt = String(d.prompt || "").trim().slice(0, 600);
        if (!prompt) return null;
        // a IA não pode inventar texto que a pessoa não pediu
        if (texto && !normal(pedido).includes(normal(texto))) texto = "";
        return { texto, prompt };
    } catch { return null; }
}

async function planejar(pedido) {
    const ia = await planejarComIA(pedido).catch(() => null);
    if (ia) return ia;
    // sem IA: o que estiver entre aspas vira o texto escrito
    const m = pedido.match(/["“”]([^"“”]{1,60})["“”]/);
    const texto = m ? m[1].trim() : "";
    let cena = pedido;
    if (m) cena = pedido.replace(m[0], " ").replace(/\b(o nome|nome|escrit[oa]|escrevendo|com o texto|com a frase|frase|texto)\b/gi, " ");
    cena = cena.replace(/\s+/g, " ").trim() || "outer space with stars, planets and nebula";
    return { texto, prompt: await traduzirIngles(cena) };
}

function quebrarLinhas(ctx, texto, largura) {
    const palavras = texto.split(/\s+/).filter(Boolean), linhas = [];
    let atual = "";
    for (const p of palavras) {
        const teste = atual ? atual + " " + p : p;
        if (atual && ctx.measureText(teste).width > largura) { linhas.push(atual); atual = p; }
        else atual = teste;
    }
    if (atual) linhas.push(atual);
    return linhas;
}

function fundoEspaco(ctx, W, H) {
    // fundo próprio (quando as IAs de imagem estão fora do ar)
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#07031a"); g.addColorStop(0.5, "#1a0838"); g.addColorStop(1, "#0a0420");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, c] of [[0.25, 0.3, 0.45, "rgba(155,92,255,0.35)"], [0.75, 0.7, 0.5, "rgba(90,40,200,0.30)"], [0.6, 0.2, 0.3, "rgba(255,90,200,0.18)"]]) {
        const n = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, W * r);
        n.addColorStop(0, c); n.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
    }
    for (let i = 0; i < 350; i++) {
        ctx.globalAlpha = 0.3 + Math.random() * 0.7;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.6 + 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

async function escreverTexto(imgBuf, texto) {
    const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
    if (!_fonteOk) { _fonteOk = true; try { if (fs.existsSync(FONTE)) GlobalFonts.registerFromPath(FONTE, "GI-Bold"); } catch {} }
    const W = 1024, H = 1024;
    const cv = createCanvas(W, H), ctx = cv.getContext("2d");

    let desenhou = false;
    if (imgBuf) {
        try {
            const im = await loadImage(imgBuf);
            const esc = Math.max(W / im.width, H / im.height);
            ctx.drawImage(im, (W - im.width * esc) / 2, (H - im.height * esc) / 2, im.width * esc, im.height * esc);
            desenhou = true;
        } catch (e) { console.warn("⚠️ gerarimagem: não abriu a imagem:", e.message); }
    }
    if (!desenhou) fundoEspaco(ctx, W, H);

    // escurece de leve o meio pra letra aparecer em qualquer fundo
    const v = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.6);
    v.addColorStop(0, "rgba(0,0,0,0.38)"); v.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

    // maior tamanho que cabe (até 3 linhas)
    const largura = W * 0.86;
    let tam = 170, linhas = [];
    for (; tam >= 36; tam -= 6) {
        ctx.font = `${tam}px GI-Bold, sans-serif`;
        linhas = quebrarLinhas(ctx, texto, largura);
        const larga = Math.max(...linhas.map(l => ctx.measureText(l).width));
        if (linhas.length <= 3 && larga <= largura && linhas.length * tam * 1.15 <= H * 0.6) break;
    }
    ctx.font = `${tam}px GI-Bold, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const alt = tam * 1.15, y0 = H / 2 - ((linhas.length - 1) * alt) / 2;

    linhas.forEach((l, i) => {
        const y = y0 + i * alt;
        ctx.lineJoin = "round";
        ctx.shadowColor = "#9b5cff"; ctx.shadowBlur = tam * 0.45;
        ctx.strokeStyle = "rgba(40,0,90,0.95)"; ctx.lineWidth = Math.max(4, tam * 0.09);
        ctx.strokeText(l, W / 2, y);
        const g = ctx.createLinearGradient(0, y - tam / 2, 0, y + tam / 2);
        g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#dcc6ff");
        ctx.fillStyle = g; ctx.fillText(l, W / 2, y);
        ctx.shadowBlur = 0;
    });
    return cv.toBuffer("image/jpeg", 92);
}

const ESPERANDO = [
    "🎨 Pintando aqui... calma que arte não sai no grito, senpai~",
    "🖌️ Tô desenhando. Vai pegar uma água que demora uns segundinhos, hehe~",
    "🎨 Deixa comigo. Melhor que você desenharia, com certeza~",
];
const PRONTO = [
    "🎨 Tá aí sua obra-prima. Pode me agradecer, senpai~",
    "🖼️ Prontinho. Ficou melhor do que a sua ideia, né? Hehe~",
    "✨ Arte entregue. Não precisa aplaudir... mas pode.",
    "🎨 Fiz em segundos o que você não faria em anos. De nada~",
];
const sortear = l => l[Math.floor(Math.random() * l.length)];

async function gerarImagem(sock, msg, args) {
    const from = msg.key.remoteJid;
    const quem = msg.key.participant || msg.key.participantAlt || from;
    let prompt = (args || []).join(" ").trim();
    if (!prompt) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        prompt = (q?.conversation || q?.extendedTextMessage?.text || "").trim();
    }
    if (!prompt) {
        return sock.sendMessage(from, { text: `🎨 Fala o que eu desenho, né?\nEx.: *${config.PREFIX}gerarimagem gato astronauta no espaço, estilo anime*` }, { quoted: msg });
    }
    if (prompt.length > 400) prompt = prompt.slice(0, 400);
    if (bloqueado(prompt)) {
        return sock.sendMessage(from, { text: "🚫 Isso aí eu não desenho nem morta. Pede outra coisa, senpai pervertido(a)~ 😒" }, { quoted: msg });
    }
    const agora = Date.now(), ult = _ultimoUsuario.get(quem) || 0;
    if (agora - ult < ESPERA_USUARIO_MS) {
        const s = Math.ceil((ESPERA_USUARIO_MS - (agora - ult)) / 1000);
        return sock.sendMessage(from, { text: `⏳ Calma, artista ansioso. Espera *${s}s* pra pedir outra imagem~` }, { quoted: msg });
    }
    _ultimoUsuario.set(quem, agora);
    try { await sock.sendMessage(from, { react: { text: "🎨", key: msg.key } }); } catch {}
    await sock.sendMessage(from, { text: sortear(ESPERANDO) }, { quoted: msg }).catch(() => {});

    // fila: um pedido por vez no bot todo (limite das APIs grátis)
    const tarefa = _fila.then(async () => {
        const falta = ESPERA_GLOBAL_MS - (Date.now() - _ultimaGlobal);
        if (falta > 0) await new Promise(r => setTimeout(r, falta));
        _ultimaGlobal = Date.now();
        const plano = await planejar(trocarMeuNome(prompt, msg));
        let texto = bloqueado(plano.texto) ? "" : plano.texto;
        let en = bloqueado(plano.prompt) ? await traduzirIngles(prompt) : plano.prompt;
        if (texto) en += ", wide empty space in the center, no text, no letters, no words, no typography, no watermark";
        let img = null;
        try { img = await viaPollinations(en); } catch (e) { console.warn("⚠️ gerarimagem Pollinations:", e.message); }
        if (!img) { try { img = await viaKavel(en); } catch (e) { console.warn("⚠️ gerarimagem Kavel:", e.message); } }
        if (texto) {
            // escreve o nome/frase por cima (se as IAs caírem, usa um fundo de espaço próprio)
            try { return await escreverTexto(img, texto); } catch (e) { console.warn("⚠️ gerarimagem texto:", e.message); }
        }
        return img ? paraJpg(img) : null;
    });
    _fila = tarefa.catch(() => {});
    const img = await tarefa.catch(() => null);
    if (!img) {
        _ultimoUsuario.delete(quem);
        return sock.sendMessage(from, { text: "😩 Os pincéis da IA tão quebrados agora (servidor grátis lotado). Tenta daqui a pouco~" }, { quoted: msg });
    }
    return sock.sendMessage(from, {
        image: img,
        caption: `${sortear(PRONTO)}\n\n🖌️ _${prompt}_\n🤍 ${config.BOT_NAME}`,
        mentions: [quem]
    }, { quoted: msg });
}

module.exports = { gerarImagem, _bloqueado: bloqueado };
