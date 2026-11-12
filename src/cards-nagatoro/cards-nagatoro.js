/* =================================================
   💜 NAGATORO — CARDS PRONTOS (rápidos)
   📁 Arquivo: cards-nagatoro.js

   Todos os cards já vêm DESENHADOS em src/midias/cards/*.png.
   Na hora de mandar, o bot só:
     1. pega o modelo pronto (fica guardado na memória depois do 1º uso)
     2. encaixa a FOTO DE PERFIL no quadrado — inteira, sem cortar
     3. (level / casal / resumo) escreve o número ou as linhas do dia
   Por isso sai praticamente na hora.

   O card do MENU nem passa por aqui: é a própria imagem do menu.
================================================= */

const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const PASTA_MODELOS = path.join(__dirname, "../midias/cards");
const PASTA_FONTES = path.join(__dirname, "../midias/assets/fonts");

try {
    GlobalFonts.registerFromPath(path.join(PASTA_FONTES, "Poppins-Bold.ttf"), "NagaSans");
    GlobalFonts.registerFromPath(path.join(PASTA_FONTES, "Poppins-Medium.ttf"), "NagaSansM");
} catch {}

const W = 1080, H = 1080;
const COR = {
    fundoSlot: "#120a1f",
    neon: "#9d4dff",
    lilas: "#c9a2ff",
    texto: "#efe6ff",
    apagado: "#8a74b3"
};

// 📐 Onde fica cada coisa nos modelos (o montador usa exatamente isso)
const LAYOUT = {
    slot: { x: 70, y: 262, s: 430 },
    casalA: { x: 70, y: 300, s: 380 },
    casalB: { x: 630, y: 300, s: 380 },
    casalPct: { x: 540, y: 820 },
    nivel: { x: 785, y: 742 },
    resumo: { x: 78, y: 300, w: 560, linha: 46, max: 11 }
};

// ── cache dos modelos ──
const cache = new Map();
async function modelo(nome) {
    if (cache.has(nome)) return cache.get(nome);
    const img = await loadImage(fs.readFileSync(path.join(PASTA_MODELOS, `${nome}.png`)));
    cache.set(nome, img);
    return img;
}

// 🖼️ Foto inteira dentro do quadrado (sem cortar). Se a foto não for
// quadrada, sobra borda escura em volta — nada da foto some.
async function encaixarFoto(ctx, buffer, { x, y, s }) {
    ctx.fillStyle = COR.fundoSlot;
    ctx.fillRect(x, y, s, s);
    let img = null;
    if (buffer && buffer.length) {
        try { img = await loadImage(buffer); } catch { img = null; }
    }
    if (!img) return desenharSemFoto(ctx, { x, y, s });
    const escala = Math.min(s / img.width, s / img.height);
    const w = img.width * escala, h = img.height * escala;
    ctx.drawImage(img, x + (s - w) / 2, y + (s - h) / 2, w, h);
}

function desenharSemFoto(ctx, { x, y, s }) {
    const cx = x + s / 2, cy = y + s / 2;
    ctx.fillStyle = "#2a1747";
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.1, s * 0.17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.27, s * 0.3, s * 0.2, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = COR.lilas;
    ctx.font = `${Math.round(s * 0.055)}px NagaSans`;
    ctx.textAlign = "center";
    ctx.fillText("SEM FOTO? ESCONDIDINHO(A)...", cx, y + s - s * 0.06);
    ctx.textAlign = "left";
}

async function montar(nome, desenhar) {
    const base = await modelo(nome);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0, W, H);
    if (desenhar) await desenhar(ctx);
    return canvas.encode("jpeg", 90);
}

function cortarTexto(ctx, texto, largura) {
    let t = String(texto ?? "");
    if (ctx.measureText(t).width <= largura) return t;
    while (t.length > 1 && ctx.measureText(t + "…").width > largura) t = t.slice(0, -1);
    return t + "…";
}

// ════════════ CARDS ════════════

const comFoto = (nome) => async ({ fotoBuffer, fotoSolicitanteBuffer } = {}) =>
    montar(nome, ctx => encaixarFoto(ctx, fotoBuffer || fotoSolicitanteBuffer, LAYOUT.slot));

const criarCardBoasVindas = comFoto("entrada");
const criarCardDespedida = comFoto("saida");
const criarCardSolicitacao = comFoto("solicitacao");
const criarCardSolicitacaoRecusada = comFoto("recusada");

async function criarCardLevelUp({ fotoBuffer, novoNivel } = {}) {
    return montar("levelup", async ctx => {
        await encaixarFoto(ctx, fotoBuffer, LAYOUT.slot);
        const n = String(novoNivel ?? "?");
        ctx.textAlign = "center";
        ctx.fillStyle = COR.texto;
        ctx.shadowColor = COR.neon; ctx.shadowBlur = 28;
        ctx.font = `${n.length > 3 ? 92 : 128}px NagaSans`;
        ctx.fillText(n, LAYOUT.nivel.x, LAYOUT.nivel.y + 40);
        ctx.shadowBlur = 0; ctx.textAlign = "left";
    });
}

async function criarCardCasal({ fotoBuffer1, fotoBuffer2, porcentagem } = {}) {
    return montar("casal", async ctx => {
        await encaixarFoto(ctx, fotoBuffer1, LAYOUT.casalA);
        await encaixarFoto(ctx, fotoBuffer2, LAYOUT.casalB);
        ctx.textAlign = "center";
        ctx.fillStyle = COR.texto;
        ctx.shadowColor = COR.neon; ctx.shadowBlur = 30;
        ctx.font = "110px NagaSans";
        ctx.fillText(`${Math.max(0, Math.min(100, Number(porcentagem) || 0))}%`, LAYOUT.casalPct.x, LAYOUT.casalPct.y);
        ctx.shadowBlur = 0; ctx.textAlign = "left";
    });
}

async function criarCardResumo({ nomeGrupo, dataTexto, totalMensagens, totalParticipantes, totalMembros, ranking = [], comandosTop = [] } = {}) {
    return montar("resumo", ctx => {
        const { x, y, w, linha, max } = LAYOUT.resumo;
        const linhas = [
            ["t", nomeGrupo || "Grupo"],
            ["d", dataTexto || ""],
            ["k", `${totalMensagens ?? 0} mensagens hoje`],
            ["k", `${totalParticipantes ?? 0} de ${totalMembros ?? "?"} abriram a boca`],
            ["s", "MAIS FALADORES"],
            ...ranking.slice(0, 3).map((r, i) => ["v", `${i + 1}º ${r.nome ?? r[0] ?? "?"} — ${r.total ?? r.quantidade ?? r[1] ?? 0}`]),
            ...(comandosTop.length ? [["s", "COMANDOS DO DIA"]] : []),
            ...comandosTop.slice(0, 2).map(c => ["v", `${c.nome ?? c[0]} — ${c.total ?? c[1] ?? 0}x`])
        ].slice(0, max);
        let yy = y;
        for (const [tipo, texto] of linhas) {
            if (tipo === "t") { ctx.font = "40px NagaSans"; ctx.fillStyle = COR.texto; }
            else if (tipo === "d") { ctx.font = "26px NagaSansM"; ctx.fillStyle = COR.apagado; }
            else if (tipo === "s") { yy += 10; ctx.font = "26px NagaSans"; ctx.fillStyle = COR.neon; }
            else { ctx.font = "30px NagaSansM"; ctx.fillStyle = COR.texto; }
            ctx.fillText(cortarTexto(ctx, texto, w), x, yy);
            yy += linha;
        }
    });
}

// Card de mídias: totalmente pronto, sem nada dinâmico.
async function criarCardMenuMidias() {
    return fs.readFileSync(path.join(PASTA_MODELOS, "midias.png"));
}


// ════════════ 🎵 CARD DO PLAY (banner pequeno 2:1) ════════════
// Esquerda: capa/foto do cantor GRANDE, com moldura neon igual entrada/saída.
// Meio: "TOCANDO AGORA", título, canal e a barrinha de play com os tempos.
// Direita: a Nagatoro (recorte da arte oficial do menu), sumindo no fundo.
const PW = 1200, PH = 600;
let _nagaPlay = null;
async function imagemNagatoroPlay() {
    if (_nagaPlay) return _nagaPlay;
    _nagaPlay = await loadImage(fs.readFileSync(path.join(PASTA_MODELOS, "play-nagatoro.jpg")));
    return _nagaPlay;
}

function quebrarLinhas(ctx, texto, largura, maxLinhas) {
    const palavras = String(texto || "").split(/\s+/).filter(Boolean);
    const linhas = []; let atual = "";
    for (const p of palavras) {
        const teste = atual ? atual + " " + p : p;
        if (ctx.measureText(teste).width <= largura) { atual = teste; continue; }
        if (atual) linhas.push(atual);
        atual = p;
        if (linhas.length === maxLinhas) break;
    }
    if (linhas.length < maxLinhas && atual) linhas.push(atual);
    if (linhas.length > maxLinhas) linhas.length = maxLinhas;
    const usadas = linhas.join(" ").split(/\s+/).length;
    if (usadas < palavras.length && linhas.length) linhas[linhas.length - 1] = cortarTexto(ctx, linhas[linhas.length - 1] + "…", largura);
    return linhas.map(l => cortarTexto(ctx, l, largura));
}

function cantos(ctx, x, y, w, h, t = 34) {
    ctx.strokeStyle = COR.lilas; ctx.lineWidth = 5;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(cx + dx * t, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * t); ctx.stroke();
    }
}

// ════════════ 🎵 CARD DO PLAY (mais baixinho: 1200×450) ════════════
// • capa da música inteira em 16:9 (sem cortar quem está de lado) e sem as faixas pretas
// • fundo com a própria capa desfocada + Nagatoro à direita
// • título, artista, canal, quem pediu e a barrinha de play

// acha onde começa/termina a imagem de verdade (tira as faixas pretas de cima/baixo e dos lados)
function semFaixasPretas(img) {
    const w = 96, h = Math.max(8, Math.round(96 * img.height / img.width));
    const c = createCanvas(w, h), g = c.getContext("2d");
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const lum = (x, y) => { const i = (y * w + x) * 4; return d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; };
    const linhaEscura = y => { let s = 0; for (let x = 0; x < w; x++) s += lum(x, y); return s / w < 14; };
    const colunaEscura = x => { let s = 0; for (let y = 0; y < h; y++) s += lum(x, y); return s / h < 14; };
    let t = 0, bt = h - 1, l = 0, r = w - 1;
    while (t < h * .3 && linhaEscura(t)) t++;
    while (bt > h * .7 && linhaEscura(bt)) bt--;
    while (l < w * .3 && colunaEscura(l)) l++;
    while (r > w * .7 && colunaEscura(r)) r--;
    const k = img.width / w;
    return { sx: l * k, sy: t * (img.height / h), sw: (r - l + 1) * k, sh: (bt - t + 1) * (img.height / h) };
}

async function criarCardPlay({ capaBuffer, titulo, artista, canal, pedidoPor, duracao } = {}) {
    // 2 quadrados lado a lado: ⬛ capa da música (com o player) | ⬛ Nagatoro (com as infos)
    const Q = 500, W2 = Q * 2, H2 = Q;
    const canvas = createCanvas(W2, H2);
    const ctx = canvas.getContext("2d");
    const limpo = t => String(t || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/[^\p{L}\p{N}\p{P}\p{Zs}+&$%#=]/gu, "").replace(/\s+/g, " ").trim();
    ctx.fillStyle = "#0b0614"; ctx.fillRect(0, 0, W2, H2);

    // ═══ ⬛ ESQUERDA: capa da música ═══
    let capa = null, rc = null;
    if (capaBuffer && capaBuffer.length) { try { capa = await loadImage(capaBuffer); rc = semFaixasPretas(capa); } catch { capa = null; } }
    if (capa) {
        // fundo do quadrado: a capa desfocada (preenche as sobras)
        try {
            ctx.save(); ctx.beginPath(); ctx.rect(0, 0, Q, Q); ctx.clip();
            ctx.filter = "blur(26px) saturate(1.3)";
            const e = Math.max(Q / rc.sw, Q / rc.sh) * 1.1;
            ctx.drawImage(capa, rc.sx, rc.sy, rc.sw, rc.sh, (Q - rc.sw * e) / 2, (Q - rc.sh * e) / 2, rc.sw * e, rc.sh * e);
            ctx.restore(); ctx.filter = "none";
        } catch { ctx.filter = "none"; }
        ctx.fillStyle = "rgba(8,3,20,0.35)"; ctx.fillRect(0, 0, Q, Q);
        // a foto inteira, sem cortar ninguém (encaixada no quadrado)
        const area = Q - 60, e = Math.min(area / rc.sw, (area - 70) / rc.sh);
        const w = rc.sw * e, h = rc.sh * e, x = (Q - w) / 2, y = 30 + (area - 70 - h) / 2;
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.7)"; ctx.shadowBlur = 24;
        ctx.drawImage(capa, rc.sx, rc.sy, rc.sw, rc.sh, x, y, w, h); ctx.restore();
        ctx.strokeStyle = COR.neon; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
    } else {
        const g = ctx.createLinearGradient(0, 0, Q, Q); g.addColorStop(0, "#2a0d55"); g.addColorStop(1, "#0b0614");
        ctx.fillStyle = g; ctx.fillRect(0, 0, Q, Q);
        ctx.fillStyle = COR.neon;
        ctx.beginPath(); ctx.ellipse(Q / 2 - 25, 230, 40, 30, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(Q / 2 + 8, 100, 14, 135); ctx.fillRect(Q / 2 + 8, 100, 70, 20);
    }
    cantos(ctx, 14, 14, Q - 28, Q - 28);

    // ▶️ player embaixo da capa: barrinha fina + botões pequenos
    const pg = ctx.createLinearGradient(0, Q - 120, 0, Q);
    pg.addColorStop(0, "rgba(8,3,20,0)"); pg.addColorStop(1, "rgba(8,3,20,0.9)");
    ctx.fillStyle = pg; ctx.fillRect(0, Q - 120, Q, 120);
    const bx = 40, bw = Q - 80, by = Q - 78, prog = 0.32;
    ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(bx, by - 2, bw, 4);
    const gb = ctx.createLinearGradient(bx, 0, bx + bw * prog, 0); gb.addColorStop(0, "#7b2cff"); gb.addColorStop(1, COR.lilas);
    ctx.fillStyle = gb; ctx.fillRect(bx, by - 2, bw * prog, 4);
    ctx.save(); ctx.shadowColor = COR.neon; ctx.shadowBlur = 12; ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(bx + bw * prog, by, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#d9c9f5"; ctx.font = "14px NagaSansM";
    ctx.fillText("0:00", bx, by + 22);
    ctx.textAlign = "right"; ctx.fillText(duracao && duracao !== "—" ? duracao : "--:--", bx + bw, by + 22); ctx.textAlign = "left";
    const my = Q - 36, mx = Q / 2;
    const tri = (x, yy, s2, dir = 1) => { ctx.beginPath(); ctx.moveTo(x, yy - s2); ctx.lineTo(x + dir * s2 * 1.5, yy); ctx.lineTo(x, yy + s2); ctx.closePath(); ctx.fill(); };
    ctx.fillStyle = "#ffffff";
    tri(mx - 50, my, 8, -1); ctx.fillRect(mx - 67, my - 8, 3, 16);
    ctx.save(); ctx.shadowColor = COR.neon; ctx.shadowBlur = 14; ctx.fillStyle = COR.neon;
    ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = "#ffffff"; tri(mx - 5, my, 8, 1);
    tri(mx + 50, my, 8, 1); ctx.fillRect(mx + 64, my - 8, 3, 16);

    // ═══ ⬛ DIREITA: Nagatoro ═══
    try {
        const naga = await imagemNagatoroPlay();
        const e = Math.max(Q / naga.width, Q / naga.height);
        const w = naga.width * e, h = naga.height * e;
        ctx.save(); ctx.beginPath(); ctx.rect(Q, 0, Q, Q); ctx.clip();
        // sobe a foto: olhos e boca ficam acima das infos
        const subir = Math.min(h - Q, Math.round(h * 0.23));
        ctx.drawImage(naga, Q + (Q - w) / 2, -subir, w, h);
        ctx.restore();
    } catch {}
    // escurece embaixo pra ler as infos
    const ig = ctx.createLinearGradient(0, Q * 0.38, 0, Q);
    ig.addColorStop(0, "rgba(10,4,22,0)"); ig.addColorStop(0.45, "rgba(10,4,22,0.82)"); ig.addColorStop(1, "rgba(10,4,22,0.96)");
    ctx.fillStyle = ig; ctx.fillRect(Q, Q * 0.38, Q, Q * 0.62);

    const tx = Q + 30, larg = Q - 60;
    let y = 292;
    ctx.fillStyle = COR.neon;
    ctx.beginPath(); ctx.moveTo(tx, y - 12); ctx.lineTo(tx + 11, y - 6); ctx.lineTo(tx, y); ctx.closePath(); ctx.fill();
    ctx.font = "15px NagaSans"; ctx.fillText("TOCANDO AGORA", tx + 18, y);
    y += 36;
    ctx.fillStyle = COR.texto; ctx.font = "29px NagaSans";
    const linhas = quebrarLinhas(ctx, limpo(titulo) || "Sem título", larg, 2);
    linhas.forEach((l, i) => ctx.fillText(l, tx, y + i * 34));
    y += (linhas.length - 1) * 34 + 30;
    ctx.fillStyle = COR.lilas; ctx.font = "19px NagaSansM";
    ctx.fillText(cortarTexto(ctx, limpo(artista) || limpo(canal) || "—", larg), tx, y);
    const etiqueta = (rotulo, valor, yy) => {
        ctx.font = "12px NagaSans"; const rw = ctx.measureText(rotulo).width + 14;
        ctx.fillStyle = "rgba(157,77,255,0.35)"; ctx.fillRect(tx, yy - 14, rw, 20);
        ctx.fillStyle = "#efe4ff"; ctx.fillText(rotulo, tx + 7, yy);
        ctx.fillStyle = COR.texto; ctx.font = "15px NagaSansM";
        ctx.fillText(cortarTexto(ctx, valor, larg - rw - 10), tx + rw + 8, yy + 1);
    };
    y += 32;
    if (limpo(canal)) { etiqueta("CANAL", limpo(canal), y); y += 28; }
    if (limpo(pedidoPor)) etiqueta("PEDIDO POR", limpo(pedidoPor), y);
    ctx.fillStyle = COR.apagado; ctx.font = "12px NagaSansM"; ctx.textAlign = "right";
    ctx.fillText("NAGATORO • PLAY", W2 - 22, 30); ctx.textAlign = "left";

    // divisória + moldura
    ctx.fillStyle = "rgba(157,77,255,0.6)"; ctx.fillRect(Q - 1, 0, 2, Q);
    ctx.strokeStyle = "rgba(157,77,255,0.6)"; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, W2 - 3, H2 - 3);
    return canvas.encode("jpeg", 88);
}

// ════════════ 📰 CARDS DO "MAIS NO JORNAL" (mesmo banner 2:1 do play) ════════════
// Convite: foto do grupo grande à esquerda + nome, membros e o link.
// Últimas saídas: foto do grupo + lista de quem fugiu / foi chutado.
const limparCard = t => String(t || "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "").replace(/[^\p{L}\p{N}\p{P}\p{Zs}+&$%#=]/gu, "").replace(/\s+/g, " ").trim();

async function baseJornal(ctx) {
    const fundo = ctx.createLinearGradient(0, 0, PW, PH);
    fundo.addColorStop(0, "#0b0614"); fundo.addColorStop(1, "#1a0c2e");
    ctx.fillStyle = fundo; ctx.fillRect(0, 0, PW, PH);
    ctx.strokeStyle = "rgba(157,77,255,0.07)"; ctx.lineWidth = 1;
    for (let x = 0; x < PW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PH); ctx.stroke(); }
    for (let y = 0; y < PH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); }
    try {
        const naga = await imagemNagatoroPlay();
        const h = PH, w = naga.width * (h / naga.height), x = PW - w + 30;
        ctx.drawImage(naga, x, 0, w, h);
        const fade = ctx.createLinearGradient(x, 0, x + w * 0.55, 0);
        fade.addColorStop(0, "rgba(14,8,25,1)"); fade.addColorStop(1, "rgba(14,8,25,0)");
        ctx.fillStyle = fade; ctx.fillRect(x - 2, 0, w * 0.55 + 2, h);
        const baixo = ctx.createLinearGradient(0, PH - 120, 0, PH);
        baixo.addColorStop(0, "rgba(14,8,25,0)"); baixo.addColorStop(1, "rgba(14,8,25,0.85)");
        ctx.fillStyle = baixo; ctx.fillRect(x, PH - 120, w, 120);
    } catch {}
}

async function fotoJornal(ctx, buffer, nomeGrupo) {
    const S = 430, cx = 50, cy = 60;
    ctx.save(); ctx.shadowColor = COR.neon; ctx.shadowBlur = 28;
    ctx.fillStyle = COR.fundoSlot; ctx.fillRect(cx, cy, S, S); ctx.restore();
    let img = null;
    if (buffer && buffer.length) { try { img = await loadImage(buffer); } catch { img = null; } }
    if (img) {
        const esc = Math.max(S / img.width, S / img.height), w = img.width * esc, h = img.height * esc;
        ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, S, S); ctx.clip();
        ctx.drawImage(img, cx + (S - w) / 2, cy + (S - h) / 2, w, h); ctx.restore();
    } else {
        // sem foto do grupo: inicial do nome grandona
        ctx.fillStyle = COR.neon; ctx.font = "200px NagaSans"; ctx.textAlign = "center";
        ctx.fillText((limparCard(nomeGrupo)[0] || "N").toUpperCase(), cx + S / 2, cy + S / 2 + 70); ctx.textAlign = "left";
    }
    ctx.strokeStyle = COR.neon; ctx.lineWidth = 4; ctx.strokeRect(cx, cy, S, S);
    cantos(ctx, cx - 12, cy - 12, S + 24, S + 24);
}

function cabecalhoJornal(ctx, titulo, sub) {
    const tx = 520;
    ctx.fillStyle = COR.neon; ctx.beginPath(); ctx.arc(tx + 8, 102, 8, 0, Math.PI * 2); ctx.fill();
    ctx.font = "22px NagaSans"; ctx.fillText(titulo, tx + 26, 110);
    ctx.fillStyle = COR.apagado; ctx.font = "18px NagaSansM"; ctx.fillText(sub, tx, 140);
}

function pilula(ctx, x, y, w, h, preenchida) {
    const r = h / 2;
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (preenchida) { ctx.save(); ctx.shadowColor = COR.neon; ctx.shadowBlur = 20; ctx.fillStyle = COR.neon; ctx.fill(); ctx.restore(); }
    else { ctx.fillStyle = "rgba(18,10,31,0.85)"; ctx.fill(); ctx.strokeStyle = COR.neon; ctx.lineWidth = 2; ctx.stroke(); }
}

async function criarCardConvite({ fotoGrupoBuffer, nomeGrupo, membros, link } = {}) {
    const canvas = createCanvas(PW, PH); const ctx = canvas.getContext("2d");
    await baseJornal(ctx);
    await fotoJornal(ctx, fotoGrupoBuffer, nomeGrupo);
    cabecalhoJornal(ctx, "CONVITE DO GRUPO", "NAGATORO • JORNAL");
    const tx = 520, larg = 380;
    ctx.fillStyle = COR.texto; ctx.font = "40px NagaSans";
    const linhas = quebrarLinhas(ctx, limparCard(nomeGrupo) || "Grupo", larg, 2);
    linhas.forEach((l, i) => ctx.fillText(l, tx, 205 + i * 50));
    let y = 215 + linhas.length * 50;
    ctx.fillStyle = COR.lilas; ctx.font = "26px NagaSansM";
    ctx.fillText(`${membros || 0} membros`, tx, y);
    // caixinha do link
    y += 40;
    pilula(ctx, tx, y, 400, 56, false);
    ctx.fillStyle = COR.texto; ctx.font = "20px NagaSansM";
    const curto = String(link || "chat.whatsapp.com").replace(/^https?:\/\//, "");
    ctx.fillText(cortarTexto(ctx, curto, 360), tx + 22, y + 36);
    // "botão" copiar
    y += 80;
    pilula(ctx, tx, y, 260, 56, true);
    ctx.fillStyle = "#ffffff"; ctx.font = "22px NagaSans"; ctx.textAlign = "center";
    ctx.fillText("COPIAR LINK", tx + 130, y + 37); ctx.textAlign = "left";
    ctx.fillStyle = COR.apagado; ctx.font = "18px NagaSansM";
    ctx.fillText("Chama a galera. Só gente que presta, hein~", 50, 548);
    ctx.strokeStyle = "rgba(157,77,255,0.55)"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, PW - 16, PH - 16);
    return canvas.encode("jpeg", 88);
}

// lista: [{ nome, removido, quando }]
async function criarCardSaidas({ fotoGrupoBuffer, nomeGrupo, lista = [] } = {}) {
    const canvas = createCanvas(PW, PH); const ctx = canvas.getContext("2d");
    await baseJornal(ctx);
    await fotoJornal(ctx, fotoGrupoBuffer, nomeGrupo);
    cabecalhoJornal(ctx, "ÚLTIMAS SAÍDAS", "NAGATORO • JORNAL");
    const tx = 520, larg = 400;
    ctx.fillStyle = COR.texto; ctx.font = "34px NagaSans";
    ctx.fillText(cortarTexto(ctx, limparCard(nomeGrupo) || "Grupo", larg), tx, 195);
    const itens = lista.slice(0, 5);
    if (!itens.length) {
        ctx.fillStyle = COR.lilas; ctx.font = "26px NagaSansM";
        ctx.fillText("Ninguém fugiu ainda.", tx, 270);
        ctx.fillStyle = COR.apagado; ctx.font = "20px NagaSansM";
        ctx.fillText("Milagre. Ou ninguém teve coragem~", tx, 305);
    }
    itens.forEach((it, i) => {
        const y = 235 + i * 62;
        ctx.fillStyle = "rgba(18,10,31,0.8)"; ctx.fillRect(tx, y, larg, 52);
        ctx.fillStyle = it.removido ? "#ff4d7d" : COR.neon; ctx.fillRect(tx, y, 6, 52);
        ctx.fillStyle = COR.texto; ctx.font = "21px NagaSans";
        ctx.fillText(cortarTexto(ctx, `${i + 1}. ${limparCard(it.nome)}`, 235), tx + 18, y + 33);
        ctx.fillStyle = it.removido ? "#ff8fab" : COR.lilas; ctx.font = "17px NagaSansM"; ctx.textAlign = "right";
        ctx.fillText(`${it.removido ? "chutado" : "fugiu"} • ${limparCard(it.quando)}`, tx + larg - 14, y + 32); ctx.textAlign = "left";
    });
    ctx.fillStyle = COR.apagado; ctx.font = "18px NagaSansM";
    ctx.fillText("Quem sai, sai. Eu só anoto~", 50, 548);
    ctx.strokeStyle = "rgba(157,77,255,0.55)"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, PW - 16, PH - 16);
    return canvas.encode("jpeg", 88);
}

// lista: [{ nome, nivel, xp }] — TOP 5 do grupo
async function criarCardRankJornal({ fotoGrupoBuffer, nomeGrupo, lista = [], titulo, subtitulo } = {}) {
    const canvas = createCanvas(PW, PH); const ctx = canvas.getContext("2d");
    await baseJornal(ctx);
    await fotoJornal(ctx, fotoGrupoBuffer, nomeGrupo);
    cabecalhoJornal(ctx, titulo || "RANKING DO GRUPO", subtitulo || "NAGATORO • JORNAL");
    const tx = 520, larg = 400, MED = ["#f5c542", "#c9d1db", "#d98b4a"];
    ctx.fillStyle = COR.texto; ctx.font = "34px NagaSans";
    ctx.fillText(cortarTexto(ctx, limparCard(nomeGrupo) || "Grupo", larg), tx, 195);
    const itens = lista.slice(0, 5);
    if (!itens.length) {
        ctx.fillStyle = COR.lilas; ctx.font = "26px NagaSansM";
        ctx.fillText("Ninguém pontuou ainda.", tx, 270);
    }
    itens.forEach((it, i) => {
        const y = 235 + i * 62;
        ctx.fillStyle = "rgba(18,10,31,0.8)"; ctx.fillRect(tx, y, larg, 52);
        ctx.fillStyle = MED[i] || COR.neon; ctx.fillRect(tx, y, 6, 52);
        ctx.beginPath(); ctx.arc(tx + 34, y + 26, 16, 0, Math.PI * 2); ctx.fillStyle = MED[i] || "rgba(157,77,255,0.8)"; ctx.fill();
        ctx.fillStyle = i < 3 ? "#1a1326" : "#ffffff"; ctx.font = "18px NagaSans"; ctx.textAlign = "center";
        ctx.fillText(String(i + 1), tx + 34, y + 33); ctx.textAlign = "left";
        ctx.fillStyle = COR.texto; ctx.font = "21px NagaSans";
        ctx.fillText(cortarTexto(ctx, limparCard(it.nome) || "Sem nome", 195), tx + 62, y + 33);
        ctx.fillStyle = COR.lilas; ctx.font = "18px NagaSansM"; ctx.textAlign = "right";
        ctx.fillText(it.direita || `NV ${it.nivel || 1} • ${Number(it.xp || 0).toLocaleString("pt-BR")} xp`, tx + larg - 14, y + 32); ctx.textAlign = "left";
    });
    ctx.fillStyle = COR.apagado; ctx.font = "18px NagaSansM";
    ctx.fillText("Quem fala mais, manda mais. Os outros? Enfeite~", 50, 548);
    ctx.strokeStyle = "rgba(157,77,255,0.55)"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, PW - 16, PH - 16);
    return canvas.encode("jpeg", 88);
}

// ════════════ 🔮 NAGATORO ESPAÇO CRUSH ════════════
const CORES_GEMA = [["#fff27a", "#f5a300", "#ffcf3d"], ["#9be7ff", "#1667ff", "#3aa0ff"], ["#ff9aa8", "#d1002b", "#ff3355"],
    ["#b8ff9a", "#14a83a", "#35e05a"], ["#f2a8ff", "#9a1fd6", "#c94dff"], ["#ffd0a0", "#ff6a12", "#ff8a2a"]];
function formaGemaCard(g, t, h) {
    g.beginPath();
    if (t === 0) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? h * .45 : h * .95; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
    else if (t === 1) { g.moveTo(-h * .92, -h * .22); g.lineTo(-h * .5, -h * .72); g.lineTo(h * .5, -h * .72); g.lineTo(h * .92, -h * .22); g.lineTo(0, h * .9); g.closePath(); }
    else if (t === 2) { g.moveTo(0, h * .88); g.bezierCurveTo(-h * 1.25, 0, -h * .75, -h * 1.05, 0, -h * .42); g.bezierCurveTo(h * .75, -h * 1.05, h * 1.25, 0, 0, h * .88); g.closePath(); }
    else if (t === 3) { g.moveTo(0, -h * .9); g.lineTo(h * .92, h * .75); g.lineTo(-h * .92, h * .75); g.closePath(); }
    else if (t === 4) { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; g.moveTo(Math.cos(a) * h * .48 + h * .42, Math.sin(a) * h * .48); g.arc(Math.cos(a) * h * .48, Math.sin(a) * h * .48, h * .42, 0, 7); } g.moveTo(h * .5, 0); g.arc(0, 0, h * .5, 0, 7); }
    else g.arc(0, 0, h * .72, 0, 7);
}
function gemaCard(ctx, t, x, y, S) {
    const [a, b, e] = CORES_GEMA[t], h = S / 2;
    ctx.save(); ctx.translate(x, y);
    ctx.shadowColor = e; ctx.shadowBlur = S * .3;
    formaGemaCard(ctx, t, h);
    const rg = ctx.createRadialGradient(-S * .15, -S * .2, S * .05, 0, 0, S * .6); rg.addColorStop(0, a); rg.addColorStop(.55, e); rg.addColorStop(1, b);
    ctx.fillStyle = rg; ctx.fill(); ctx.shadowBlur = 0;
    if (t === 5) { ctx.save(); ctx.rotate(-.4); ctx.strokeStyle = "rgba(255,240,210,.95)"; ctx.lineWidth = S * .07; ctx.beginPath(); ctx.ellipse(0, 0, S * .55, S * .17, 0, 0, Math.PI); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-S * .1, -S * .22, S * .2, S * .09, -.3, 0, 7); ctx.fill();
    ctx.restore();
}
function fundoEspaco(ctx) {
    const f = ctx.createLinearGradient(0, 0, 0, PH); f.addColorStop(0, "#0a0322"); f.addColorStop(1, "#05020f");
    ctx.fillStyle = f; ctx.fillRect(0, 0, PW, PH);
    const neb = (x, y, r, c) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH); };
    neb(950, 150, 600, "rgba(150,40,220,.38)"); neb(150, 520, 600, "rgba(60,30,200,.35)"); neb(600, 600, 400, "rgba(255,60,180,.2)");
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(255,255,255,${.3 + rnd() * .7})`; const r = rnd() * 1.8 + .3; ctx.fillRect(rnd() * PW, rnd() * PH, r, r); }
    // Sol + planetas
    const sol = ctx.createRadialGradient(-40, -40, 0, -40, -40, 220); sol.addColorStop(0, "#fff6c8"); sol.addColorStop(.45, "#ffc23d"); sol.addColorStop(1, "rgba(255,106,0,0)");
    ctx.fillStyle = sol; ctx.fillRect(0, 0, 400, 400);
    ctx.strokeStyle = "rgba(190,150,255,.16)"; ctx.lineWidth = 1.5;
    for (const r of [260, 380, 520, 700]) { ctx.beginPath(); ctx.ellipse(-40, -40, r, r * .78, .25, 0, 7); ctx.stroke(); }
    const planeta = (x, y, r, c1, c2, anel) => {
        if (anel) { ctx.save(); ctx.translate(x, y); ctx.rotate(-.35); ctx.strokeStyle = "rgba(240,220,170,.8)"; ctx.lineWidth = r * .3; ctx.beginPath(); ctx.ellipse(0, 0, r * 2.1, r * .6, 0, 0, 7); ctx.stroke(); ctx.restore(); }
        const g = ctx.createRadialGradient(x - r * .4, y - r * .4, r * .1, x, y, r); g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    };
    planeta(700, 150, 16, "#8fd3ff", "#1f5fb5"); planeta(660, 300, 11, "#ff9f7a", "#b0381e");
    planeta(770, 70, 30, "#f3d3a6", "#b5733f"); planeta(740, 500, 22, "#f7e2a6", "#c79a4a", true);
}
async function nagatoroDireita(ctx) {
    try {
        const naga = await imagemNagatoroPlay();
        const h = PH, w = naga.width * (h / naga.height), x = PW - w + 30;
        ctx.drawImage(naga, x, 0, w, h);
        const fade = ctx.createLinearGradient(x, 0, x + w * 0.55, 0);
        fade.addColorStop(0, "rgba(8,3,26,1)"); fade.addColorStop(1, "rgba(8,3,26,0)");
        ctx.fillStyle = fade; ctx.fillRect(x - 2, 0, w * 0.55 + 2, h);
    } catch {}
}
function logoCrush(ctx, x, y, tam = 1) {
    ctx.save(); ctx.textAlign = "left";
    ctx.font = `${Math.round(78 * tam)}px NagaSans`;
    const g = ctx.createLinearGradient(0, y - 70 * tam, 0, y); g.addColorStop(0, "#ffffff"); g.addColorStop(.5, "#b9b0e0"); g.addColorStop(1, "#ffffff");
    ctx.lineWidth = 8 * tam; ctx.strokeStyle = "#2a0d55"; ctx.strokeText("NAGATORO", x, y);
    ctx.shadowColor = "#b14dff"; ctx.shadowBlur = 24; ctx.fillStyle = g; ctx.fillText("NAGATORO", x, y); ctx.shadowBlur = 0;
    ctx.font = `${Math.round(44 * tam)}px NagaSans`;
    ctx.lineWidth = 6 * tam; ctx.strokeText("ESPAÇO", x, y + 58 * tam); ctx.fillStyle = "#ffffff"; ctx.fillText("ESPAÇO", x, y + 58 * tam);
    const w = ctx.measureText("ESPAÇO ").width;
    ctx.font = `${Math.round(60 * tam)}px NagaSans`;
    const r = ctx.createLinearGradient(0, y + 10 * tam, 0, y + 62 * tam); r.addColorStop(0, "#ffd0f4"); r.addColorStop(.6, "#ff4fd1"); r.addColorStop(1, "#c4148f");
    ctx.strokeText("CRUSH", x + w, y + 60 * tam); ctx.shadowColor = "#ff4fd1"; ctx.shadowBlur = 22; ctx.fillStyle = r; ctx.fillText("CRUSH", x + w, y + 60 * tam);
    ctx.restore();
}

async function criarCardCrush() {
    const canvas = createCanvas(PW, PH); const ctx = canvas.getContext("2d");
    fundoEspaco(ctx);
    await nagatoroDireita(ctx);
    // tabuleiro de gemas
    const bx = 60, by = 215, cel = 66, n = 5;
    ctx.save(); ctx.shadowColor = COR.neon; ctx.shadowBlur = 30;
    ctx.fillStyle = "rgba(30,10,70,.88)"; ctx.fillRect(bx - 14, by - 14, cel * 8 + 28, cel * n + 28); ctx.restore();
    ctx.strokeStyle = "#b678ff"; ctx.lineWidth = 3; ctx.strokeRect(bx - 14, by - 14, cel * 8 + 28, cel * n + 28);
    const pad = [[0, 1, 2, 3, 0, 1, 4, 5], [4, 2, 1, 0, 5, 3, 2, 1], [3, 0, 5, 4, 2, 0, 1, 3], [1, 4, 2, 5, 3, 4, 0, 2], [5, 3, 0, 1, 4, 2, 5, 0]];
    for (let r = 0; r < n; r++) for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 ? "rgba(120,70,220,.22)" : "rgba(70,30,150,.28)"; ctx.fillRect(bx + c * cel + 2, by + r * cel + 2, cel - 4, cel - 4);
        gemaCard(ctx, pad[r][c], bx + c * cel + cel / 2, by + r * cel + cel / 2, cel * .78);
    }
    logoCrush(ctx, 60, 110);
    ctx.fillStyle = COR.lilas; ctx.font = "22px NagaSansM";
    ctx.fillText("Combine gemas no Sistema Solar • solo ou duelo", 60, 572);
    ctx.strokeStyle = "rgba(157,77,255,0.55)"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, PW - 16, PH - 16);
    return canvas.encode("jpeg", 88);
}

// ⚔️ placar do duelo: A x B
async function criarCardDueloCrush({ nomeA, pontosA, nomeB, pontosB, vencedor } = {}) {
    const canvas = createCanvas(PW, PH); const ctx = canvas.getContext("2d");
    fundoEspaco(ctx);
    await nagatoroDireita(ctx);
    logoCrush(ctx, 60, 95, .7);
    ctx.fillStyle = COR.neon; ctx.beginPath(); ctx.arc(68, 182, 8, 0, Math.PI * 2); ctx.fill();
    ctx.font = "24px NagaSans"; ctx.fillText("RESULTADO DO DUELO", 86, 190);
    const caixa = (y, nome, pts, ganhou) => {
        ctx.save(); ctx.shadowColor = ganhou ? "#ffcf3d" : COR.neon; ctx.shadowBlur = ganhou ? 30 : 14;
        ctx.fillStyle = ganhou ? "rgba(70,40,10,.9)" : "rgba(25,10,55,.9)"; ctx.fillRect(60, y, 620, 120); ctx.restore();
        ctx.strokeStyle = ganhou ? "#ffcf3d" : "#7a4bd1"; ctx.lineWidth = 3; ctx.strokeRect(60, y, 620, 120);
        ctx.fillStyle = ganhou ? "#ffe36b" : COR.apagado; ctx.font = "22px NagaSans";
        ctx.fillText(ganhou ? "VENCEDOR(A)" : (vencedor ? "PERDEU" : "EMPATE"), 86, y + 38);
        ctx.fillStyle = COR.texto; ctx.font = "34px NagaSans";
        ctx.fillText(cortarTexto(ctx, limparCard(nome) || "Jogador", 360), 86, y + 88);
        ctx.textAlign = "right"; ctx.font = "44px NagaSans"; ctx.fillStyle = ganhou ? "#ffe36b" : "#ffffff";
        ctx.fillText(pts == null ? "W.O." : Number(pts).toLocaleString("pt-BR"), 655, y + 84); ctx.textAlign = "left";
    };
    caixa(220, nomeA, pontosA, vencedor === "A");
    caixa(390, nomeB, pontosB, vencedor === "B");
    ctx.save(); ctx.font = "46px NagaSans"; ctx.fillStyle = "#ff4fd1"; ctx.shadowColor = "#ff4fd1"; ctx.shadowBlur = 20; ctx.textAlign = "center";
    ctx.fillText("VS", 370, 375); ctx.restore();
    ctx.fillStyle = COR.apagado; ctx.font = "18px NagaSansM"; ctx.fillText("Quem perdeu? Vai treinar, hehe~", 60, 560);
    ctx.strokeStyle = "rgba(157,77,255,0.55)"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, PW - 16, PH - 16);
    return canvas.encode("jpeg", 88);
}

// 📰 RELATÓRIO DO DIA (antes de fechar o grupo) — lista: [{ nome, qtd }]
async function criarCardRelatorio({ fotoGrupoBuffer, nomeGrupo, data, total = 0, pessoas = 0, lista = [], assunto } = {}) {
    const canvas = createCanvas(PW, PH); const ctx = canvas.getContext("2d");
    await baseJornal(ctx);
    await fotoJornal(ctx, fotoGrupoBuffer, nomeGrupo);
    cabecalhoJornal(ctx, "RELATÓRIO DO DIA", `NAGATORO • ${data || ""}`);
    const tx = 520, larg = 400, MED = ["#f5c542", "#c9d1db", "#d98b4a"];
    ctx.fillStyle = COR.texto; ctx.font = "34px NagaSans";
    ctx.fillText(cortarTexto(ctx, limparCard(nomeGrupo) || "Grupo", larg), tx, 192);
    // números do dia
    const pil = (x, w, txt) => { pilula(ctx, x, 210, w, 32, false); ctx.fillStyle = "rgba(157,77,255,0.18)"; ctx.fill(); ctx.strokeStyle = "rgba(157,77,255,0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = COR.lilas; ctx.font = "16px NagaSans"; ctx.textAlign = "center"; ctx.fillText(txt, x + w / 2, 232); ctx.textAlign = "left"; };
    pil(tx, 190, `${Number(total).toLocaleString("pt-BR")} MENSAGENS`);
    pil(tx + 205, 195, `${pessoas} PESSOAS FALARAM`);
    const itens = lista.slice(0, 4);
    if (!itens.length) { ctx.fillStyle = COR.lilas; ctx.font = "24px NagaSansM"; ctx.fillText("Dia parado. Ninguém falou nada~", tx, 300); }
    itens.forEach((it, i) => {
        const y = 258 + i * 54;
        ctx.fillStyle = "rgba(18,10,31,0.8)"; ctx.fillRect(tx, y, larg, 46);
        ctx.fillStyle = MED[i] || COR.neon; ctx.fillRect(tx, y, 6, 46);
        ctx.beginPath(); ctx.arc(tx + 32, y + 23, 14, 0, Math.PI * 2); ctx.fillStyle = MED[i] || "rgba(157,77,255,0.8)"; ctx.fill();
        ctx.fillStyle = i < 3 ? "#1a1326" : "#ffffff"; ctx.font = "16px NagaSans"; ctx.textAlign = "center";
        ctx.fillText(String(i + 1), tx + 32, y + 29); ctx.textAlign = "left";
        ctx.fillStyle = COR.texto; ctx.font = "20px NagaSans";
        ctx.fillText(cortarTexto(ctx, limparCard(it.nome) || "Sem nome", 230), tx + 58, y + 30);
        ctx.fillStyle = COR.lilas; ctx.font = "17px NagaSansM"; ctx.textAlign = "right";
        ctx.fillText(`${it.qtd} msg`, tx + larg - 14, y + 29); ctx.textAlign = "left";
    });
    // assunto mais comentado
    const ya = 478;
    ctx.fillStyle = "rgba(157,77,255,0.16)"; ctx.fillRect(tx, ya, larg, 60);
    ctx.fillStyle = COR.neon; ctx.fillRect(tx, ya, 6, 60);
    ctx.fillStyle = COR.neon; ctx.font = "14px NagaSans"; ctx.fillText("ASSUNTO MAIS COMENTADO", tx + 18, ya + 22);
    ctx.fillStyle = COR.texto; ctx.font = "19px NagaSansM";
    ctx.fillText(cortarTexto(ctx, limparCard(assunto) || "Sem assunto marcante hoje", larg - 32), tx + 18, ya + 47);
    ctx.fillStyle = COR.apagado; ctx.font = "18px NagaSansM";
    ctx.fillText("Eu vi tudo. Eu sempre vejo~", 50, 548);
    ctx.strokeStyle = "rgba(157,77,255,0.55)"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, PW - 16, PH - 16);
    return canvas.encode("jpeg", 88);
}

module.exports = {
    LAYOUT, W, H,
    criarCardRelatorio,
    criarCardCrush,
    criarCardDueloCrush,
    criarCardRankJornal,
    criarCardConvite,
    criarCardSaidas,
    criarCardPlay,
    criarCardBoasVindas,
    criarCardDespedida,
    criarCardSolicitacao,
    criarCardSolicitacaoRecusada,
    criarCardLevelUp,
    criarCardCasal,
    criarCardResumo,
    criarCardMenuMidias
};
