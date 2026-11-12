/* =================================================
   🔗 ANTILINK — NAGATORO (novo jeito)
   Liga/desliga: <prefixo>antilink  (por grupo, só ADM)

   Com o antilink LIGADO, TODO tipo de link é apagado:
     👤 membro comum → apaga a mensagem e REMOVE do grupo
     🛡️ ADM          → apaga e leva um sermão (não remove)
     👑 dono do bot  → apaga e leva um sermão carinhoso e debochado

   O dono é reconhecido pelo LID e pelo número (os dois), igual ao
   resto do bot. Nome não serve pra isso: qualquer um troca o nome.

   Exceção: comando do bot que PRECISA de link (ex.: .tiktok link,
   .play link) não é apagado — o link ali é pro bot baixar.
   Precisa que o bot seja ADM do grupo pra apagar/remover.
================================================= */
const config = require("../../config");
const B = require("../seguranca-base/seguranca-base");
const { getDBLeitura } = require("../grupo-db/grupo-db");

// links com protocolo, www, convites do WhatsApp/Telegram e "site.com/algo"
const TLDS = "com|net|org|br|me|io|gg|xyz|app|link|site|online|store|shop|info|tv|ly|co|biz|club|live|top|vip|fun|pro|dev|page|cc|ru|tk|ml|ga|cf|gq|pw|ws|bit|click|win|bet|games|space|website";
const RE_LINK = new RegExp(
    String.raw`(https?:\/\/\S+)|(\bwww\.\S+)|(\b(?:chat\.whatsapp\.com|wa\.me|whatsapp\.com\/channel|t\.me|discord\.gg|bit\.ly|tinyurl\.com)\/?\S*)|(\b[a-z0-9][a-z0-9-]{1,62}\.(?:${TLDS})(?:\.[a-z]{2})?(?:\/\S*)?(?=\s|$|[),.!?]))`,
    "i"
);

// comandos em que o link é a entrada do próprio bot
const CMDS_COM_LINK = new Set([
    "play", "musica", "dvcl-yt", "video", "baixarvideo", "tiktok", "instagram", "kwai",
    "pinterest", "dvcl-prt", "dvcl-ptr", "mediafire", "media-fire", "encurtar", "encurtador",
    "encurtarlink", "qrcode", "qr", "qr-code"
]);

const SERMAO_ADM = [
    "🛡️ @{u}, você é *ADM* e mandou link no grupo com antilink ligado? Apaguei. Dá o exemplo, né… o cargo não é enfeite. 😒",
    "🛡️ Olha só, @{u}… ADM mandando link. Se fosse membro já tava na rua. Apaguei, e fica o puxão de orelha. 🙄",
    "🛡️ @{u}, regra vale pra ADM também, tá? Link apagado. Não me faz passar vergonha na frente da galera. 😤",
    "🛡️ ADM @{u}, quem cuida do grupo não pode ser quem bagunça. Link apagado, segue o jogo… mas tô de olho. 👀"
];

const SERMAO_DONO = [
    "👑 Ai ai, @{u}… até você, *meu criador*? Apaguei o link, viu? Com carinho… mas apaguei. 😏💜",
    "👑 @{u}, senpai, você me programou pra apagar link e é o primeiro a mandar? Que fofo. Apagadinho. 🥱💜",
    "👑 Dono @{u}, regra é regra — até pra quem me criou. Apaguei com todo amor do mundo. Agora se comporta. 😘",
    "👑 @{u}… eu te amo, mas o antilink tá ligado. Link pro lixo, tá? Não me olha assim. 😌💜"
];

const AVISO_MEMBRO = [
    "🔗 @{u} mandou link com o antilink ligado e foi *removido(a)*. Aqui não é outdoor, não. 😏",
    "🔗 Link no grupo? @{u} já era. Removido(a). Próximo. 🚪",
    "🔗 @{u} achou que ia divulgar de graça… apaguei e removi. Tchau, querido(a). 👋"
];

const sortear = (l) => l[Math.floor(Math.random() * l.length)];

function temLink(texto) {
    return !!texto && RE_LINK.test(texto);
}

// junta todo texto que pode carregar link (legenda, texto, botão, link preview)
function textoCompleto(m) {
    const partes = [B.textoDe(m)];
    try {
        const e = m?.extendedTextMessage;
        if (e?.matchedText) partes.push(e.matchedText);
        if (e?.canonicalUrl) partes.push(e.canonicalUrl);
        if (m?.groupInviteMessage) partes.push("chat.whatsapp.com/convite");
        if (m?.buttonsMessage?.contentText) partes.push(m.buttonsMessage.contentText);
        if (m?.templateMessage?.hydratedTemplate?.hydratedContentText) partes.push(m.templateMessage.hydratedTemplate.hydratedContentText);
        if (m?.interactiveMessage?.body?.text) partes.push(m.interactiveMessage.body.text);
    } catch {}
    return partes.filter(Boolean).join(" \n ");
}

function ehComandoComLink(texto) {
    const P = config.PREFIX || ".";
    const t = String(texto || "").trim();
    if (!t.startsWith(P)) return false;
    const cmd = t.slice(P.length).trim().split(/\s+/)[0]?.toLowerCase();
    return CMDS_COM_LINK.has(cmd);
}

// dono? (LID + número, olhando também os dados do grupo)
function ehDonoDoBot(ids, participante) {
    const todos = [...ids, participante?.id, participante?.lid, participante?.jid, participante?.phoneNumber].filter(Boolean);
    const { ehDono } = require("../utils-validacao/utils-validacao");
    return ehDono(todos, config.OWNER_NUMBER);
}

/**
 * Chamado no nagatoro.js em toda mensagem de grupo.
 * Retorna true se a mensagem tinha link e foi tratada.
 */
async function processarAntilink(sock, msg) {
    try {
        const grupo = msg?.key?.remoteJid;
        if (!grupo?.endsWith("@g.us")) return false;
        if (!getDBLeitura()?.[grupo]?.antilink) return false;

        const m = B.conteudoReal(msg.message);
        const texto = textoCompleto(m);
        if (!temLink(texto)) return false;
        if (ehComandoComLink(B.textoDe(m))) return false;

        // mensagem do próprio número do bot só é "dono" se não for eco do bot
        const ids = [msg.key.participant, msg.key.participantAlt].filter(Boolean);
        const meus = [sock.user?.id, sock.user?.lid].filter(Boolean).map(B.norm);
        if (!msg.key.fromMe && ids.some(i => meus.includes(B.norm(i)))) return false;

        if (!(await B.botEhAdmin(sock, grupo))) return false; // sem ADM não dá pra apagar

        const meta = await B.metaGrupo(sock, grupo);
        const participante = ids.map(i => B.acharParticipante(meta, i)).find(Boolean) || null;
        const autor = participante?.id || msg.key.participant || msg.key.participantAlt;
        const u = B.norm(participante?.phoneNumber || autor);
        const mentions = [autor].filter(Boolean);

        await B.apagar(sock, grupo, msg.key);

        if (msg.key.fromMe || ehDonoDoBot(ids, participante)) {
            await B.enviar(sock, grupo, { text: `${sortear(SERMAO_DONO).replace("{u}", u)}\n\n${B.rodape()}`, mentions });
            return true;
        }

        if (participante?.admin) {
            await B.enviar(sock, grupo, { text: `${sortear(SERMAO_ADM).replace("{u}", u)}\n\n${B.rodape()}`, mentions });
            return true;
        }

        const saiu = await B.remover(sock, grupo, autor);
        try { B.limparCacheMeta(grupo); } catch {}
        await B.enviar(sock, grupo, {
            text: saiu
                ? `〔 🚫 ᴀɴᴛɪ-ʟɪɴᴋ 〕\n\n${sortear(AVISO_MEMBRO).replace("{u}", u)}\n\n${B.rodape()}`
                : `〔 🚫 ᴀɴᴛɪ-ʟɪɴᴋ 〕\n\n🔗 @${u}, link não pode aqui. Apaguei sua mensagem.\n\n${B.rodape()}`,
            mentions
        });
        return true;
    } catch (e) {
        console.error("⚠️ [antilink] erro (contido):", e?.message || e);
        return false;
    }
}

module.exports = { processarAntilink, temLink };
