/* =================================================
   🏆 NAGATORO — CARD DO RANKING (vidro transparente sobre a foto do grupo)
   📁 Arquivo: rank-card.js
   Imagem deitada 1280x800: foto do grupo desfocada no fundo, foto redonda
   + nome do grupo à esquerda e o TOP 10 num painel de vidro à direita.
================================================= */
const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const F = path.join(__dirname, "../midias/assets/fonts");
let fontesOk = false;
function fontes() {
    if (fontesOk) return; fontesOk = true;
    for (const [arq, fam] of [["Poppins-Bold.ttf", "RK-Bold"], ["Poppins-Medium.ttf", "RK-Medium"], ["Poppins-Regular.ttf", "RK-Regular"]]) {
        try { if (fs.existsSync(path.join(F, arq))) GlobalFonts.registerFromPath(path.join(F, arq), fam); } catch {}
    }
}

const W = 1280, H = 800;
const MEDALHA = ["#f5c542", "#c9d1db", "#d98b4a"];
const ROXO = "#9b5cff";

function redondo(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function cortar(ctx, t, max) {
    if (ctx.measureText(t).width <= max) return t;
    while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t + "…";
}
// tira emoji/símbolo que a fonte não desenha (vira quadradinho)
const limpo = (t) => String(t || "").replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim();

function capaCover(ctx, img, x, y, w, h) {
    const r = Math.max(w / img.width, h / img.height), iw = img.width * r, ih = img.height * r;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

/**
 * @param {object} d { grupo, membros, fotoGrupo(Buffer|null), lista:[{nome, nivel, xp, ouro}] }
 * @returns {Promise<Buffer>} PNG
 */
async function gerarCardRanking(d) {
    fontes();
    const cv = createCanvas(W, H), ctx = cv.getContext("2d");
    let foto = null;
    try { if (d.fotoGrupo) foto = await loadImage(d.fotoGrupo); } catch {}

    // ── fundo: foto do grupo desfocada + tom roxo ──
    if (foto) { ctx.save(); ctx.filter = "blur(26px) brightness(0.55)"; capaCover(ctx, foto, -60, -60, W + 120, H + 120); ctx.restore(); }
    else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1b1030"); g.addColorStop(1, "#0d1424"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    const tom = ctx.createLinearGradient(0, 0, W, H); tom.addColorStop(0, "rgba(40,16,80,0.55)"); tom.addColorStop(1, "rgba(8,10,24,0.70)");
    ctx.fillStyle = tom; ctx.fillRect(0, 0, W, H);

    // ── esquerda: foto redonda do grupo + nome ──
    const cx = 250, cy = 290, R = 135;
    ctx.save(); ctx.shadowColor = ROXO; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2); ctx.fillStyle = "rgba(155,92,255,0.55)"; ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    if (foto) capaCover(ctx, foto, cx - R, cy - R, R * 2, R * 2); else { ctx.fillStyle = "#2a1d47"; ctx.fillRect(cx - R, cy - R, R * 2, R * 2); ctx.fillStyle = "#cdb6ff"; ctx.font = "bold 120px RK-Bold"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((limpo(d.grupo)[0] || "N").toUpperCase(), cx, cy + 6); }
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#cdb6ff"; ctx.font = "600 22px RK-Medium"; ctx.fillText("RANKING DO GRUPO", cx, 485);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 36px RK-Bold";
    const nome = limpo(d.grupo) || "Grupo";
    const pal = nome.split(" "); let l1 = "", l2 = "";
    for (const p of pal) { if (ctx.measureText((l1 + " " + p).trim()).width <= 380 && !l2) l1 = (l1 + " " + p).trim(); else l2 = (l2 + " " + p).trim(); }
    ctx.fillText(cortar(ctx, l1, 380), cx, 530); if (l2) ctx.fillText(cortar(ctx, l2, 380), cx, 572);
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "22px RK-Regular";
    ctx.fillText(`${d.membros || 0} membros · ${d.lista.length} no ranking`, cx, l2 ? 615 : 575);

    // ── direita: painel de vidro com o TOP 10 ──
    const px = 470, py = 50, pw = 760, ph = 700;
    ctx.save(); redondo(ctx, px, py, pw, ph, 30); ctx.fillStyle = "rgba(255,255,255,0.09)"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.stroke(); ctx.restore();
    ctx.textAlign = "left"; ctx.fillStyle = "#ffffff"; ctx.font = "bold 34px RK-Bold"; ctx.fillText("TOP 10", px + 36, py + 60);
    ctx.textAlign = "right"; ctx.fillStyle = "#cdb6ff"; ctx.font = "600 20px RK-Medium"; ctx.fillText("NÍVEL  ·  XP", px + pw - 36, py + 58);

    const maxXp = Math.max(1, ...d.lista.map(u => (u.nivel || 1) * 1000 + (u.xp || 0)));
    const rowH = 60, y0 = py + 88;
    d.lista.slice(0, 10).forEach((u, i) => {
        const y = y0 + i * rowH;
        if (i % 2 === 0) { ctx.save(); redondo(ctx, px + 18, y, pw - 36, rowH - 8, 14); ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.fill(); ctx.restore(); }
        // posição
        const bx = px + 58, by = y + (rowH - 8) / 2;
        ctx.beginPath(); ctx.arc(bx, by, 21, 0, Math.PI * 2); ctx.fillStyle = MEDALHA[i] || "rgba(155,92,255,0.75)"; ctx.fill();
        ctx.fillStyle = i < 3 ? "#1a1326" : "#ffffff"; ctx.font = "bold 20px RK-Bold"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), bx, by + 1);
        // nome
        ctx.textAlign = "left"; ctx.fillStyle = "#ffffff"; ctx.font = (i < 3 ? "bold 25px RK-Bold" : "600 23px RK-Medium");
        ctx.fillText(cortar(ctx, limpo(u.nome) || "Sem nome", 330), px + 96, by - 6);
        // barrinha de progresso
        const pr = ((u.nivel || 1) * 1000 + (u.xp || 0)) / maxXp;
        redondo(ctx, px + 96, by + 14, 330, 7, 4); ctx.fillStyle = "rgba(255,255,255,0.13)"; ctx.fill();
        redondo(ctx, px + 96, by + 14, Math.max(10, 330 * pr), 7, 4); ctx.fillStyle = i < 3 ? MEDALHA[i] : ROXO; ctx.fill();
        // nível e xp
        ctx.textAlign = "right"; ctx.fillStyle = "#ffffff"; ctx.font = "bold 24px RK-Bold"; ctx.fillText(`NV ${u.nivel || 1}`, px + pw - 150, by + 1);
        ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "20px RK-Regular"; ctx.fillText(`${Number(u.xp || 0).toLocaleString("pt-BR")} xp`, px + pw - 36, by + 1);
        ctx.textBaseline = "alphabetic";
    });
    if (!d.lista.length) { ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.font = "26px RK-Regular"; ctx.fillText("Ninguém pontuou ainda. Bando de fantasma.", px + pw / 2, py + ph / 2); }

    // rodapé
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "600 18px RK-Medium";
    ctx.fillText("NAGATORO  ·  DOCTOR VALEYARD", 60, H - 40);
    return cv.toBuffer("image/png");
}

module.exports = { gerarCardRanking };
