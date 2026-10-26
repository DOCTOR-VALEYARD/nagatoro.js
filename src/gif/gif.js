/* =================================================
   🎬 CONVERSOR UNIVERSAL — TUDO PARA GIF / VÍDEO
   📁 Arquivo: converterParaGif.js
   🤖 ${config.BOT_NAME} • ${config.OWNER_NAME}
   💡 FUNCIONA COM: IMAGEM • VÍDEO • FIGURINHA (ESTÁTICA OU ANIMADA)
   ================================================= */

const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const config = require("../../config");

// 🧹 LIMPEZA TOTAL — NÃO DEIXA NADA SOBRANDO
function limparArquivos(caminhoEntrada, caminhoSaida, pastaQuadros = null) {
    try {
        if (caminhoEntrada && fs.existsSync(caminhoEntrada)) fs.unlinkSync(caminhoEntrada);
        if (caminhoSaida && fs.existsSync(caminhoSaida)) fs.unlinkSync(caminhoSaida);
        if (pastaQuadros && fs.existsSync(pastaQuadros)) fs.rmSync(pastaQuadros, { recursive: true, force: true });
    } catch {}
}

// 📤 ENVIO FINAL PADRÃO
function executarFfmpegArquivo(argumentos) {
    return new Promise((resolve, reject) => {
        const processo = spawn("ffmpeg", argumentos, { stdio: ["ignore", "ignore", "pipe"] });
        let erro = "";
        processo.stderr.on("data", parte => { erro += String(parte); });
        processo.once("error", reject);
        processo.once("close", codigo => {
            if (codigo === 0) resolve();
            else reject(new Error(erro.slice(-1200) || `FFmpeg encerrou com código ${codigo}`));
        });
    });
}

function executarComando(comando, argumentos) {
    return new Promise((resolve, reject) => {
        const processo = spawn(comando, argumentos, { stdio: ["ignore", "pipe", "pipe"] });
        let saida = "", erro = "";
        processo.stdout.on("data", p => { saida += String(p); });
        processo.stderr.on("data", p => { erro += String(p); });
        processo.once("error", e => {
            if (e.code === "ENOENT") reject(new Error(`comando "${comando}" não encontrado (rode: pkg install libwebp)`));
            else reject(e);
        });
        processo.once("close", codigo => {
            if (codigo === 0) resolve(saida);
            else reject(new Error(erro.slice(-500) || `${comando} encerrou com código ${codigo}`));
        });
    });
}

// =================================================
// 🧬 DECODER EMBUTIDO (WebAssembly) — FIGURINHA → IMAGEM / GIF
// =================================================
// POR QUE EXISTE: a conversão de figurinha dependia de coisas que quase nunca
// estão instaladas — a biblioteca "sharp" (que NÃO está no package.json),
// webpmux/dwebp (pacote de sistema) ou o decoder de WebP ANIMADO do ffmpeg
// (que em várias hospedagens falha com "image data not found"). Resultado:
// figurinha animada nunca convertia, nem pra imagem nem pra GIF.
//
// O node-webpmux JÁ é dependência do bot e traz um decoder de WebP em
// WebAssembly. Aqui cada quadro é decodificado por ele, montado em RGB e
// entregue ao ffmpeg por pipe como vídeo "cru" — o ffmpeg nunca precisa
// abrir o WebP. Não instala nada extra.
const COR_FUNDO_FIGURINHA = [255, 255, 255]; // cor atrás das partes transparentes
const MAX_SEGUNDOS_GIF = 6;                  // duração máxima do GIF gerado

let webpWasmPromise = null;
function carregarWebpWasm() {
    if (!webpWasmPromise) {
        webpWasmPromise = (async () => {
            const WebP = require("node-webpmux");
            await WebP.Image.initLib();
            return WebP;
        })().catch(erro => { webpWasmPromise = null; throw erro; });
    }
    return webpWasmPromise;
}

// Cola um quadro (RGBA) na tela, respeitando posição, "blend" e transparência.
function comporQuadro(tela, W, H, pixels, fr) {
    const fw = fr.width, fh = fr.height;
    const ox = (fr.x || 0) * 2, oy = (fr.y || 0) * 2; // no WebP a posição vem em unidades de 2px
    for (let y = 0; y < fh; y++) {
        const ty = oy + y;
        if (ty >= H) break;
        for (let x = 0; x < fw; x++) {
            const tx = ox + x;
            if (tx >= W) break;
            const s = (y * fw + x) * 4;
            const d = (ty * W + tx) * 4;
            const sa = pixels[s + 3];
            if (!fr.blend || sa === 255) {
                tela[d] = pixels[s]; tela[d + 1] = pixels[s + 1]; tela[d + 2] = pixels[s + 2]; tela[d + 3] = sa;
            } else if (sa !== 0) {
                const da = tela[d + 3];
                const k = da * (1 - sa / 255);
                const oa = sa + k;
                tela[d]     = (pixels[s]     * sa + tela[d]     * k) / oa;
                tela[d + 1] = (pixels[s + 1] * sa + tela[d + 1] * k) / oa;
                tela[d + 2] = (pixels[s + 2] * sa + tela[d + 2] * k) / oa;
                tela[d + 3] = oa;
            }
        }
    }
}

function limparRegiao(tela, W, H, fr) {
    const ox = (fr.x || 0) * 2, oy = (fr.y || 0) * 2;
    for (let y = 0; y < fr.height && oy + y < H; y++) {
        const ini = ((oy + y) * W + ox) * 4;
        const fim = Math.min(ini + fr.width * 4, ((oy + y) * W + W) * 4);
        tela.fill(0, ini, fim);
    }
}

// RGBA → RGB opaco (partes transparentes ficam com a cor de fundo).
function achatarRGB(rgba, W, H) {
    const out = Buffer.allocUnsafe(W * H * 3);
    const [br, bg, bb] = COR_FUNDO_FIGURINHA;
    for (let i = 0, o = 0, total = W * H * 4; i < total; i += 4, o += 3) {
        const a = rgba[i + 3];
        if (a === 255) { out[o] = rgba[i]; out[o + 1] = rgba[i + 1]; out[o + 2] = rgba[i + 2]; }
        else if (a === 0) { out[o] = br; out[o + 1] = bg; out[o + 2] = bb; }
        else {
            const k = a / 255, j = 1 - k;
            out[o] = rgba[i] * k + br * j; out[o + 1] = rgba[i + 1] * k + bg * j; out[o + 2] = rgba[i + 2] * k + bb * j;
        }
    }
    return out;
}

// Abre a figurinha (estática ou animada) e devolve os quadros já compostos.
async function abrirFigurinhaWasm(buffer) {
    const WebP = await carregarWebpWasm();
    const img = new WebP.Image();
    await img.load(buffer);
    const W = img.width, H = img.height;
    if (!W || !H) throw new Error("figurinha sem dimensões válidas");

    const animada = !!(img.hasAnim && Array.isArray(img.frames) && img.frames.length);
    // Atraso por quadro (ms). Valores minúsculos viram 100ms, como os navegadores fazem.
    const atrasos = animada ? img.frames.map(f => (f.delay > 10 ? f.delay : 100)) : [100];

    async function* quadros() {
        if (!animada) {
            const px = await img.getImageData(); // RGBA W*H*4
            yield { rgba: Buffer.from(px.buffer, px.byteOffset, px.length), atraso: 100 };
            return;
        }
        const tela = Buffer.alloc(W * H * 4); // começa transparente
        for (let i = 0; i < img.frames.length; i++) {
            const fr = img.frames[i];
            const px = await img.getFrameData(i);
            comporQuadro(tela, W, H, px, fr);
            yield { rgba: tela, atraso: atrasos[i] }; // use antes de pedir o próximo quadro
            if (fr.dispose) limparRegiao(tela, W, H, fr);
        }
    }
    return { largura: W, altura: H, animada, atrasos, quadros };
}

// Roda o ffmpeg recebendo vídeo cru pelo stdin. "produtor" recebe uma função
// escrever(buffer) que devolve false quando o ffmpeg já encerrou (aí é só parar).
function rodarFfmpegComEntrada(argumentos, produtor) {
    return new Promise((resolve, reject) => {
        const processo = spawn("ffmpeg", argumentos, { stdio: ["pipe", "ignore", "pipe"] });
        let erro = "", encerrado = false;
        processo.stderr.on("data", p => { erro = (erro + String(p)).slice(-2000); });
        processo.stdin.on("error", () => {}); // EPIPE: o erro de verdade vem no "close"

        processo.once("error", e => {
            if (e.code === "ENOENT") reject(new Error('ffmpeg não encontrado (instale o ffmpeg no servidor)'));
            else reject(e);
        });
        processo.once("close", codigo => {
            encerrado = true;
            if (codigo === 0) resolve();
            else reject(new Error(erro.slice(-1200) || `FFmpeg encerrou com código ${codigo}`));
        });

        const escrever = pedaco => new Promise(ok => {
            if (encerrado || processo.stdin.destroyed) return ok(false);
            if (processo.stdin.write(pedaco)) return ok(true);
            const fim = () => { processo.stdin.off("drain", fim); processo.stdin.off("close", fim); ok(!encerrado); };
            processo.stdin.once("drain", fim);
            processo.stdin.once("close", fim);
        });

        Promise.resolve()
            .then(() => produtor(escrever))
            .catch(e => { try { processo.kill("SIGKILL"); } catch {} reject(e); })
            .finally(() => { try { processo.stdin.end(); } catch {} });
    });
}

// FIGURINHA (qualquer tipo) → JPG parado ou MP4 pra enviar como GIF.
async function converterFigurinhaViaWasm(buffer, tempSaida, modoSaida) {
    const fig = await abrirFigurinhaWasm(buffer);
    const { largura: W, altura: H } = fig;
    const tamanho = `${W}x${H}`;

    if (modoSaida === "imagem") {
        // só o primeiro quadro
        const gerador = fig.quadros();
        const primeiro = await gerador.next();
        await gerador.return();
        if (primeiro.done) throw new Error("a figurinha não tem quadros");
        const rgb = achatarRGB(primeiro.value.rgba, W, H);
        await rodarFfmpegComEntrada([
            "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", tamanho, "-i", "pipe:0",
            "-frames:v", "1", "-q:v", "2", tempSaida
        ], escrever => escrever(rgb));
        return;
    }

    // GIF: velocidade original da figurinha (média dos atrasos), entre 5 e 20 fps
    const mediaMs = fig.atrasos.reduce((a, b) => a + b, 0) / fig.atrasos.length;
    // Estática: 3s a 15fps (igual ao comportamento antigo). Animada: velocidade dela.
    const fps = fig.animada ? Math.min(20, Math.max(5, Math.round(1000 / mediaMs))) : 15;
    const maxQuadros = fps * (fig.animada ? MAX_SEGUNDOS_GIF : 3);

    await rodarFfmpegComEntrada([
        "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", tamanho, "-framerate", String(fps), "-i", "pipe:0",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-crf", "24", "-preset", "ultrafast", "-an", "-movflags", "+faststart", tempSaida
    ], async escrever => {
        let escritos = 0;
        for await (const q of fig.quadros()) {
            const rgb = achatarRGB(q.rgba, W, H);
            // quadro com atraso maior que 1 passo do fps fica na tela mais tempo
            const repeticoes = fig.animada ? Math.max(1, Math.round(q.atraso * fps / 1000)) : maxQuadros;
            for (let r = 0; r < repeticoes && escritos < maxQuadros; r++, escritos++) {
                if (!(await escrever(rgb))) return;
            }
            if (escritos >= maxQuadros) break;
        }
    });
}

// 🎴 Extrai cada frame do WebP animado com webpmux + dwebp e monta o vídeo
// a partir da sequência de PNGs. Contorna o bug do decoder de WebP ANIMADO
// embutido no FFmpeg (que em vários builds — incluindo Termux — lê o
// container mas não acha os dados de imagem: "image data not found").
async function converterWebpAnimadoViaFrames(tempEntrada, tempSaida, pastaQuadros) {
    fs.mkdirSync(pastaQuadros, { recursive: true });

    const info = await executarComando("webpmux", ["-info", tempEntrada]);
    const match = info.match(/Number of frames:\s*(\d+)/i);
    const totalFrames = match ? parseInt(match[1], 10) : 0;
    if (!totalFrames) throw new Error(`webpmux não encontrou frames no arquivo (saída: ${info.slice(0, 200)})`);

    // ⚡ CORREÇÃO DE VELOCIDADE: antes cada frame rodava webpmux+dwebp em
    // SEQUÊNCIA (um de cada vez) — numa figurinha com muitos frames isso
    // é o que mais pesava no tempo total. Agora extrai em LOTES paralelos
    // (4 por vez), usando os núcleos do celular em vez de um só.
    const CONCORRENCIA = 4;

    async function extrairFrame(i) {
        const numero = String(i).padStart(4, "0");
        const frameWebp = path.join(pastaQuadros, `f_${numero}.webp`);
        const framePng = path.join(pastaQuadros, `frame_${numero}.png`);
        await executarComando("webpmux", ["-get", "frame", String(i), tempEntrada, "-o", frameWebp]);
        await executarComando("dwebp", [frameWebp, "-o", framePng]);
    }

    const indices = Array.from({ length: totalFrames }, (_, idx) => idx + 1);
    for (let inicio = 0; inicio < indices.length; inicio += CONCORRENCIA) {
        const lote = indices.slice(inicio, inicio + CONCORRENCIA);
        await Promise.all(lote.map(extrairFrame));
    }

    await executarFfmpegArquivo([
        "-y", "-threads", "0", "-loglevel", "error", "-framerate", "15",
        "-i", path.join(pastaQuadros, "frame_%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=12",
        "-t", "6", "-crf", "24", "-preset", "ultrafast", "-an", tempSaida
    ]);
}

// 🧩 MÉTODO PRINCIPAL (hospedagem sem root): usa a biblioteca "sharp" (npm),
// que decodifica WebP animado sozinha — não precisa de webpmux/dwebp nem
// do decoder de WebP animado do FFmpeg (que falha com "image data not found").
function carregarSharp() {
    try {
        return require("sharp");
    } catch {
        throw new Error('biblioteca "sharp" não instalada (adicione "sharp" nas dependências do bot e reinicie)');
    }
}

async function converterWebpAnimadoViaSharp(tempEntrada, tempSaida, pastaQuadros) {
    const sharp = carregarSharp();
    fs.mkdirSync(pastaQuadros, { recursive: true });

    const meta = await sharp(tempEntrada, { pages: -1 }).metadata();
    const totalFrames = Math.max(1, Number(meta.pages) || 1);

    // Velocidade original da figurinha (média dos atrasos entre quadros).
    const atrasos = Array.isArray(meta.delay) ? meta.delay.filter(d => d > 0) : [];
    const mediaMs = atrasos.length ? atrasos.reduce((a, b) => a + b, 0) / atrasos.length : 80;
    const fps = Math.min(20, Math.max(5, Math.round(1000 / mediaMs)));

    const CONCORRENCIA = 4;
    const indices = Array.from({ length: totalFrames }, (_, i) => i);
    for (let inicio = 0; inicio < indices.length; inicio += CONCORRENCIA) {
        const lote = indices.slice(inicio, inicio + CONCORRENCIA);
        await Promise.all(lote.map(i => {
            const numero = String(i + 1).padStart(4, "0");
            return sharp(tempEntrada, { page: i })
                .png()
                .toFile(path.join(pastaQuadros, `frame_${numero}.png`));
        }));
    }

    await executarFfmpegArquivo([
        "-y", "-threads", "0", "-loglevel", "error", "-framerate", String(fps),
        "-i", path.join(pastaQuadros, "frame_%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-t", "6", "-crf", "24", "-preset", "ultrafast", "-an", tempSaida
    ]);
}

async function extrairPrimeiroFrameViaSharp(tempEntrada, tempSaidaJpg) {
    const sharp = carregarSharp();
    await sharp(tempEntrada, { page: 0 })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 92 })
        .toFile(tempSaidaJpg);
}

function executarFfmpegPipe(buffer, argumentos) {
    return new Promise((resolve, reject) => {
        const processo = spawn("ffmpeg", argumentos, { stdio: ["pipe", "ignore", "pipe"] });
        let erro = "";
        processo.stderr.on("data", parte => { erro += String(parte); });
        processo.once("error", reject);
        processo.once("close", codigo => {
            if (codigo === 0) resolve();
            else reject(new Error(erro.slice(-1200) || `FFmpeg encerrou com código ${codigo}`));
        });
        processo.stdin.end(buffer);
    });
}

async function enviarResultado(sock, dados) {
    const { from, remetente, arquivoFinal, msg, modoSaida } = dados;

    try {
        if (modoSaida === "imagem") {
            await sock.sendMessage(from, {
                image: fs.readFileSync(arquivoFinal),
                caption: `✅ Convertido, @${remetente.split('@')[0]}!`,
                mentions: [remetente]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                video: fs.readFileSync(arquivoFinal),
                mimetype: 'video/mp4',
                caption: `✅ Convertido, @${remetente.split('@')[0]}!`,
                mentions: [remetente],
                gifPlayback: true // ✅ Aparece direto como GIF no WhatsApp
            }, { quoted: msg });
        }

    } catch (erroEnvio) {
        console.error("❌ Erro envio:", erroEnvio);
        await sock.sendMessage(from, { text: "⚠️ Converti certo, mas deu problema ao enviar! Tente novamente." }, { quoted: msg });
    } finally {
        limparArquivos(dados.tempEntrada, arquivoFinal, dados.pastaQuadros);
    }
}

// 🖼️ Extrai só o PRIMEIRO frame de um webp animado (usando webpmux+dwebp,
// mesmo contorno de bug do converterWebpAnimadoViaFrames) e converte pra
// JPG — usado pelo modo "imagem" quando a entrada é figurinha animada.
async function extrairPrimeiroFrameWebp(tempEntrada, tempSaidaJpg, pastaQuadros) {
    fs.mkdirSync(pastaQuadros, { recursive: true });
    const frameWebp = path.join(pastaQuadros, "f_0001.webp");
    const framePng = path.join(pastaQuadros, "frame_0001.png");
    await executarComando("webpmux", ["-get", "frame", "1", tempEntrada, "-o", frameWebp]);
    await executarComando("dwebp", [frameWebp, "-o", framePng]);
    await executarFfmpegArquivo(["-y", "-loglevel", "error", "-i", framePng, tempSaidaJpg]);
}

// ⚙️ FUNÇÃO PRINCIPAL — ACEITA TUDO E SE ADAPTA SOZINHA
// modoSaida: "gif" (padrão, vídeo com gifPlayback) ou "imagem" (JPG parado)
async function converterParaGif(sock, msg, modoSaida = "gif") {
    const from = msg.key.remoteJid;
    const remetente = msg.key.participant || msg.key.remoteJid;

    // 📥 PEGA QUALQUER TIPO DE MÍDIA — DIRETA OU RESPONDIDA
    const dir = msg.message;
    const res = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    let midia, tipo;

    if (res?.stickerMessage) { midia = res.stickerMessage; tipo = res.stickerMessage.isAnimated ? "sticker_animado" : "sticker_estatico"; }
    else if (dir?.stickerMessage) { midia = dir.stickerMessage; tipo = dir.stickerMessage.isAnimated ? "sticker_animado" : "sticker_estatico"; }
    else if (res?.imageMessage) { midia = res.imageMessage; tipo = "imagem"; }
    else if (dir?.imageMessage) { midia = dir.imageMessage; tipo = "imagem"; }
    else if (res?.videoMessage) { midia = res.videoMessage; tipo = "video"; }
    else if (dir?.videoMessage) { midia = dir.videoMessage; tipo = "video"; }
    else {
        // ❌ NÃO TEM NENHUMA MÍDIA
        const rotuloModo = modoSaida === "imagem" ? "imagem" : "gif";
        return sock.sendMessage(from, { 
            text: `❌ *NÃO ENCONTREI NADA!*\n\nEnvie ou RESPONDA em cima de:\n🖼️ Imagem | 🎥 Vídeo | 🎴 Figurinha\nCom: ${config.PREFIX}${modoSaida === "imagem" ? "toimg" : "gif"} (converte pra ${rotuloModo})` 
        }, { quoted: msg });
    }

    // declarados aqui fora pra o "catch" conseguir apagar os temporários se algo falhar
    let tempEntrada = null, tempSaida = null, pastaQuadros = null;

    try {
        // ✅ AVISO INICIAL — simples, só marcando quem pediu (igual o .figurinha)
        await sock.sendMessage(from, { text: `⏳ Convertendo pra ${modoSaida === "imagem" ? "imagem" : "gif"}, @${remetente.split('@')[0]}...`, mentions: [remetente] }, { quoted: msg });

        // ⬇️ BAIXA O ARQUIVO
        const stream = await downloadContentFromMessage(midia, tipo.includes("sticker") ? "sticker" : tipo);
        let buffer = Buffer.from([]);
        for await (const pedaco of stream) buffer = Buffer.concat([buffer, pedaco]);

        // 🔍 DIAGNÓSTICO — confirma se o que baixamos é um WebP de verdade
        // antes de gastar tempo chamando o ffmpeg. Se o mediaKey/URL da
        // mensagem citada vier incompleto, o buffer sai corrompido e o
        // ffmpeg trava com "image data not found" — isso pega esse caso
        // cedo e com um log muito mais claro.
        console.log(`📦 Buffer baixado: ${buffer.length} bytes | assinatura: ${buffer.subarray(0, 12).toString('hex')}`);
        if (tipo.includes("sticker")) {
            const assinaturaValida = buffer.length > 12 &&
                buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
                buffer.subarray(8, 12).toString("ascii") === "WEBP";
            if (!assinaturaValida) {
                throw new Error(
                    `Download da figurinha veio corrompido/incompleto (${buffer.length} bytes, ` +
                    `assinatura "${buffer.subarray(0, 12).toString('hex')}" ≠ RIFF....WEBP). ` +
                    `Provável falha na descriptografia da mídia (mediaKey/URL da mensagem citada). ` +
                    `Verifique a versão do @whiskeysockets/baileys e se a figurinha ainda está ` +
                    `acessível (mensagens de mídia expiram/são removidas do servidor do WhatsApp).`
                );
            }
        }

        // 🎴 Algumas figurinhas animadas chegam com isAnimated=false. O arquivo
        // WebP animado sempre tem o bloco "ANIM" — se tiver, trata como animada.
        if (tipo === "sticker_estatico" && buffer.includes("ANIM")) tipo = "sticker_animado";

        // 📁 ARQUIVOS ÚNICOS
        const idUnico = Date.now() + "_" + Math.floor(Math.random() * 9999);
        const extensaoEntrada = tipo === "sticker_animado" ? "webp" : "tmp";
        tempEntrada = path.join(__dirname, `ent_${idUnico}.${extensaoEntrada}`);
        tempSaida = path.join(__dirname, modoSaida === "imagem" ? `sai_${idUnico}.jpg` : `sai_${idUnico}.mp4`);
        pastaQuadros = path.join(__dirname, `quadros_${idUnico}`);

        fs.writeFileSync(tempEntrada, buffer);

        // 🧬 FIGURINHA (estática ou animada) → IMAGEM / GIF
        // Método principal: decoder embutido (WebAssembly) + ffmpeg por pipe.
        // Não depende de sharp, webpmux/dwebp nem do decoder de WebP animado do
        // ffmpeg. Se falhar por algum motivo, os métodos antigos abaixo ainda
        // são tentados na sequência.
        if (tipo.includes("sticker")) {
            let convertida = false;
            try {
                await converterFigurinhaViaWasm(buffer, tempSaida, modoSaida);
                convertida = fs.existsSync(tempSaida) && fs.statSync(tempSaida).size > 0;
            } catch (erroWasm) {
                console.warn("⚠️ decoder embutido (WebAssembly) falhou; tentando os outros métodos:", erroWasm.message);
            }
            if (convertida) {
                return await enviarResultado(sock, { from, remetente, tempEntrada, arquivoFinal: tempSaida, pastaQuadros, msg, modoSaida });
            }
            limparArquivos(null, tempSaida, pastaQuadros);
        }

        // 🎯 AQUI DECIDE O CAMINHO CERTO DE CONVERSÃO
        // ⚡ preset veryfast (era "medium") = codifica bem mais rápido com o
        // mesmo CRF, ou seja, mesma qualidade visual, arquivo levemente maior
        // — ótima troca pra quem tá rodando isso num celular via Termux.
        // -threads 0 deixa o ffmpeg usar todos os núcleos disponíveis.
        if (tipo === "sticker_animado" && modoSaida === "imagem") {
            // 🖼️ FIGURINHA ANIMADA → IMAGEM: pega só o primeiro frame
            try {
                await extrairPrimeiroFrameViaSharp(tempEntrada, tempSaida);
            } catch (erroSharp) {
                console.warn("⚠️ 1º frame via sharp falhou; tentando webpmux/dwebp:", erroSharp.message);
                limparArquivos(null, tempSaida, null);
                try {
                    await extrairPrimeiroFrameWebp(tempEntrada, tempSaida, pastaQuadros);
                } catch (erroFrame) {
                    console.warn("⚠️ extração de 1 frame via webpmux/dwebp falhou; tentando ffmpeg direto:", erroFrame.message);
                    await executarFfmpegArquivo(["-y", "-loglevel", "error", "-i", tempEntrada, "-frames:v", "1", tempSaida]);
                }
            }
            if (!fs.existsSync(tempSaida) || fs.statSync(tempSaida).size < 512) {
                throw new Error("FFmpeg não gerou uma imagem válida a partir da figurinha.");
            }
            await enviarResultado(sock, { from, remetente, tempEntrada, arquivoFinal: tempSaida, pastaQuadros, msg, modoSaida });
        }
        else if (tipo === "sticker_animado") {
            // 🎴 WEBP ANIMADO → GIF: método principal: extrai cada frame com
            // webpmux+dwebp e monta o vídeo a partir dos PNGs. Isso contorna
            // um bug do decoder de WebP animado embutido no FFmpeg (lê o
            // container mas não acha os dados de imagem). Se webpmux/dwebp
            // não estiverem instalados (pkg install libwebp), cai pro
            // método antigo (ffmpeg direto) como última tentativa.
            const saidaComum = [
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=12",
                "-t", "6", "-crf", "24", "-preset", "ultrafast", "-an", tempSaida
            ];
            let erroFrames;
            try {
                try {
                    await converterWebpAnimadoViaSharp(tempEntrada, tempSaida, pastaQuadros);
                } catch (falhaSharp) {
                    console.warn("⚠️ conversão via sharp falhou; tentando webpmux/dwebp:", falhaSharp.message);
                    limparArquivos(null, tempSaida, pastaQuadros);
                    await converterWebpAnimadoViaFrames(tempEntrada, tempSaida, pastaQuadros);
                }
            } catch (falhaFrames) {
                erroFrames = falhaFrames;
                console.warn("⚠️ extração via webpmux/dwebp falhou; tentando ffmpeg direto:", falhaFrames.message);
                limparArquivos(null, tempSaida, pastaQuadros);
                let erroArquivo;
                try {
                    await executarFfmpegArquivo([
                        "-y", "-threads", "0", "-loglevel", "error",
                        "-max_error_rate", "1.0", "-err_detect", "ignore_err",
                        "-i", tempEntrada, ...saidaComum
                    ]);
                } catch (falhaArquivo) {
                    erroArquivo = falhaArquivo;
                    limparArquivos(null, tempSaida, null);
                    try {
                        await executarFfmpegPipe(buffer, [
                            "-y", "-threads", "0", "-loglevel", "error",
                            "-max_error_rate", "1.0", "-err_detect", "ignore_err",
                            "-f", "webp_pipe", "-i", "pipe:0", ...saidaComum
                        ]);
                    } catch (falhaPipe) {
                        throw new Error(`frames: ${erroFrames.message} | arquivo: ${erroArquivo.message} | webp_pipe: ${falhaPipe.message}`);
                    }
                }
            }
            if (!fs.existsSync(tempSaida) || fs.statSync(tempSaida).size < 1024) {
                throw new Error("FFmpeg não gerou um vídeo válido a partir da figurinha.");
            }
            await enviarResultado(sock, { from, remetente, tempEntrada, arquivoFinal: tempSaida, pastaQuadros, msg, modoSaida });
        } 
        else if (modoSaida === "imagem" && tipo === "sticker_estatico" && await extrairPrimeiroFrameViaSharp(tempEntrada, tempSaida).then(() => true, () => false)) {
            // 🖼️ FIGURINHA ESTÁTICA → IMAGEM (via sharp, sem depender do ffmpeg)
            await enviarResultado(sock, { from, remetente, tempEntrada, arquivoFinal: tempSaida, pastaQuadros: null, msg, modoSaida });
        }
        else if (modoSaida === "imagem") {
            // 🖼️ FIGURINHA ESTÁTICA / IMAGEM / VÍDEO → IMAGEM: pega só 1 frame
            const cmd = `ffmpeg -y -threads 0 -loglevel error -i "${tempEntrada}" -frames:v 1 "${tempSaida}"`;
            exec(cmd, (erroExec) => {
                if (erroExec || !fs.existsSync(tempSaida) || fs.statSync(tempSaida).size < 512) {
                    console.error("❌ Erro ao extrair imagem:", erroExec);
                    limparArquivos(tempEntrada, tempSaida, null);
                    return sock.sendMessage(from, { text: "😵 Não consegui gerar a imagem a partir disso." }, { quoted: msg });
                }
                enviarResultado(sock, { from, remetente, tempEntrada, arquivoFinal: tempSaida, pastaQuadros: null, msg, modoSaida });
            });
        }
        else if (tipo === "sticker_estatico" || tipo === "imagem") {
            // 🖼️ ESTÁTICA/IMAGEM → CRIA VÍDEO COM DURAÇÃO PARA FICAR COMO GIF
            const cmd = `ffmpeg -y -threads 0 -loop 1 -i "${tempEntrada}" -t 3 -c:v libx264 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=15" -crf 23 -preset ultrafast -an "${tempSaida}"`;
            
            exec(cmd, () => enviarResultado(sock, { from, remetente, tempEntrada, arquivoFinal: tempSaida, pastaQuadros: null, msg, modoSaida }));
        } 
        else {
            // 🎥 VÍDEO → OTIMIZA E ENVIA DIRETO COMO GIF
            const cmd = `ffmpeg -y -threads 0 -i "${tempEntrada}" -t 3 -c:v libx264 -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=15" -crf 23 -preset ultrafast -an "${tempSaida}"`;
            
            exec(cmd, () => enviarResultado(sock, { from, remetente, tempEntrada, arquivoFinal: tempSaida, pastaQuadros: null, msg, modoSaida }));
        }

    } catch (erroGeral) {
        console.error("Erro:", erroGeral);
        limparArquivos(tempEntrada, tempSaida, pastaQuadros);
        await sock.sendMessage(from, { text: "😵 Erro inesperado ao processar arquivo!" }, { quoted: msg });
    }
}

module.exports = { converterParaGif };
