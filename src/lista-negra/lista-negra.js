/* =================================================
   🚫 LISTA NEGRA — NAGATORO (uma lista só por grupo)

   Junta num lugar só:
     • a lista do comando <prefixo>lista (db[grupo].blacklist)
     • a lista do antir (quem insistiu demais nas solicitações)
   Assim quem cai por um caminho é barrado pelos dois.

   <prefixo>lista NÚMERO   (ou marcando / respondendo a pessoa)
     • está no grupo  → entra na lista e é removido na hora
     • não está       → entra na lista mesmo assim (prevenção);
                        se um dia entrar, é removido
   <prefixo>lista               → mostra a lista
   <prefixo>tirarlista NÚMERO   → tira da lista

   Também:
     • solicitação de entrada de quem está na lista → recusada
     • alguém da lista entrou (ou mandou mensagem)  → removido
   O dono do bot e o próprio bot nunca entram na lista.
================================================= */
const config = require("../../config");
const B = require("../seguranca-base/seguranca-base");
const { getDB, saveDB, getDBLeitura } = require("../grupo-db/grupo-db");

const soNum = (v) => String(v || "").split(":")[0].split("@")[0].replace(/\D/g, "");

// ids possíveis de um participante (lid + número)
function idsDoParticipante(p) {
    if (!p) return [];
    if (typeof p === "string") return [soNum(p)].filter(Boolean);
    return [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).map(soNum).filter(Boolean);
}

function bate(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    // número com/sem DDI (mín. 10 dígitos pra não dar falso positivo)
    const menor = a.length < b.length ? a : b;
    const maior = a.length < b.length ? b : a;
    return menor.length >= 10 && maior.endsWith(menor);
}

function listaDoGrupo(grupo) {
    try {
        const db = getDBLeitura();
        const a = Array.isArray(db?.[grupo]?.blacklist) ? db[grupo].blacklist : [];
        const b = Array.isArray(db?.[grupo]?.seg?.antir?.negra) ? db[grupo].seg.antir.negra : [];
        return [...new Set([...a, ...b].map(soNum).filter(Boolean))];
    } catch { return []; }
}

/** true se QUALQUER um dos ids está na lista negra do grupo */
function estaNaLista(grupo, ids) {
    const lista = listaDoGrupo(grupo);
    const cands = (Array.isArray(ids) ? ids : [ids]).map(soNum).filter(Boolean);
    return cands.some(c => lista.some(n => bate(c, n)));
}

function adicionar(grupo, ...numeros) {
    const db = getDB();
    db[grupo] ||= {};
    db[grupo].blacklist ||= [];
    for (const n of numeros.map(soNum).filter(Boolean)) {
        if (!db[grupo].blacklist.includes(n)) db[grupo].blacklist.push(n);
    }
    db[grupo].blacklist = db[grupo].blacklist.slice(-2000);
    saveDB(db);
}

function remover(grupo, numero) {
    const n = soNum(numero);
    if (!n) return false;
    const db = getDB();
    if (!db[grupo]) return false;
    const antes = (db[grupo].blacklist || []).length + (db[grupo].seg?.antir?.negra || []).length;
    db[grupo].blacklist = (db[grupo].blacklist || []).filter(x => !bate(soNum(x), n));
    if (db[grupo].seg?.antir?.negra) db[grupo].seg.antir.negra = db[grupo].seg.antir.negra.filter(x => !bate(soNum(x), n));
    saveDB(db);
    return antes !== (db[grupo].blacklist.length + (db[grupo].seg?.antir?.negra || []).length);
}

// acha a pessoa dentro do grupo pelo número/lid
function acharNoGrupo(meta, numero) {
    const n = soNum(numero);
    return (meta?.participants || []).find(p => idsDoParticipante(p).some(i => bate(i, n))) || null;
}

async function tirarDoGrupo(sock, grupo, participante) {
    const jid = typeof participante === "string" ? participante : (participante.id || participante.lid || participante.jid);
    return B.remover(sock, grupo, jid);
}

// ==================================================
// ⚙️ COMANDO <prefixo>lista
// ==================================================
async function cmdLista(sock, msg, args = []) {
    const grupo = msg.key.remoteJid;
    const P = config.PREFIX;
    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    let alvo = ctx.mentionedJid?.[0] || (args.length ? null : ctx.participant) || null;
    let numero = soNum(args.join(""));
    if (!numero && alvo) numero = soNum(alvo);

    // sem número → mostra a lista
    if (!numero) {
        const lista = listaDoGrupo(grupo);
        return B.enviar(sock, grupo, {
            text: lista.length
                ? `〔 🚫 ʟɪsᴛᴀ ɴᴇɢʀᴀ 〕\n\n${lista.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n❀ ${P}lista NÚMERO — adiciona\n❀ ${P}tirarlista NÚMERO — tira\n\n${B.rodape()}`
                : `✅ A lista negra deste grupo está vazia.\n\n❀ ${P}lista NÚMERO — adiciona`
        }, { quoted: msg });
    }
    if (numero.length < 8) {
        return B.enviar(sock, grupo, { text: `❌ Número inválido. Ex.: *${P}lista 5516999999999*` }, { quoted: msg });
    }

    const meta = await B.metaGrupo(sock, grupo, true);
    const participante = acharNoGrupo(meta, numero);
    const idsAlvo = participante ? idsDoParticipante(participante) : [numero];

    if (B.ehIntocavel(sock, [numero, ...idsAlvo])) {
        return B.enviar(sock, grupo, { text: "😏 Esse aí é o meu dono (ou eu mesma). Na lista negra não entra, não." }, { quoted: msg });
    }

    // guarda o número digitado + os ids reais (lid/número) se achou no grupo
    adicionar(grupo, numero, ...idsAlvo);

    if (!participante) {
        return B.enviar(sock, grupo, {
            text: `〔 🚫 ʟɪsᴛᴀ ɴᴇɢʀᴀ 〕\n\n📵 *${numero}* foi pra lista negra.\n🔎 Não encontrei esse número no grupo agora — mas ele fica guardado.\n🚪 Se tentar entrar ou pedir pra entrar, eu removo/recuso na hora.\n\n${B.rodape()}`
        }, { quoted: msg });
    }

    const jidMostrar = participante.phoneNumber || participante.id;
    const temAdm = await B.botEhAdmin(sock, grupo);
    const saiu = temAdm ? await tirarDoGrupo(sock, grupo, participante) : false;
    try { B.limparCacheMeta(grupo); } catch {}
    return B.enviar(sock, grupo, {
        text: `〔 🚫 ʟɪsᴛᴀ ɴᴇɢʀᴀ 〕\n\n👤 @${soNum(jidMostrar)} foi pra lista negra.\n` +
            (saiu ? "🦶 Encontrei no grupo e já removi." : "⚠️ Encontrei no grupo, mas não consegui remover — preciso ser *admin*.") +
            `\n🚪 Se voltar, é removido de novo.\n\n${B.rodape()}`,
        mentions: [participante.id].filter(Boolean)
    }, { quoted: msg });
}

async function cmdTirarLista(sock, msg, args = []) {
    const grupo = msg.key.remoteJid;
    const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
    const numero = soNum(args.join("")) || soNum(ctx.mentionedJid?.[0] || ctx.participant);
    if (!numero) return B.enviar(sock, grupo, { text: `Use: *${config.PREFIX}tirarlista NÚMERO*` }, { quoted: msg });
    const tirou = remover(grupo, numero);
    return B.enviar(sock, grupo, { text: tirou ? `✅ *${numero}* saiu da lista negra.` : `ℹ️ *${numero}* não estava na lista negra.` }, { quoted: msg });
}

// ==================================================
// 🚪 ALGUÉM DA LISTA ENTROU → remove (group-participants.update)
// ==================================================
async function tratarEntradaLista(sock, evento) {
    try {
        const grupo = evento?.id;
        if (!grupo?.endsWith("@g.us") || evento.action !== "add") return;
        if (!listaDoGrupo(grupo).length) return;
        for (const p of evento.participants || []) {
            const ids = idsDoParticipante(p);
            if (!estaNaLista(grupo, ids) || B.ehIntocavel(sock, ids)) continue;
            if (!(await B.botEhAdmin(sock, grupo))) {
                console.log(`🚫 [lista negra] ${ids[0]} entrou em ${grupo}, mas não sou admin pra remover.`);
                continue;
            }
            const jid = typeof p === "string" ? p : p.id;
            const ok = await B.remover(sock, grupo, jid);
            await B.enviar(sock, grupo, {
                text: `〔 🚫 ʟɪsᴛᴀ ɴᴇɢʀᴀ 〕\n\n👤 @${soNum((typeof p === "object" && p.phoneNumber) || jid)} tá na lista negra deste grupo.\n${ok ? "🦶 Removido(a) na hora. Aqui não, querido(a). 😏" : "⚠️ Não consegui remover."}\n\n${B.rodape()}`,
                mentions: [jid]
            });
        }
    } catch (e) {
        console.error("⚠️ [lista negra] entrada (contido):", e?.message || e);
    }
}

// ==================================================
// 💬 ALGUÉM DA LISTA MANDOU MENSAGEM → apaga e remove
// ==================================================
async function processarMensagemLista(sock, msg) {
    try {
        const grupo = msg?.key?.remoteJid;
        if (!grupo?.endsWith("@g.us") || msg.key.fromMe) return false;
        const ids = [msg.key.participant, msg.key.participantAlt].filter(Boolean);
        if (!estaNaLista(grupo, ids) || B.ehIntocavel(sock, ids)) return false;
        await B.apagar(sock, grupo, msg.key);
        if (await B.botEhAdmin(sock, grupo)) await B.remover(sock, grupo, msg.key.participant || msg.key.participantAlt);
        return true;
    } catch { return false; }
}

module.exports = { cmdLista, cmdTirarLista, estaNaLista, adicionar, remover, listaDoGrupo, tratarEntradaLista, processarMensagemLista, soNum, idsDoParticipante };
