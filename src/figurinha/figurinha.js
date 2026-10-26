/* =================================================
   🎴 CRIADOR DE FIGURINHAS — ESTÁTICA / ANIMADA ✅ CORRIGIDO
   📁 Arquivo: figurinha.js
   🤖 ${config.BOT_NAME} • ${config.OWNER_NAME}
   ================================================= */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../../config');


// ─────────────────────────────────────────────
// ⚡ CONVERSÃO
// ─────────────────────────────────────────────
const TAM = 512;
const LIMITE_BYTES_ANIMADA = 480 * 1024; // acima disso o WhatsApp não anima a figurinha

function rodarFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
        let erro = "";
        p.stderr.on("data", d => { erro = (erro + String(d)).slice(-1500); });
        p.once("error", e => reject(e.code === "ENOENT" ? new Error("ffmpeg não encontrado no servidor") : e));
        p.once("close", codigo => codigo === 0 ? resolve() : reject(new Error(erro || `ffmpeg encerrou com código ${codigo}`)));
    });
}

/** 🖼️ IMAGEM → figurinha 512x512 PREENCHENDO o quadrado (sem bordas pretas), sem abrir o ffmpeg. */
async function converterImagemRapido(buffer) {
    const { createCanvas, loadImage } = require("@napi-rs/canvas");
    const img = await loadImage(buffer);
    const canvas = createCanvas(TAM, TAM);
    const ctx = canvas.getContext("2d");
    const escala = Math.max(TAM / img.width, TAM / img.height);
    const w = img.width * escala, h = img.height * escala;
    ctx.drawImage(img, (TAM - w) / 2, (TAM - h) / 2, w, h);
    const webp = await canvas.encode("webp", 92);
    return Buffer.from(webp);
}

/** 🎬 VÍDEO/GIF → figurinha animada. Tenta qualidade boa e, se passar do limite, comprime mais. */
async function converterVideoParaWebp(buffer) {
    const entrada = path.join(__dirname, `entrada_${Date.now()}_${Math.floor(Math.random() * 9999)}.tmp`);
    const saida = entrada.replace(/\.tmp$/, ".webp");
    fs.writeFileSync(entrada, buffer);
    try {
        const tentativas = [
            { fps: 12, q: 62, t: 4 },
            { fps: 10, q: 45, t: 4 },
            { fps: 8, q: 32, t: 3 }
        ];
        let ultimo = null;
        for (const { fps, q, t } of tentativas) {
            await rodarFfmpeg([
                "-y", "-threads", "0", "-i", entrada, "-t", String(t),
                "-vf", `scale=${TAM}:${TAM}:force_original_aspect_ratio=increase,crop=${TAM}:${TAM},fps=${fps}`,
                "-c:v", "libwebp", "-lossless", "0", "-q:v", String(q), "-compression_level", "1",
                "-preset", "default", "-loop", "0", "-an", saida
            ]);
            ultimo = fs.readFileSync(saida);
            if (ultimo.length <= LIMITE_BYTES_ANIMADA) return ultimo;
        }
        return ultimo;
    } finally {
        try { fs.unlinkSync(entrada); } catch {}
        try { fs.unlinkSync(saida); } catch {}
    }
}

/**
 * 🛟 PLANO B pra GIF/vídeo: se o ffmpeg da hospedagem não conseguir gerar a
 * figurinha animada (ex.: compilado sem libwebp), ele só tira os QUADROS em PNG
 * e a gente monta a figurinha animada aqui mesmo, sem depender de nada extra.
 */
function lerChunksWebp(buf) {
    const chunks = [];
    let pos = 12;
    while (pos + 8 <= buf.length) {
        const id = buf.toString("ascii", pos, pos + 4);
        const tam = buf.readUInt32LE(pos + 4);
        chunks.push({ id, dados: buf.subarray(pos + 8, pos + 8 + tam) });
        pos += 8 + tam + (tam % 2);
    }
    return chunks;
}

function chunkWebp(id, dados) {
    const cab = Buffer.alloc(8);
    cab.write(id, 0, 4, "ascii");
    cab.writeUInt32LE(dados.length, 4);
    return Buffer.concat([cab, dados, dados.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
}

function montarWebpAnimado(quadrosWebp, duracaoMs) {
    let temAlpha = false;
    const anmf = quadrosWebp.map(q => {
        const partes = lerChunksWebp(q).filter(c => ["ALPH", "VP8 ", "VP8L"].includes(c.id));
        if (partes.some(c => c.id === "ALPH" || c.id === "VP8L")) temAlpha = true;
        const cab = Buffer.alloc(16);
        cab.writeUIntLE(0, 0, 3);              // X
        cab.writeUIntLE(0, 3, 3);              // Y
        cab.writeUIntLE(TAM - 1, 6, 3);        // largura - 1
        cab.writeUIntLE(TAM - 1, 9, 3);        // altura - 1
        cab.writeUIntLE(Math.max(20, Math.round(duracaoMs)), 12, 3);
        cab[15] = 0x02;                        // sem mistura: cada quadro substitui o anterior
        return chunkWebp("ANMF", Buffer.concat([cab, ...partes.map(c => chunkWebp(c.id, c.dados))]));
    });
    const vp8x = Buffer.alloc(10);
    vp8x[0] = 0x02 | (temAlpha ? 0x10 : 0);   // animação (+ transparência)
    vp8x.writeUIntLE(TAM - 1, 4, 3);
    vp8x.writeUIntLE(TAM - 1, 7, 3);
    const anim = Buffer.alloc(6);             // fundo transparente, repete pra sempre
    const corpo = Buffer.concat([chunkWebp("VP8X", vp8x), chunkWebp("ANIM", anim), ...anmf]);
    const riff = Buffer.alloc(12);
    riff.write("RIFF", 0, 4, "ascii");
    riff.writeUInt32LE(corpo.length + 4, 4);
    riff.write("WEBP", 8, 4, "ascii");
    return Buffer.concat([riff, corpo]);
}

async function converterVideoQuadroAQuadro(buffer) {
    const { loadImage, createCanvas } = require("@napi-rs/canvas");
    const pasta = fs.mkdtempSync(path.join(require("os").tmpdir(), "figu_"));
    const entrada = path.join(pasta, "entrada.tmp");
    fs.writeFileSync(entrada, buffer);
    try {
        const tentativas = [{ fps: 10, q: 70, t: 4 }, { fps: 8, q: 50, t: 4 }, { fps: 6, q: 35, t: 3 }];
        let ultimo = null;
        for (const { fps, q, t } of tentativas) {
            for (const f of fs.readdirSync(pasta)) if (f.endsWith(".png")) fs.unlinkSync(path.join(pasta, f));
            await rodarFfmpeg([
                "-y", "-i", entrada, "-t", String(t),
                "-vf", `fps=${fps},scale=${TAM}:${TAM}:force_original_aspect_ratio=increase,crop=${TAM}:${TAM}`,
                "-an", path.join(pasta, "q_%03d.png")
            ]);
            const arquivos = fs.readdirSync(pasta).filter(f => f.endsWith(".png")).sort();
            if (!arquivos.length) throw new Error("o vídeo não tem quadros legíveis");
            const canvas = createCanvas(TAM, TAM);
            const ctx = canvas.getContext("2d");
            const quadros = [];
            for (const a of arquivos) {
                const img = await loadImage(fs.readFileSync(path.join(pasta, a)));
                ctx.clearRect(0, 0, TAM, TAM);
                ctx.drawImage(img, 0, 0, TAM, TAM);
                quadros.push(Buffer.from(await canvas.encode("webp", q)));
            }
            ultimo = montarWebpAnimado(quadros, 1000 / fps);
            if (ultimo.length <= LIMITE_BYTES_ANIMADA) return ultimo;
        }
        return ultimo;
    } finally {
        try { fs.rmSync(pasta, { recursive: true, force: true }); } catch {}
    }
}

/** 🛟 Último recurso (imagem estranha, formato raro): ffmpeg direto, também preenchendo o quadrado. */
async function converterComFfmpeg(buffer, tipo) {
    if (tipo === "video") return converterVideoQuadroAQuadro(buffer);
    const entrada = path.join(__dirname, `entrada_${Date.now()}_${Math.floor(Math.random() * 9999)}.tmp`);
    const saida = entrada.replace(/\.tmp$/, ".webp");
    fs.writeFileSync(entrada, buffer);
    try {
        await rodarFfmpeg([
            "-y", "-i", entrada,
            "-vf", `scale=${TAM}:${TAM}:force_original_aspect_ratio=increase,crop=${TAM}:${TAM}`,
            "-vcodec", "libwebp", "-lossless", "0", "-q:v", "88", "-compression_level", "2", "-an", saida
        ]);
        return fs.readFileSync(saida);
    } finally {
        try { fs.unlinkSync(entrada); } catch {}
        try { fs.unlinkSync(saida); } catch {}
    }
}

/**
 * Função principal — COMANDO ou AUTOMÁTICO
 * @param {boolean} modoAutomatico — true = sem avisos / sem frases
 */
async function criarFigurinha(sock, msg, modoAutomatico = false) {
    const from = msg.key.remoteJid;
    const remetente = msg.key.participant || msg.key.remoteJid;
    const nomeUsuario = msg.pushName || remetente.split('@')[0];
    const ehGrupo = from.endsWith("@g.us");
    
    // 📍 Definição de local
    let localEnvio = "💬 CONVERSA PRIVADA";
    if (ehGrupo) {
        // Tenta pegar nome do grupo
        const grupoInfo = await sock.groupMetadata(from).catch(() => null);
        localEnvio = grupoInfo?.subject || "👥 GRUPO DESCONHECIDO";
    }

    // 📅 HORA E DATA PARA COLOCAR NA INFORMAÇÃO
    const agora = new Date();
    const dataHora = agora.toLocaleString("pt-BR", { 
        day: "2-digit", month: "2-digit", year: "numeric", 
        hour: "2-digit", minute: "2-digit", second: "2-digit" 
    });

    // 📥 IDENTIFICA MÍDIA (enviada junto OU marcada — em qualquer formato do WhatsApp)
    const { temMidia, pegarMidia } = require("../midia-recente/midia-recente");

    if (!temMidia(msg)) {
        if (!modoAutomatico) {
            return sock.sendMessage(from, { 
                text: `┅┄┅┄『 ✦ 』┄┅┄┅┄
 🖼️ *ERRO AO CRIAR!*
┅┄┅┄『 ✦ 』┄┅┄┅┄
Envie uma imagem ou vídeo E use o comando,
ou então RESPONDA em cima da mídia com:
┅┄┅┄『 ✦ 』┄┅┄┅┄
${config.PREFIX}s / ${config.PREFIX}sticker
┅┄┅┄『 ✦ 』┄┅┄┅┄` 
            }, { quoted: msg });
        }
        return;
    }

    try {
        // ⬇️ BAIXA ARQUIVO (da cópia original guardada; se o link expirou, pede reenvio ao WhatsApp)
        let midia;
        try {
            midia = await pegarMidia(sock, msg);
        } catch (erroDownload) {
            console.error("⚠️ FIGURINHA: não consegui BAIXAR a mídia:", erroDownload?.message || erroDownload);
            if (!modoAutomatico) {
                await sock.sendMessage(from, { text: `😏 Não consegui baixar essa mídia, senpai... o WhatsApp não liberou o arquivo (mídia antiga ou apagada). Manda de novo e usa *${config.PREFIX}s* nela. Hehe~` }, { quoted: msg });
            }
            return;
        }
        if (!midia) return;
        const buffer = midia.buffer;
        const tipo = midia.tipo;

        // 📋 DADOS QUE APARECEM AO CLICAR NA FIGURINHA (nome do pacote + autor).
        // Eles precisam ser gravados DENTRO do arquivo .webp: mandar "packname" e
        // "author" no sendMessage não funciona (o Baileys ignora esses campos).
        const { adicionarMetadados } = require('../figurinha-meta/figurinha-meta');
        const etiqueta = {
            packname: `🎴 ${config.BOT_NAME} • ${config.OWNER_NAME}`,
            author: `👑 CRIADOR: ${config.OWNER_NAME}
👤 FEITO POR: ${nomeUsuario}
📍 LOCAL: ${localEnvio}
⏰ DATA/HORA: ${dataHora}`
        };

        let webp = null;
        if (tipo === "sticker") {
            webp = buffer; // marcou uma figurinha: só regrava a etiqueta
        } else {
            try {
                webp = tipo === "image" ? await converterImagemRapido(buffer) : await converterVideoParaWebp(buffer);
            } catch (erroConv) {
                console.error(`⚠️ FIGURINHA: conversão principal (${tipo}) falhou, usando o plano B:`, String(erroConv?.message || erroConv).slice(-400));
            }
            if (!webp) webp = await converterComFfmpeg(buffer, tipo);
        }

        const bufferFinal = adicionarMetadados(webp, etiqueta);
        await sock.sendMessage(from, { sticker: bufferFinal, mimetype: "image/webp" }, { quoted: msg });

    } catch (erroGeral) {
        console.error("⚠️ FIGURINHA: falhou de vez:", String(erroGeral?.message || erroGeral).slice(-600));
        if (!modoAutomatico) {
            await sock.sendMessage(from, { text: `😵 *Não consegui criar a figurinha.* O arquivo pode estar corrompido ou ser longo demais. Tente de novo!` }, { quoted: msg });
        }
    }
}

module.exports = { criarFigurinha, _teste: { converterImagemRapido, converterVideoParaWebp, converterComFfmpeg, converterVideoQuadroAQuadro } };
