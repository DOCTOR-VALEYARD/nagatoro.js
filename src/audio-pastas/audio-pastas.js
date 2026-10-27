/* =================================================
   🔊💬 NAGATORO — ÁUDIO OU MENSAGEM POR PASTA (alternando)
   📁 Arquivo: audio-pastas.js

   Cada situação (bom dia, boa tarde, boa noite, anti-amor, menu,
   prefixo, chamado...) tem DUAS pastinhas:

     src/midias/audios/<situação>/      → áudios (.mp3 .ogg .m4a .opus .wav)
     src/midias/mensagens/<situação>/   → mensagens.txt (1 mensagem por linha)

   🔁 ALTERNÂNCIA: em cada chat a Nagatoro reveza — uma vez manda
   ÁUDIO, na próxima manda MENSAGEM, depois áudio, depois mensagem...
   Se só um dos dois tiver conteúdo, ela usa só ele. Nunca repete o
   mesmo áudio/mensagem duas vezes seguidas (quando tem mais de um).

   ✍️ No mensagens.txt dá pra usar:
     {usuario} → marca a pessoa      {prefixo} → prefixo atual
     {bot}     → nome do bot         {dono}    → nome do dono
     \n        → quebra de linha
   Linhas vazias e linhas que começam com # são ignoradas.

   🔧 Os áudios são convertidos pra OGG/Opus (balãozinho de voz)
   com ffmpeg antes de enviar, então qualquer formato funciona.
================================================= */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const config = require("../../config");

const extensoesValidas = [".mp3", ".ogg", ".m4a", ".opus", ".wav"];
const pastaBase = path.join(__dirname, "../midias/audios");
const pastaMensagens = path.join(__dirname, "../midias/mensagens");

const ultimoEscolhido = new Map(); // "a:pasta" / "m:pasta" -> último item
const proximoModo = new Map();     // `${chat}::${pasta}` -> "audio" | "texto"

function listarAudios(nomePasta) {
    const pasta = path.join(pastaBase, nomePasta);
    if (!fs.existsSync(pasta)) return [];
    return fs.readdirSync(pasta).filter(arquivo =>
        extensoesValidas.includes(path.extname(arquivo).toLowerCase())
    );
}

function listarMensagens(nomePasta) {
    const pasta = path.join(pastaMensagens, nomePasta);
    if (!fs.existsSync(pasta)) return [];
    const linhas = [];
    for (const arquivo of fs.readdirSync(pasta).filter(a => a.toLowerCase().endsWith(".txt"))) {
        try {
            for (const l of fs.readFileSync(path.join(pasta, arquivo), "utf8").split(/\r?\n/)) {
                const t = l.trim();
                if (t && !t.startsWith("#")) linhas.push(t);
            }
        } catch {}
    }
    return linhas;
}

function sortearSemRepetir(chaveMemoria, lista) {
    if (!lista.length) return null;
    let candidatos = lista;
    const ultimo = ultimoEscolhido.get(chaveMemoria);
    if (lista.length > 1 && ultimo !== undefined) {
        const sem = lista.filter(x => x !== ultimo);
        if (sem.length) candidatos = sem;
    }
    const escolhido = candidatos[Math.floor(Math.random() * candidatos.length)];
    ultimoEscolhido.set(chaveMemoria, escolhido);
    return escolhido;
}

function pegarCaminhoAleatorio(nomePasta) {
    const escolhido = sortearSemRepetir(`a:${nomePasta}`, listarAudios(nomePasta));
    return escolhido ? path.join(pastaBase, nomePasta, escolhido) : null;
}

// Mantido por compatibilidade (devolve o buffer cru, sem converter)
function pegarAudioAleatorio(nomePasta) {
    const caminho = pegarCaminhoAleatorio(nomePasta);
    if (!caminho) return null;
    try { return fs.readFileSync(caminho); } catch { return null; }
}

function prefixoAtual() {
    try {
        const db = JSON.parse(fs.readFileSync(path.join(__dirname, "../../database/botconfig.json"), "utf8"));
        if (typeof db.PREFIX === "string" && db.PREFIX.trim()) return db.PREFIX.trim();
    } catch {}
    return config.PREFIX;
}

function montarTexto(modelo, mentions) {
    const alvo = mentions?.[0] ? `@${String(mentions[0]).split("@")[0].split(":")[0]}` : "senpai";
    return modelo
        .replace(/\\n/g, "\n")
        .replace(/\{usuario\}/g, alvo)
        .replace(/\{prefixo\}/g, prefixoAtual())
        .replace(/\{bot\}/g, config.BOT_NAME)
        .replace(/\{dono\}/g, config.OWNER_NAME);
}

// 🔄 Converte qualquer áudio pro formato de voz do WhatsApp (OGG/Opus, mono, 16kHz)
function converterParaVoz(caminhoOrigem, caminhoDestino) {
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -y -i "${caminhoOrigem}" -ac 1 -ar 16000 -c:a libopus -b:a 32k "${caminhoDestino}"`, (erro) => {
            if (erro) return reject(erro);
            resolve();
        });
    });
}

async function enviarSoAudio(sock, chatId, nomePasta, { mentions, quoted } = {}) {
    const caminhoOrigem = pegarCaminhoAleatorio(nomePasta);
    if (!caminhoOrigem) return false;
    const caminhoTemp = path.join(os.tmpdir(), `voz_${Date.now()}_${Math.floor(Math.random() * 9999)}.ogg`);
    try {
        // .ogg/.opus já estão no formato de voz: manda direto, sem ffmpeg
        const jaEhVoz = [".ogg", ".opus"].includes(path.extname(caminhoOrigem).toLowerCase());
        if (!jaEhVoz) await converterParaVoz(caminhoOrigem, caminhoTemp);
        await sock.sendMessage(chatId, {
            audio: fs.readFileSync(jaEhVoz ? caminhoOrigem : caminhoTemp),
            mimetype: "audio/ogg; codecs=opus",
            ptt: true,
            ...(mentions ? { mentions } : {})
        }, quoted ? { quoted } : {});
        return true;
    } catch (erro) {
        console.error(`❌ Erro ao converter/enviar áudio da pasta "${nomePasta}":`, erro?.message || erro);
        // 🛟 Se a conversão falhar, manda o arquivo original como áudio comum
        try {
            const ext = path.extname(caminhoOrigem).toLowerCase();
            const mimetypes = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg" };
            await sock.sendMessage(chatId, {
                audio: fs.readFileSync(caminhoOrigem),
                mimetype: mimetypes[ext] || "audio/mpeg",
                ptt: false,
                ...(mentions ? { mentions } : {})
            }, quoted ? { quoted } : {});
            return true;
        } catch (erro2) {
            console.error(`❌ Fallback também falhou pra pasta "${nomePasta}":`, erro2?.message || erro2);
            return false;
        }
    } finally {
        try { fs.unlinkSync(caminhoTemp); } catch {}
    }
}

async function enviarSoTexto(sock, chatId, nomePasta, { mentions, quoted } = {}) {
    const modelo = sortearSemRepetir(`m:${nomePasta}`, listarMensagens(nomePasta));
    if (!modelo) return false;
    await sock.sendMessage(chatId, {
        text: montarTexto(modelo, mentions),
        ...(mentions ? { mentions } : {})
    }, quoted ? { quoted } : {});
    return true;
}

// 📤 Manda ÁUDIO ou MENSAGEM da situação, revezando por chat.
// Retorna "audio", "texto" ou false (quando as duas pastas estão vazias).
async function enviarAudioDaPasta(sock, chatId, nomePasta, opcoes = {}) {
    const temAudio = listarAudios(nomePasta).length > 0;
    const temTexto = listarMensagens(nomePasta).length > 0;
    if (!temAudio && !temTexto) return false;

    const chaveModo = `${chatId}::${nomePasta}`;
    let modo;
    if (temAudio && temTexto) {
        modo = proximoModo.get(chaveModo) || (Math.random() < 0.5 ? "audio" : "texto");
        proximoModo.set(chaveModo, modo === "audio" ? "texto" : "audio");
    } else {
        modo = temAudio ? "audio" : "texto";
    }

    if (modo === "audio") {
        if (await enviarSoAudio(sock, chatId, nomePasta, opcoes)) return "audio";
        if (temTexto && await enviarSoTexto(sock, chatId, nomePasta, opcoes)) return "texto";
        return false;
    }
    if (await enviarSoTexto(sock, chatId, nomePasta, opcoes)) return "texto";
    if (temAudio && await enviarSoAudio(sock, chatId, nomePasta, opcoes)) return "audio";
    return false;
}

const enviarRespostaDaPasta = enviarAudioDaPasta;

module.exports = { pegarAudioAleatorio, enviarAudioDaPasta, enviarRespostaDaPasta, listarAudios, listarMensagens };
