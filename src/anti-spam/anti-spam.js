/* =================================================
   🛡️ NAGATORO — ANTI-SPAM DO PRÓPRIO BOT
   📁 Arquivo: src/anti-spam/anti-spam.js

   O bot é livre pra todo mundo, então ele se protege de virar spam:
     • palavra "prefixo": responde UMA vez por pessoa e ignora a mesma
       pessoa repetindo (config.PREFIXO_COOLDOWN_SEG)
     • flood de comandos: quem manda comando demais em pouco tempo fica
       sem resposta por alguns segundos (config.FLOOD); o bot avisa só
       UMA vez e depois fica em silêncio
     • ⏳ ampulheta: antes de cada comando o bot manda uma ampulheta que
       some sozinha quando o comando termina
     • 👀 reação em tudo que o bot atende
================================================= */

const config = require("../../config");

const ultimoPrefixo = new Map();   // `${chat}::${pessoa}` -> timestamp
const historico = new Map();       // `${chat}::${pessoa}` -> [timestamps de comandos]
const bloqueadoAte = new Map();    // `${chat}::${pessoa}` -> timestamp

const chave = (chat, pessoa) => `${chat}::${pessoa}`;

function limpar(mapa, limite = 3000) {
    if (mapa.size <= limite) return;
    const agora = Date.now();
    for (const [k, v] of mapa) {
        const t = Array.isArray(v) ? (v[v.length - 1] || 0) : v;
        if (t < agora - 10 * 60 * 1000) mapa.delete(k);
    }
}

/** Palavra "prefixo": true se pode responder agora (e já registra a resposta). */
function podeResponderPrefixo(chat, pessoa) {
    const seg = Number(config.PREFIXO_COOLDOWN_SEG);
    const espera = (Number.isFinite(seg) ? seg : 60) * 1000;
    const k = chave(chat, pessoa);
    const agora = Date.now();
    if (agora - (ultimoPrefixo.get(k) || 0) < espera) return false;
    ultimoPrefixo.set(k, agora);
    limpar(ultimoPrefixo);
    return true;
}

/**
 * Conta um comando dessa pessoa.
 * Retorna: "ok" (segue), "avisar" (estourou agora: avise UMA vez) ou "ignorar" (silêncio).
 */
function contarComando(chat, pessoa) {
    const cfg = config.FLOOD || {};
    // 🙋 Pessoa NUNCA é barrada por mandar comando seguido (ex.: 3 figurinhas
    // em sequência). Quem é barrado é só OUTRO BOT (anti-bot, pelo ID da msg).
    // Pra voltar o limite antigo: config.FLOOD.ATIVO = true
    if (cfg.ATIVO !== true) return "ok";
    const limite = cfg.LIMITE_COMANDOS || 6;
    const janela = (cfg.JANELA_SEG || 12) * 1000;
    const bloqueio = (cfg.BLOQUEIO_SEG || 25) * 1000;
    const k = chave(chat, pessoa);
    const agora = Date.now();

    if ((bloqueadoAte.get(k) || 0) > agora) return "ignorar";

    const lista = (historico.get(k) || []).filter(t => agora - t < janela);
    lista.push(agora);
    historico.set(k, lista);
    limpar(historico);

    if (lista.length > limite) {
        bloqueadoAte.set(k, agora + bloqueio);
        historico.delete(k);
        limpar(bloqueadoAte);
        return "avisar";
    }
    return "ok";
}

/** 👀 em qualquer mensagem que o bot vai atender (silencioso se falhar). */
async function reagir(sock, msg) {
    const emoji = config.REACAO_COMANDO === undefined ? "👀" : config.REACAO_COMANDO;
    if (!emoji) return;
    try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }); } catch {}
}

/* ⏳ AMPULHETA QUE VIRA A RESPOSTA (igual ao ping)
   • Comando que responde em TEXTO: o bot manda ⏳ e depois EDITA essa
     mesma mensagem com a resposta. Nada de "mensagem apagada".
   • Comando que responde com FOTO / FIGURINHA / ÁUDIO / CARD / BOTÕES: o
     WhatsApp não deixa editar texto em mídia. Nesses o ⏳ vai como
     REAÇÃO na mensagem do comando e volta pro 👀 quando termina — também
     sem "mensagem apagada".
   • Se um comando que não está na lista responder com mídia, o bot
     aprende sozinho e da próxima vez já usa a reação.            */
const CMDS_MIDIA = new Set([
    "menu", "menubotoes", "jogos", "menujogos", "games", "menugames", "menuadm", "menudono", "menugold", "menumidias", "brincadeiras", "menubrinquedos",
    "play", "musica", "dvcl-yt", "video", "baixarvideo", "tiktok", "instagram", "kwai", "musica-aleatoria",
    "pinterest", "dvcl-prt", "dvcl-ptr", "mediafire", "media-fire",
    "s", "sticker", "figurinha", "sf", "semfundo", "sfundo", "attp", "attp2", "attp3", "attp4", "attp5",
    "addfigurinha", "nagatoro-fig", "gif", "f", "toimg", "efeitos", "logos", "meme", "artenome", "artenomegif",
    "gtts", "tomp3", "voz", "efeitovoz", "masculino", "feminino", "crianca", "bebe", "idoso", "gigante", "esquilo",
    "grave", "demonio", "caverna", "banheiro", "igreja", "estadio", "tunel", "agua", "megafone", "walkie",
    "telefone", "eco", "radio", "alien", "fantasma", "bebado", "8bit", "distorcao", "reverso", "coral", "dueto",
    "robo", "vaporwave", "nightcore", "rapido", "lento",
    "matar", "tapa", "chute", "beijar", "abracar", "casal", "qrcode", "qr", "qr-code",
    "jogodavelha", "velha", "ttt", "configurar-bot", "configurar", "configuracao", "configuração", "config", "configglobal",
    "perfil", "rank", "enquete", "esquete", "poll", "dono", "criador"
]);
const aprendidos = new Set();          // comandos que responderam com mídia sem estar na lista
const pendentes = new Map();           // chat -> [ { key, usada } ] (ampulhetas esperando virar resposta)

function ehTextoSimples(c) {
    if (!c || typeof c !== "object" || typeof c.text !== "string") return false;
    const proibidas = ["edit", "delete", "react", "image", "video", "audio", "sticker", "document", "poll", "buttons", "sections", "templateButtons", "contacts", "location", "forward", "pin", "viewOnce"];
    return !proibidas.some(k => k in c);
}

// envolve o sendMessage UMA vez: o 1º texto do comando vira edição da ⏳
function instalarEdicao(sock) {
    if (!sock || sock.__ampulhetaEdita) return;
    sock.__ampulhetaEdita = true;
    const enviar = sock.sendMessage.bind(sock);
    sock.__enviarCru = enviar; // usado pra mandar a própria ⏳ sem passar pela edição
    sock.sendMessage = async (jid, conteudo, ...resto) => {
        try {
            const fila = pendentes.get(jid);
            const amp = fila && fila.find(a => !a.usada && a.key);
            if (amp) {
                if (ehTextoSimples(conteudo)) {
                    amp.usada = "editou";
                    const editado = { text: conteudo.text, edit: amp.key };
                    if (Array.isArray(conteudo.mentions) && conteudo.mentions.length) editado.mentions = conteudo.mentions;
                    try { return await enviar(jid, editado); }
                    catch { amp.usada = "falhou"; /* não deu pra editar: manda normal */ }
                } else if (!conteudo?.react && !conteudo?.delete && !conteudo?.edit) {
                    amp.usada = "midia"; // respondeu com mídia: ⏳ some no final
                }
            }
        } catch {}
        return enviar(jid, conteudo, ...resto);
    };
}

/**
 * ⏳ Começa a ampulheta do comando. Devolve { finalizar() }.
 * (assinatura antiga continua funcionando: iniciarAmpulheta(sock, chat, msg))
 */
function iniciarAmpulheta(sock, chat, msg, comando = "") {
    const cmd = String(comando || "").toLowerCase();

    // 🎴 resposta com mídia → ⏳ como reação (não deixa "mensagem apagada")
    if (CMDS_MIDIA.has(cmd) || aprendidos.has(cmd)) {
        try { sock.sendMessage(chat, { react: { text: "⏳", key: msg.key } }).catch(() => {}); } catch {}
        return {
            async finalizar() {
                const emoji = config.REACAO_COMANDO === undefined ? "👀" : config.REACAO_COMANDO;
                try { await sock.sendMessage(chat, { react: { text: emoji || "", key: msg.key } }); } catch {}
            }
        };
    }

    // 💬 resposta em texto → ⏳ vira a própria resposta (edição, igual ao ping)
    instalarEdicao(sock);
    const inicio = Date.now();
    const amp = { key: null, usada: false };
    if (!pendentes.has(chat)) pendentes.set(chat, []);
    pendentes.get(chat).push(amp);
    let promessa = null;
    try {
        promessa = (sock.__enviarCru || sock.sendMessage)(chat, { text: "⏳" }).then(r => { amp.key = r?.key || null; return r; }).catch(() => null);
    } catch { promessa = null; }

    return {
        async finalizar() {
            try {
                const enviada = await promessa;
                const fila = pendentes.get(chat) || [];
                const i = fila.indexOf(amp);
                if (i >= 0) fila.splice(i, 1);
                if (!fila.length) pendentes.delete(chat);
                if (amp.usada === "editou") return;          // virou a resposta 👌
                if (amp.usada === "midia" && cmd) aprendidos.add(cmd); // próxima vez: reação
                if (!enviada?.key) return;
                const falta = 700 - (Date.now() - inicio);
                if (falta > 0) await new Promise(r => setTimeout(r, falta));
                await sock.sendMessage(chat, { delete: enviada.key });
            } catch {}
        }
    };
}

module.exports = { podeResponderPrefixo, contarComando, reagir, iniciarAmpulheta };
