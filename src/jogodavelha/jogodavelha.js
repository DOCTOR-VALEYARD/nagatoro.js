/* =================================================
   ⭕ JOGO DA VELHA — NAGATORO (refeito)

   O que estava quebrado e foi corrigido:
     • O tabuleiro era desenhado com │ ┼ ─ — o estilo de texto do bot
       apaga esses caracteres (tira "caixinhas"), então o tabuleiro
       chegava todo torto/vazio. Agora é feito só com emojis.
     • Jogador era comparado por UM id só. No WhatsApp novo (LID) a
       mesma pessoa aparece como @lid numa hora e @s.whatsapp.net na
       outra, aí o bot dizia "a partida não é sua" / "não é sua vez".
       Agora cada jogador guarda TODOS os ids dele (lid + número).
     • Partida abandonada travava o grupo pra sempre. Agora expira
       sozinha depois de 5 minutos parada.

   Como jogar:
     <prefixo>jogodavelha @pessoa   (ou responda a mensagem da pessoa)
     <prefixo>jogodavelha bot       (joga contra a Nagatoro)
     Na sua vez: toque em 🎯 ESCOLHER CASA, ou mande só o número (1 a 9),
     ou <prefixo>jogodavelha 5.
     <prefixo>jogodavelha cancelar
================================================= */
const config = require("../../config");

const jogos = new Map();               // grupo -> partida
const EXPIRA_MS = 5 * 60 * 1000;       // 5 min parada = acabou
const VITORIAS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];
const NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

// ───────── utilidades ─────────
const norm = (id) => String(id || "").split(":")[0].split("@")[0].replace(/\D/g, "");

function renderizarTabuleiro(tab) {
    const c = tab.map((v, i) => v === "X" ? "❌" : v === "O" ? "⭕" : NUM[i]);
    return `${c[0]}${c[1]}${c[2]}\n${c[3]}${c[4]}${c[5]}\n${c[6]}${c[7]}${c[8]}`;
}

function vencedor(tab) {
    for (const [a, b, c] of VITORIAS) {
        if (tab[a] && tab[a] === tab[b] && tab[a] === tab[c]) return tab[a];
    }
    return null;
}

function idsDaMensagem(msg) {
    return [msg?.key?.participant, msg?.key?.participantAlt, msg?.key?.remoteJid]
        .filter(Boolean).map(norm).filter(Boolean);
}

function ehJogador(jogador, ids) {
    return !!jogador && ids.some(i => jogador.ids.includes(i));
}

// Junta lid + número da pessoa olhando os dados do grupo
async function montarJogador(sock, grupo, jid) {
    const ids = new Set([norm(jid)]);
    try {
        const meta = await sock.groupMetadata(grupo);
        const p = (meta?.participants || []).find(x =>
            [x.id, x.lid, x.jid, x.phoneNumber].filter(Boolean).some(v => norm(v) === norm(jid)));
        if (p) [p.id, p.lid, p.jid, p.phoneNumber].filter(Boolean).forEach(v => ids.add(norm(v)));
    } catch {}
    ids.delete("");
    return { jid, ids: [...ids] };
}

function partidaAtiva(grupo) {
    const j = jogos.get(grupo);
    if (!j) return null;
    if (Date.now() - j.ultimo > EXPIRA_MS) { jogos.delete(grupo); return null; }
    return j;
}

// ───────── jogada da Nagatoro (ganha → bloqueia → centro → canto → qualquer) ─────────
function jogadaDoBot(tab) {
    const livres = tab.map((v, i) => v ? null : i).filter(i => i !== null);
    const testa = (simbolo) => {
        for (const i of livres) {
            const copia = [...tab]; copia[i] = simbolo;
            if (vencedor(copia) === simbolo) return i;
        }
        return null;
    };
    let i = testa("O");
    if (i === null) i = testa("X");
    if (i === null && !tab[4]) i = 4;
    if (i === null) {
        const cantos = [0, 2, 6, 8].filter(c => !tab[c]);
        if (cantos.length) i = cantos[Math.floor(Math.random() * cantos.length)];
    }
    if (i === null) i = livres[Math.floor(Math.random() * livres.length)];
    return i;
}

// ───────── envio (com botão de escolher casa; se o botão falhar, vai texto) ─────────
async function enviarTabuleiro(sock, grupo, jogo, texto, mentions, quoted) {
    const livres = jogo.tabuleiro.map((v, i) => v ? null : i).filter(i => i !== null);
    if (livres.length) {
        try {
            const { enviarNativeFlow } = require("../menuBotoes/menuBotoes");
            const rows = livres.map(i => ({ header: "", title: `${NUM[i]} CASA ${i + 1}`, description: "Marcar essa casa", id: `velha:${i + 1}` }));
            await enviarNativeFlow(sock, grupo, {
                text: texto,
                footer: `🧣 ${config.BOT_NAME || "Nagatoro"}`,
                quoted,
                mentions,
                buttons: [
                    { name: "single_select", buttonParamsJson: JSON.stringify({ title: "🎯 ESCOLHER CASA", sections: [{ title: "⭕ CASAS LIVRES", highlight_label: "", rows }] }) },
                    { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🛑 DESISTIR", id: "velha:cancelar" }) }
                ]
            });
            return;
        } catch (e) {
            console.error("⚠️ jogo da velha: botão falhou, mandando texto:", e?.message || e);
        }
    }
    await sock.sendMessage(grupo, { text: texto, mentions }, quoted ? { quoted } : undefined);
}

const tag = (jogador) => jogador.bot ? `${config.BOT_NAME || "Nagatoro"} 🤖` : `@${norm(jogador.jid)}`;
const mencoes = (...js) => js.filter(j => j && !j.bot).map(j => j.jid);

// ───────── aplica uma jogada (de quem mandou a msg) ─────────
async function jogar(sock, msg, posicao) {
    const grupo = msg.key.remoteJid;
    const jogo = partidaAtiva(grupo);
    if (!jogo) return false;
    const ids = idsDaMensagem(msg);
    const daVez = jogo.turno === "X" ? jogo.x : jogo.o;
    const prefixo = config.PREFIX || ".";

    if (!ehJogador(jogo.x, ids) && !ehJogador(jogo.o, ids)) {
        await sock.sendMessage(grupo, { text: "👀 Essa partida não é sua, senpai. Espera acabar e chama alguém pra jogar." }, { quoted: msg });
        return true;
    }
    if (!ehJogador(daVez, ids)) {
        await sock.sendMessage(grupo, { text: `⏳ Calma, ainda é a vez de ${tag(daVez)}.`, mentions: mencoes(daVez) }, { quoted: msg });
        return true;
    }
    if (!Number.isInteger(posicao) || posicao < 1 || posicao > 9) {
        await sock.sendMessage(grupo, { text: `Escolhe uma casa de 1 a 9. Pra desistir: *${prefixo}jogodavelha cancelar*` }, { quoted: msg });
        return true;
    }
    if (jogo.tabuleiro[posicao - 1]) {
        await sock.sendMessage(grupo, { text: "🚫 Essa casa já tá ocupada. Escolhe outra livre." }, { quoted: msg });
        return true;
    }

    jogo.tabuleiro[posicao - 1] = jogo.turno;
    jogo.ultimo = Date.now();
    if (await terminou(sock, grupo, jogo, msg)) return true;
    jogo.turno = jogo.turno === "X" ? "O" : "X";

    // vez da Nagatoro
    const agora = jogo.turno === "X" ? jogo.x : jogo.o;
    if (agora.bot) {
        const i = jogadaDoBot(jogo.tabuleiro);
        jogo.tabuleiro[i] = jogo.turno;
        if (await terminou(sock, grupo, jogo, msg, i + 1)) return true;
        jogo.turno = jogo.turno === "X" ? "O" : "X";
        const humano = jogo.turno === "X" ? jogo.x : jogo.o;
        await enviarTabuleiro(sock, grupo, jogo,
            `⭕ *JOGO DA VELHA*\n\n🤖 Marquei a casa *${i + 1}*. Tua vez, ${tag(humano)} 😏\n\n${renderizarTabuleiro(jogo.tabuleiro)}`,
            mencoes(humano), msg);
        return true;
    }

    await enviarTabuleiro(sock, grupo, jogo,
        `⭕ *JOGO DA VELHA*\n\n${renderizarTabuleiro(jogo.tabuleiro)}\n\nVez de ${jogo.turno === "X" ? "❌" : "⭕"} ${tag(agora)}`,
        mencoes(agora), msg);
    return true;
}

async function terminou(sock, grupo, jogo, msg, casaBot = null) {
    const ganhou = vencedor(jogo.tabuleiro);
    const extra = casaBot ? `🤖 Marquei a casa *${casaBot}*.\n\n` : "";
    if (ganhou) {
        jogos.delete(grupo);
        const venc = ganhou === "X" ? jogo.x : jogo.o;
        const frase = venc.bot ? "Ganhei, senpai. Fraquinho 😏" : `Parabéns, ${tag(venc)}! 🏆`;
        await sock.sendMessage(grupo, {
            text: `🏆 *FIM DE JOGO — ${ganhou === "X" ? "❌" : "⭕"} VENCEU!*\n\n${extra}${renderizarTabuleiro(jogo.tabuleiro)}\n\n${frase}`,
            mentions: mencoes(jogo.x, jogo.o)
        }, { quoted: msg });
        return true;
    }
    if (jogo.tabuleiro.every(Boolean)) {
        jogos.delete(grupo);
        await sock.sendMessage(grupo, {
            text: `🤝 *DEU VELHA!*\n\n${extra}${renderizarTabuleiro(jogo.tabuleiro)}\n\nNinguém ganhou dessa vez.`,
            mentions: mencoes(jogo.x, jogo.o)
        }, { quoted: msg });
        return true;
    }
    return false;
}

async function cancelar(sock, msg) {
    const grupo = msg.key.remoteJid;
    const jogo = partidaAtiva(grupo);
    if (!jogo) return sock.sendMessage(grupo, { text: "Não tem partida rolando agora." }, { quoted: msg });
    const ids = idsDaMensagem(msg);
    let pode = ehJogador(jogo.x, ids) || ehJogador(jogo.o, ids);
    if (!pode) {
        try { pode = await require("../grupo/grupo").isAdmin(sock, grupo, msg.key.participant || msg.key.participantAlt); } catch {}
    }
    if (!pode) return sock.sendMessage(grupo, { text: "Só quem tá jogando (ou um ADM) pode cancelar." }, { quoted: msg });
    jogos.delete(grupo);
    return sock.sendMessage(grupo, { text: "🛑 Partida de jogo da velha cancelada." }, { quoted: msg });
}

// ───────── comando <prefixo>jogodavelha ─────────
async function jogodavelha(sock, msg, args = []) {
    const grupo = msg?.key?.remoteJid;
    if (!grupo) return;
    const prefixo = config.PREFIX || ".";
    if (!grupo.endsWith("@g.us")) return sock.sendMessage(grupo, { text: "⭕ O jogo da velha é só em grupo." }, { quoted: msg });

    const sub = String(args[0] || "").toLowerCase();
    if (["cancelar", "parar", "desistir", "sair"].includes(sub)) return cancelar(sock, msg);

    const jogo = partidaAtiva(grupo);
    if (jogo) {
        if (/^[1-9]$/.test(sub)) return jogar(sock, msg, Number(sub));
        return enviarTabuleiro(sock, grupo, jogo,
            `⭕ *JÁ TEM PARTIDA ROLANDO*\n\n❌ ${tag(jogo.x)}\n⭕ ${tag(jogo.o)}\n\n${renderizarTabuleiro(jogo.tabuleiro)}\n\nVez de ${jogo.turno === "X" ? "❌" : "⭕"} ${tag(jogo.turno === "X" ? jogo.x : jogo.o)}`,
            mencoes(jogo.x, jogo.o), msg);
    }

    const ctx = msg?.message?.extendedTextMessage?.contextInfo || {};
    const autorJid = msg.key.participant || msg.key.participantAlt;
    const contraBot = ["bot", "nagatoro", "ia"].includes(sub);
    const alvoJid = contraBot ? null : (ctx.mentionedJid?.[0] || ctx.participant || null);

    if (!contraBot && !alvoJid) {
        return sock.sendMessage(grupo, {
            text: `⭕ *JOGO DA VELHA*\n\n👥 Contra alguém: *${prefixo}jogodavelha @pessoa*\n(ou responda a mensagem da pessoa)\n\n🤖 Contra mim: *${prefixo}jogodavelha bot*\n\nNa sua vez é só tocar em 🎯 ESCOLHER CASA ou mandar o número da casa (1 a 9).`
        }, { quoted: msg });
    }

    const x = await montarJogador(sock, grupo, autorJid);
    let o;
    if (contraBot) {
        o = { jid: sock.user?.id, ids: [norm(sock.user?.id), norm(sock.user?.lid)].filter(Boolean), bot: true };
    } else {
        o = await montarJogador(sock, grupo, alvoJid);
        const meuId = [norm(sock.user?.id), norm(sock.user?.lid)];
        if (o.ids.some(i => meuId.includes(i))) { o.bot = true; o.jid = sock.user?.id; }
        if (o.ids.some(i => x.ids.includes(i))) {
            return sock.sendMessage(grupo, { text: "😏 Jogar contra você mesmo? Marca outra pessoa (ou usa *bot*)." }, { quoted: msg });
        }
    }

    const novo = { x, o, turno: "X", tabuleiro: Array(9).fill(null), ultimo: Date.now() };
    jogos.set(grupo, novo);
    return enviarTabuleiro(sock, grupo, novo,
        `⭕ *PARTIDA INICIADA*\n\n❌ ${tag(x)}\n⭕ ${tag(o)}\n\n${renderizarTabuleiro(novo.tabuleiro)}\n\nComeça ❌ ${tag(x)}. Toca em 🎯 ESCOLHER CASA ou manda o número.`,
        mencoes(x, o), msg);
}

/**
 * Chamado pelo nagatoro.js em toda mensagem de grupo SEM prefixo.
 * Se tem partida e a pessoa da vez mandou só um número (1-9), joga.
 * Retorna true se tratou a mensagem.
 */
async function processarJogadaVelha(sock, msg, body) {
    try {
        const grupo = msg?.key?.remoteJid;
        if (!grupo?.endsWith("@g.us")) return false;
        const t = String(body || "").trim();
        if (!/^[1-9]$/.test(t)) return false;
        const jogo = partidaAtiva(grupo);
        if (!jogo) return false;
        const ids = idsDaMensagem(msg);
        // número solto de quem NÃO está jogando segue normal (não atrapalha a conversa)
        if (!ehJogador(jogo.x, ids) && !ehJogador(jogo.o, ids)) return false;
        return await jogar(sock, msg, Number(t));
    } catch (e) {
        console.error("⚠️ jogo da velha (jogada):", e?.message || e);
        return false;
    }
}

/** Clique nos botões (id "velha:5" ou "velha:cancelar"). */
async function processarBotaoVelha(sock, msg, idBotao) {
    try {
        const v = String(idBotao || "").slice("velha:".length);
        if (v === "cancelar") { await cancelar(sock, msg); return true; }
        if (!partidaAtiva(msg.key.remoteJid)) {
            await sock.sendMessage(msg.key.remoteJid, { text: `Essa partida já acabou. Começa outra com *${config.PREFIX}jogodavelha @pessoa*.` }, { quoted: msg });
            return true;
        }
        return await jogar(sock, msg, Number(v));
    } catch (e) {
        console.error("⚠️ jogo da velha (botão):", e?.message || e);
        return false;
    }
}

module.exports = { jogodavelha, processarJogadaVelha, processarBotaoVelha, renderizarTabuleiro, vencedor };
