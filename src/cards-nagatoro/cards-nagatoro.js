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

module.exports = {
    LAYOUT, W, H,
    criarCardBoasVindas,
    criarCardDespedida,
    criarCardSolicitacao,
    criarCardSolicitacaoRecusada,
    criarCardLevelUp,
    criarCardCasal,
    criarCardResumo,
    criarCardMenuMidias
};
