/* =================================================
   📢 NAGATORO — BROADCAST (só o dono)
   📁 Arquivo: broadcast.js

   Manda para TODOS os grupos em que o bot está (pergunta pro
   WhatsApp, não depende de grupo configurado).

   Como usar:
     <prefixo>broadcast texto            → só o texto
     marcar uma FOTO + <prefixo>broadcast → só a foto (com a legenda dela, se tiver)
     marcar uma FOTO + <prefixo>broadcast texto → foto com o seu texto
     marcar um TEXTO + <prefixo>broadcast → reenvia aquele texto
     mandar foto/vídeo com a legenda "<prefixo>broadcast texto" → também vai
     Funciona com foto, vídeo, GIF, áudio, figurinha e documento.

   Pausa de 3 a 6 s entre cada grupo (e uma pausa maior a cada 15)
   pra o WhatsApp não entender como spam.
   <prefixo>broadcast parar → interrompe um envio em andamento.
================================================= */
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const config = require("../../config");
const { ehDono } = require("../utils-validacao/utils-validacao");

let emAndamento = null; // { parar: false }

const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const pausa = () => esperar(process.env.NAGATORO_TESTE ? 5 : 3000 + Math.floor(Math.random() * 3000));

function desembrulhar(m) {
    for (let i = 0; i < 6 && m; i++) {
        const dentro = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message ||
            m.viewOnceMessageV2Extension?.message || m.documentWithCaptionMessage?.message || null;
        if (!dentro) break;
        m = dentro;
    }
    return m || null;
}

function marcadaDe(base) {
    for (const v of Object.values(base || {})) {
        if (v && typeof v === "object" && v.contextInfo?.quotedMessage) return desembrulhar(v.contextInfo.quotedMessage);
    }
    return null;
}

async function baixar(parte, tipo) {
    const stream = await downloadContentFromMessage(parte, tipo);
    const pedacos = [];
    for await (const p of stream) pedacos.push(p);
    return Buffer.concat(pedacos);
}

// tira o "<prefixo>broadcast" da legenda quando a própria mídia é o comando
function limparLegenda(t) {
    const P = String(config.PREFIX || ".").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return String(t || "").replace(new RegExp("^\\s*" + P + "\\s*(broadcast|bc|transmitir)\\b", "i"), "").trim();
}

const cabecalho = (txt) => txt ? `📢 *COMUNICADO DO ${config.BOT_NAME}*\n\n${txt}` : "";

/** Monta o que vai ser enviado. Retorna { conteudo, tipo } ou null. */
async function montar(msg, texto) {
    const base = desembrulhar(msg.message);
    const marcada = marcadaDe(base);
    // se não marcou nada, a própria mensagem pode ser a mídia (foto com legenda .broadcast)
    const fonte = marcada || (base && (base.imageMessage || base.videoMessage || base.documentMessage) ? base : null);

    if (fonte) {
        const legendaOriginal = fonte === base ? "" : (fonte.imageMessage?.caption || fonte.videoMessage?.caption || fonte.documentMessage?.caption || "");
        const legenda = cabecalho(texto || legendaOriginal);
        if (fonte.imageMessage) return { tipo: "foto", conteudo: { image: await baixar(fonte.imageMessage, "image"), caption: legenda } };
        if (fonte.videoMessage) return { tipo: fonte.videoMessage.gifPlayback ? "GIF" : "vídeo", conteudo: { video: await baixar(fonte.videoMessage, "video"), caption: legenda, gifPlayback: fonte.videoMessage.gifPlayback === true } };
        if (fonte.documentMessage) return { tipo: "documento", conteudo: { document: await baixar(fonte.documentMessage, "document"), mimetype: fonte.documentMessage.mimetype || "application/octet-stream", fileName: fonte.documentMessage.fileName || "arquivo", caption: legenda } };
        if (fonte.audioMessage) return { tipo: "áudio", conteudo: { audio: await baixar(fonte.audioMessage, "audio"), mimetype: fonte.audioMessage.mimetype || "audio/ogg; codecs=opus", ptt: fonte.audioMessage.ptt === true }, textoDepois: texto ? cabecalho(texto) : "" };
        if (fonte.stickerMessage) return { tipo: "figurinha", conteudo: { sticker: await baixar(fonte.stickerMessage, "sticker") }, textoDepois: texto ? cabecalho(texto) : "" };
        const txtMarcado = fonte.conversation || fonte.extendedTextMessage?.text || "";
        if (txtMarcado || texto) return { tipo: "texto", conteudo: { text: cabecalho(texto || txtMarcado) } };
    }
    if (texto) return { tipo: "texto", conteudo: { text: cabecalho(texto) } };
    return null;
}

async function todosOsGrupos(sock) {
    try {
        const todos = await sock.groupFetchAllParticipating();
        const ids = Object.keys(todos || {}).filter(j => j.endsWith("@g.us"));
        if (ids.length) return ids;
    } catch (e) { console.error("⚠️ broadcast: não consegui listar os grupos:", e?.message || e); }
    // reserva: grupos que o bot já conhece pelos arquivos
    try { return Object.keys(require("../grupo-db/grupo-db").getDB()).filter(j => j.endsWith("@g.us")); } catch { return []; }
}

async function cmdBroadcast(sock, msg, args = []) {
    const from = msg.key.remoteJid;
    // confere só quem MANDOU (no grupo o remoteJid é o próprio grupo, não a pessoa)
    const quem = from.endsWith("@g.us") ? [msg.key.participant, msg.key.participantAlt] : [msg.key.remoteJid, msg.key.remoteJidAlt, msg.key.participantAlt];
    const dono = !!msg.key.fromMe || ehDono(quem.filter(Boolean), config.OWNER_NUMBER);
    if (!dono) return sock.sendMessage(from, { text: "🚫 Só o meu dono pode usar o broadcast, senpai. Boa tentativa 😏" }, { quoted: msg });

    if (String(args[0] || "").toLowerCase() === "parar") {
        if (!emAndamento) return sock.sendMessage(from, { text: "Não tem broadcast rodando agora." }, { quoted: msg });
        emAndamento.parar = true;
        return sock.sendMessage(from, { text: "🛑 Ok, paro no próximo grupo." }, { quoted: msg });
    }
    if (emAndamento) return sock.sendMessage(from, { text: "⏳ Já tem um broadcast sendo enviado. Espera terminar (ou use *" + config.PREFIX + "broadcast parar*)." }, { quoted: msg });

    let texto = args.join(" ").trim();
    if (!texto) texto = limparLegenda(desembrulhar(msg.message)?.imageMessage?.caption || desembrulhar(msg.message)?.videoMessage?.caption || "");

    let envio;
    try { envio = await montar(msg, texto); }
    catch (e) { return sock.sendMessage(from, { text: "❌ Não consegui baixar a mídia marcada: " + (e?.message || e) }, { quoted: msg }); }
    if (!envio) {
        return sock.sendMessage(from, { text: `📢 *BROADCAST*\n\n• ${config.PREFIX}broadcast texto\n• marque uma foto/vídeo/áudio/figurinha e mande ${config.PREFIX}broadcast (com ou sem texto)\n• ${config.PREFIX}broadcast parar` }, { quoted: msg });
    }

    const grupos = await todosOsGrupos(sock);
    if (!grupos.length) return sock.sendMessage(from, { text: "❌ Não encontrei nenhum grupo." }, { quoted: msg });

    const minutos = Math.max(1, Math.round(grupos.length * 4.8 / 60));
    await sock.sendMessage(from, { text: `📢 Enviando *${envio.tipo}* para *${grupos.length} grupo(s)*.\n⏱️ Leva uns ${minutos} min (pausa entre cada um pra não tomar bloqueio).` }, { quoted: msg });

    emAndamento = { parar: false };
    let ok = 0; const falhas = [];
    try {
        for (let i = 0; i < grupos.length; i++) {
            if (emAndamento.parar) break;
            const g = grupos[i];
            try {
                await sock.sendMessage(g, envio.conteudo);
                if (envio.textoDepois) { await esperar(1200); await sock.sendMessage(g, { text: envio.textoDepois }); }
                ok++;
            } catch (e) { falhas.push(g); console.error("⚠️ broadcast falhou em", g, e?.message || e); }
            if (i < grupos.length - 1) { await pausa(); if ((i + 1) % 15 === 0) await esperar(20000); }
        }
    } finally {
        const parou = emAndamento?.parar; emAndamento = null;
        await sock.sendMessage(from, {
            text: `📢 *BROADCAST ${parou ? "INTERROMPIDO" : "CONCLUÍDO"}*\n\n✅ Enviado: ${ok} de ${grupos.length}` +
                (falhas.length ? `\n⚠️ Falhou: ${falhas.length} (grupo só de ADM ou o bot saiu)` : "")
        }, { quoted: msg }).catch(() => {});
    }
}

module.exports = { cmdBroadcast };
