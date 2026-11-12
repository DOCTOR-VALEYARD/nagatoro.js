/* =================================================
   🗑️ NAGATORO — ANTI-DELETE (X9)
   📁 Arquivo: src/antidelete/antidelete.js

   Guarda cópia de TUDO que chega nos chats com X9 ligado (texto,
   foto, vídeo, vídeo redondo, áudio, figurinha, documento,
   localização, contato, enquete). Quando alguém apaga pra todos,
   a Nagatoro devolve a MESMA coisa pro chat, debochando de quem
   apagou. O liga/desliga (.x9) e a visualização única ficam em
   src/x9/x9.js.

   🔧 Duas garantias:
   - a cópia é registrada NA HORA (antes de terminar de baixar a
     mídia) — se a pessoa apagar rapidinho, a gente espera o
     download terminar e mostra mesmo assim;
   - escuta os DOIS jeitos que o WhatsApp avisa "apagou"
     (messages.upsert com protocolMessage e messages.update com
     REVOKE). O primeiro que chegar mostra; o outro é ignorado.
================================================= */

const { proto } = require("@whiskeysockets/baileys");
const { gerenciarX9, x9Ativo, desembrulhar, classificar, baixar, remetenteDe, tamanhoDe } = require("../x9/x9");

const LIMITE_TOTAL_BYTES = 100 * 1024 * 1024; // memória máxima das mídias guardadas
const LIMITE_MIDIA_BYTES = 20 * 1024 * 1024;  // mídia maior que isso não é guardada
const LIMITE_ITENS = 1500;                    // mensagens guardadas (as mais antigas saem)
const ESPERA_DOWNLOAD_MS = 25000;             // quanto espera um download pendente

const cache = new Map(); // `${chat}::${id}` -> dados
let bytesTotal = 0;

function chave(chat, id) { return `${chat}::${id}`; }

const ROTULO = {
    texto: "uma mensagem", imagem: "uma foto", video: "um vídeo",
    audio: "um áudio", figurinha: "uma figurinha", documento: "um arquivo",
    local: "uma localização", contato: "um contato"
};

// 😏 Deboche de quem apagou a PRÓPRIA mensagem
const DEBOCHE_PROPRIO = [
    "🕵️ HEHE~ @{quem} apagou {rotulo} achando que ninguém ia ver? Tá fofo. Olha aqui pra todo mundo 👇",
    "😏 @{quem} mandou {rotulo} e apagou correndo... arrependeu, senpai? Pena que eu guardei.",
    "🤭 Ai ai, @{quem}... apagar não adianta comigo. Toma {rotulo} de volta:",
    "😈 @{quem} tentou sumir com {rotulo}. Tentou. Eu sou a Nagatoro, eu vejo TUDO.",
    "🙄 Sério, @{quem}? Apagou {rotulo}? Que vergonhinha... deixa eu mostrar pra galera:",
    "💅 @{quem} achou que tinha botão de desfazer na vida. Não tem. Olha {rotulo} aí:",
    "🫵 OLHA ELE(A)! @{quem} apagou {rotulo}. Escondendo o quê, hein? Agora todo mundo sabe.",
    "😼 Apagou, @{quem}? Que bonitinho. Eu printei mentalmente. Aqui {rotulo}:"
];

// 😈 Deboche quando um ADM apaga a mensagem de OUTRA pessoa
const DEBOCHE_OUTRO = [
    "🕵️ @{apagador} apagou {rotulo} de @{quem}... protegendo, é? Que pena, eu guardei. Hehe~",
    "😏 Olha só, @{apagador} sumindo com {rotulo} de @{quem}. Censura comigo não cola:",
    "🤭 @{apagador} achou que apagando {rotulo} de @{quem} ninguém ia ver. Tá fofo.",
    "😈 @{apagador} apagou {rotulo} de @{quem}. Eu devolvo, porque eu sou dessas:"
];

function sortear(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

function montarCabecalho(dados, apagador) {
    const outro = apagador?.numero && apagador.numero !== dados.remetente;
    const rotulo = ROTULO[dados.tipo] || "uma mensagem";
    const base = outro ? sortear(DEBOCHE_OUTRO) : sortear(DEBOCHE_PROPRIO);
    const texto = base
        .replace(/\{quem\}/g, dados.remetente)
        .replace(/\{apagador\}/g, apagador?.numero || "")
        .replace(/\{rotulo\}/g, rotulo);
    const mentions = [...new Set([dados.remetenteJid, outro ? apagador.jid : null].filter(Boolean))];
    return { texto, mentions };
}

function guardar(k, dados) {
    cache.set(k, dados);
    while ((bytesTotal > LIMITE_TOTAL_BYTES || cache.size > LIMITE_ITENS) && cache.size > 1) {
        const velha = cache.keys().next().value;
        const d = cache.get(velha);
        bytesTotal -= d?.midia ? d.midia.length : 0;
        cache.delete(velha);
    }
}

function retirar(k) {
    const d = cache.get(k);
    if (!d) return null;
    cache.delete(k);
    bytesTotal -= d.midia ? d.midia.length : 0;
    return d;
}

// ───────────────────────────────────────────────
// 📥 GUARDA UMA CÓPIA (chamar pra toda mensagem recebida)
// ───────────────────────────────────────────────
async function cachearMensagem(msg, sock) {
    try {
        if (!msg?.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid, id = msg.key.id;
        if (!from || !id || !x9Ativo.get(from)) return; // só guarda onde o X9 está ligado

        const { conteudo, viewOnce } = desembrulhar(msg.message);
        if (viewOnce || conteudo?.protocolMessage || conteudo?.reactionMessage) return;
        const info = classificar(conteudo);
        if (!info) return;

        const quem = remetenteDe(msg);
        const k = chave(from, id);
        const dados = { ...info, no: undefined, midia: null, falhou: false, remetenteJid: quem.jid, remetente: quem.numero, ts: Date.now(), pronto: null };
        guardar(k, dados); // ⚡ registra JÁ — antes de baixar

        const ehMidia = ["imagem", "video", "audio", "figurinha", "documento"].includes(info.tipo);
        if (!ehMidia) return;
        if (tamanhoDe(info.no) > LIMITE_MIDIA_BYTES) { dados.falhou = true; return; }

        dados.pronto = (async () => {
            try {
                dados.midia = await baixar(msg, conteudo, sock);
                bytesTotal += dados.midia ? dados.midia.length : 0;
            } catch { dados.falhou = true; }
        })();
        await dados.pronto;
    } catch (erro) {
        console.error("❌ X9: erro ao guardar mensagem:", erro?.message || erro);
    }
}

// ───────────────────────────────────────────────
// 📤 MOSTRA DE VOLTA O QUE FOI APAGADO
// ───────────────────────────────────────────────
function foiAPropriaBot(sock, apagador) {
    if (apagador?.fromMe) return true;
    const meus = [sock?.user?.id, sock?.user?.lid].filter(Boolean).map(j => String(j).split("@")[0].split(":")[0]);
    return !!apagador?.numero && meus.includes(apagador.numero);
}

async function mostrarApagada(sock, from, idOriginal, apagador) {
    if (!from || !idOriginal) return false;
    const dados = retirar(chave(from, idOriginal));
    if (!dados) return false;                 // não tínhamos (ou já mostramos)
    // 🛡️ quem apagou foi a PRÓPRIA Nagatoro (limpar, antilink, mute, anti-palavrão,
    // lista negra...) → não devolve, senão desfaria a moderação.
    if (foiAPropriaBot(sock, apagador)) return true;
    if (!x9Ativo.get(from)) return true;

    if (dados.pronto) {
        await Promise.race([dados.pronto, new Promise(r => setTimeout(r, ESPERA_DOWNLOAD_MS))]).catch(() => {});
    }

    const { texto: cab, mentions } = montarCabecalho(dados, apagador);
    const legenda = dados.legenda ? `\n\n📝 _${dados.legenda}_` : "";

    try {
        if (dados.tipo === "texto") {
            await sock.sendMessage(from, { text: `${cab}\n\n💬 ${dados.texto}`, mentions });
        } else if (dados.tipo === "local") {
            await sock.sendMessage(from, { text: cab, mentions });
            await sock.sendMessage(from, { location: { degreesLatitude: dados.lat, degreesLongitude: dados.lng, name: dados.texto || undefined } });
        } else if (dados.tipo === "contato") {
            await sock.sendMessage(from, { text: cab, mentions });
            await sock.sendMessage(from, { contacts: { displayName: dados.contatos?.[0]?.displayName || "Contato", contacts: (dados.contatos || []).map(c => ({ vcard: c.vcard })) } });
        } else if (!dados.midia) {
            await sock.sendMessage(from, { text: `${cab}${legenda}\n\n_(o arquivo era pesado demais ou o WhatsApp não deixou baixar... sorte sua.)_`, mentions });
        } else if (dados.tipo === "imagem") {
            await sock.sendMessage(from, { image: dados.midia, caption: cab + legenda, mentions });
        } else if (dados.tipo === "video") {
            await sock.sendMessage(from, { video: dados.midia, caption: cab + legenda, mimetype: dados.mimetype, gifPlayback: !!dados.gif, mentions });
        } else if (dados.tipo === "documento") {
            await sock.sendMessage(from, { document: dados.midia, mimetype: dados.mimetype, fileName: dados.nomeArquivo, caption: cab + legenda, mentions });
        } else if (dados.tipo === "audio") {
            await sock.sendMessage(from, { text: cab, mentions });
            await sock.sendMessage(from, { audio: dados.midia, mimetype: dados.mimetype, ptt: !!dados.ptt });
        } else if (dados.tipo === "figurinha") {
            await sock.sendMessage(from, { text: cab, mentions });
            await sock.sendMessage(from, { sticker: dados.midia });
        }
    } catch (erro) {
        console.error("❌ X9: erro ao mostrar mensagem apagada:", erro?.message || erro);
    }
    return true;
}

// ───────────────────────────────────────────────
// 🗑️ CAMINHO 1 — aviso de "apagou" chegando como mensagem (messages.upsert)
// Retorna true se a mensagem era um aviso de apagada (já tratada).
// ───────────────────────────────────────────────
async function verificarMensagemApagada(sock, msg) {
    try {
        const { conteudo } = desembrulhar(msg.message);
        const protocolo = conteudo?.protocolMessage;
        const ehRevoke = protocolo && (protocolo.type === proto?.Message?.ProtocolMessage?.Type?.REVOKE || protocolo.type === 0);
        if (!ehRevoke) return false;
        const from = protocolo.key?.remoteJid || msg.key.remoteJid;
        await mostrarApagada(sock, from, protocolo.key?.id, { ...remetenteDe(msg), fromMe: !!msg.key.fromMe });
        return true;
    } catch (erro) {
        console.error("❌ X9: erro ao tratar apagada:", erro?.message || erro);
        return true;
    }
}

// ───────────────────────────────────────────────
// 🗑️ CAMINHO 2 — aviso de "apagou" chegando como atualização (messages.update)
// ───────────────────────────────────────────────
function instalarX9(sock) {
    sock.ev.on("messages.update", async (atualizacoes) => {
        for (const u of atualizacoes || []) {
            try {
                const up = u?.update || {};
                const revogou = up.messageStubType === 1 || (up.message === null && "message" in up);
                if (!revogou || !u.key?.id) continue;
                const chaveApagador = up.key || u.key;
                const quemApagou = { ...remetenteDe({ key: chaveApagador }), fromMe: !!chaveApagador.fromMe };
                await mostrarApagada(sock, u.key.remoteJid, u.key.id, quemApagou);
            } catch (erro) {
                console.error("❌ X9 (update):", erro?.message || erro);
            }
        }
    });
}

function listarChavesGrupo(remoteJid) {
    const prefixo = `${remoteJid}::`;
    const r = [];
    for (const [k, d] of cache.entries()) if (k.startsWith(prefixo)) r.push({ id: k.slice(prefixo.length), remetente: d.remetente });
    return r;
}

module.exports = { cachearMensagem, verificarMensagemApagada, gerenciarX9, listarChavesGrupo, instalarX9, mostrarApagada };
