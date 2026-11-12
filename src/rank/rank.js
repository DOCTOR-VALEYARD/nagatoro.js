/* =================================================
   🏆 NAGATORO — RANKING (do grupo, não do bot inteiro)
   📁 Arquivo: rank.js
   Manda o CARD (foto do grupo + vidro com o TOP 10) e uma legenda curta.
   No PV mostra o ranking geral.
================================================= */
const fs = require("fs");
const path = require("path");
const config = require("../../config");

const dbPath = path.join(__dirname, "../../database/usuarios.json");
const num = (j) => String(j || "").split("@")[0].split(":")[0];

function lerDB() {
    try { return fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, "utf8") || "{}") : {}; } catch { return {}; }
}

const DEBOCHE_TOPO = [
    "😏 @{1} no topo. Parabéns, viciado(a) em grupo.",
    "👑 @{1} lidera. O resto tá aí só de enfeite~",
    "🙄 @{1} em primeiro de novo? Vai tocar uma grama, pelo amor.",
    "🏆 Salve @{1}, rei/rainha da tagarelice."
];
const DEBOCHE_FIM = [
    "E você que não apareceu aí… tenta mandar mais que um 'kkk' 🥱",
    "Quem não tá no top 10: tá me devendo atividade 😌",
    "Fala mais no grupo que eu te ponho aqui. Talvez~"
];
const sortear = (l) => l[Math.floor(Math.random() * l.length)];

async function rank(sock, msg, args) {
    const from = msg.key.remoteJid;
    const ehGrupo = from.endsWith("@g.us");
    const db = lerDB();

    let meta = null;
    if (ehGrupo) { try { meta = await sock.groupMetadata(from); } catch {} }

    // junta cada usuário salvo com quem está no grupo (por lid OU número)
    let entradas = Object.entries(db).map(([jid, u]) => ({ jid, ...u }));
    if (meta) {
        const mapa = new Map();
        for (const p of meta.participants || []) for (const v of [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean)) mapa.set(num(v), p);
        entradas = entradas.filter(e => mapa.has(num(e.jid))).map(e => ({ ...e, part: mapa.get(num(e.jid)) }));
        // tira duplicado (mesma pessoa salva por lid e por número)
        const vistos = new Set(); entradas = entradas.filter(e => { const k = num(e.part.id); if (vistos.has(k)) return false; vistos.add(k); return true; });
    }
    entradas.sort((a, b) => (b.nivel || 0) - (a.nivel || 0) || (b.xp || 0) - (a.xp || 0));
    const top = entradas.slice(0, 10);

    if (!top.length) {
        return sock.sendMessage(from, { text: `🏆 Ninguém no ranking ainda.\nConversem mais (ou usem ${config.PREFIX}registrar) que eu começo a contar 😏` }, { quoted: msg });
    }

    const medalha = ["🥇", "🥈", "🥉"];
    const mencoes = top.map(e => e.part?.id || e.jid);
    const linhas = top.map((e, i) => `${medalha[i] || (i + 1) + "."} @${num(e.part?.phoneNumber || e.part?.id || e.jid)} · nv ${e.nivel || 1} · ${Number(e.xp || 0).toLocaleString("pt-BR")} xp`);
    const legenda = `🏆 *RANKING${meta ? " · " + (meta.subject || "GRUPO").toUpperCase() : " GERAL"}*\n\n${linhas.join("\n")}\n\n${sortear(DEBOCHE_TOPO).replace("{1}", num(top[0].part?.phoneNumber || top[0].part?.id || top[0].jid))}\n${sortear(DEBOCHE_FIM)}`;

    // 🖼️ card
    let card = null;
    if (args?.[0] !== "jornal") try {
        let fotoGrupo = null;
        if (ehGrupo) {
            try {
                const url = await sock.profilePictureUrl(from, "image");
                if (url) fotoGrupo = await require("../cardGenerator/cardGenerator").baixarBuffer(url);
            } catch {}
        }
        const { gerarCardRanking } = require("./rank-card");
        card = await gerarCardRanking({
            grupo: meta?.subject || "Ranking geral",
            membros: meta?.participants?.length || entradas.length,
            fotoGrupo,
            lista: top.map(e => ({ nome: e.nome || e.part?.notify || ("+" + num(e.part?.phoneNumber || e.jid)), nivel: e.nivel || 1, xp: e.xp || 0 }))
        });
    } catch (e) { console.error("⚠️ card do ranking:", e?.message || e); }

    // 📰 veio do botão "MAIS NO JORNAL": card da Nagatoro + legenda curtinha
    if (args?.[0] === "jornal") {
        try {
            let fotoGrupo = null;
            if (ehGrupo) { try { fotoGrupo = await require("../cardGenerator/cardGenerator").baixarBuffer(await sock.profilePictureUrl(from, "image")); } catch {} }
            const { criarCardRankJornal } = require("../cards-nagatoro/cards-nagatoro");
            const png = await criarCardRankJornal({
                fotoGrupoBuffer: fotoGrupo, nomeGrupo: meta?.subject || "Ranking geral",
                lista: top.map(e => ({ nome: e.nome || e.part?.notify || ("+" + num(e.part?.phoneNumber || e.jid)), nivel: e.nivel || 1, xp: e.xp || 0 }))
            });
            const { RODAPE_CRIADOR } = require("../boasvindas-mensagens/boasvindas-mensagens");
            const top3 = top.slice(0, 3).map((e, i) => `> ❲ ${medalha[i]} ❳  @${num(e.part?.phoneNumber || e.part?.id || e.jid)}`);
            const curta = [`> ❲ ⛮ ❳  ʀᴀɴᴋɪɴɢ ᴅᴏ ɢʀᴜᴘᴏ  ❲ ⛮ ❳`, ...top3, ``, `> ${RODAPE_CRIADOR}`].join("\n");
            return await sock.sendMessage(from, { image: png, caption: curta, mentions: mencoes.slice(0, 3) }, { quoted: msg });
        } catch (e) { console.error("⚠️ card do ranking (jornal):", e?.message || e); }
    }

    if (card) return sock.sendMessage(from, { image: card, caption: legenda, mentions: mencoes }, { quoted: msg });
    return sock.sendMessage(from, { text: legenda, mentions: mencoes }, { quoted: msg });
}

module.exports = { rank };
