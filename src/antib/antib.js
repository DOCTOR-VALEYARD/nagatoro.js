/* =================================================
   🧯 ANTIB — PROTEÇÃO CONTRA ERROS / TRAVAS
   Comando: <prefixo>antib

   Proteção contra mensagens malformadas que podem travar o processo:

   1) ESCUDO GLOBAL (sempre ligado, não depende de comando):
      • Mensagens-bomba ("trava": texto gigante, enxurrada de caracteres
        invisíveis/combinando — zalgo —, muitos emojis/variações) são
        detectadas ANTES de qualquer comando e o bot para de processar
        aquela mensagem. Assim uma trava num grupo não derruba o bot nos
        outros (é um processo só rodando vários grupos).
      • Falhas de comandos são registradas no console, mas não geram castigo,
        bloqueio temporário nem punição por frequência para o remetente.

   2) AÇÕES VISÍVEIS (ligadas por grupo com <prefixo>antib on):
      quando o bot é admin, apaga a trava do grupo e avisa quem mandou
      (com o tipo e o tamanho), sem repassar o conteúdo. Reincidência
      remove. NÃO repassa a trava e NÃO reage a bom dia/boa tarde/boa noite.
================================================= */
const config = require("../../config");
const B = require("../seguranca-base/seguranca-base");

const SISTEMA = "antib";
const PADRAO = { on: false, kick: true, limite: 2, strikes: {} };

// Limites do escudo
const LIMITE_TEXTO = 6000;        // acima disso já é anormal p/ chat
const LIMITE_COMBINANTES = 180;   // marcas combinantes (zalgo)
const LIMITE_INVISIVEIS = 60;     // caracteres de controle/invisíveis

const avisados = B.mapaLimitado(2000);

// Palavras de saudação que NUNCA podem ser tratadas como trava
const RE_SAUDACAO = /\b(bom\s*dia|boa\s*tarde|boa\s*noite|oi|ola|olá|eae|salve)\b/i;

// ── Mede as características de trava do texto ──
function medirTrava(texto) {
    if (!texto) return null;
    const tam = texto.length;
    // marcas combinantes (zalgo)
    const combinantes = (texto.match(/[̀-ͯ҃-҉᪰-᫿᷀-᷿⃐-⃿︠-︯]/g) || []).length;
    // invisíveis / controle / joiners
    const invisiveis = (texto.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‏‪-‮⁠-⁤⁪-⁯﻿￹-￻]/g) || []).length;
    // sequência de variações/emojis exagerada
    const variacoes = (texto.match(/[︀-️\u{E0000}-\u{E007F}]/gu) || []).length;

    if (tam >= LIMITE_TEXTO) return { motivo: "mensagem gigante", detalhe: `${tam} caracteres` };
    if (combinantes >= LIMITE_COMBINANTES) return { motivo: "texto corrompido (zalgo)", detalhe: `${combinantes} marcas` };
    if (invisiveis >= LIMITE_INVISIVEIS) return { motivo: "enxurrada de caracteres invisíveis", detalhe: `${invisiveis} ocultos` };
    if (variacoes >= 400) return { motivo: "excesso de variações/emojis", detalhe: `${variacoes} marcas` };
    // densidade de combinantes em texto curto também trava
    if (tam > 0 && combinantes / tam > 0.5 && combinantes > 40) return { motivo: "texto corrompido (zalgo)", detalhe: `${combinantes} marcas` };
    return null;
}

// ==================================================
// 🛡️ ESCUDO — chamado BEM no começo do messages.upsert.
// Retorna true se a mensagem é uma trava (o bot deve parar de processá-la).
// ==================================================
async function escudoAntib(sock, msg) {
    try {
        const grupo = msg?.key?.remoteJid;
        if (!grupo) return false;

        const m = B.conteudoReal(msg.message);
        const texto = B.textoDe(m);

        // Saudação normal nunca é trava (mesmo se vier longa)
        if (RE_SAUDACAO.test(texto) && texto.length < LIMITE_TEXTO) {
            const t = medirTrava(texto);
            if (!t || t.motivo === "mensagem gigante") return false;
        }

        const t = medirTrava(texto);
        if (!t) return false;

        // É trava: o bot já para por aqui (não cai, só não processa).
        if (!grupo.endsWith("@g.us") || msg.key.fromMe) return true;

        const autor = B.autorMsg(msg);
        if (await B.ehAdminGrupo(sock, grupo, [autor, msg.key.participantAlt])) return true;

        const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
        if (!cfg.on) return true;                         // escudo segurou; ações visíveis desligadas
        if (!(await B.botEhAdmin(sock, grupo))) return true;
        if (avisados.has(msg.key.id)) return true;
        avisados.set(msg.key.id, true);

        await B.apagar(sock, grupo, msg.key);

        const chave = B.norm(autor);
        const atual = B.lerCfg(grupo, SISTEMA, PADRAO);
        const strikes = { ...(atual.strikes || {}) };
        strikes[chave] = (strikes[chave] || 0) + 1;
        const limite = Math.max(1, Number(atual.limite) || 2);
        let removido = false;
        if (atual.kick && strikes[chave] >= limite) {
            removido = await B.remover(sock, grupo, autor);
            if (removido) delete strikes[chave];
        }
        B.salvarCfg(grupo, SISTEMA, { strikes });

        await B.enviar(sock, grupo, {
            text: `〔 🧯 ᴀɴᴛɪʙ — ᴛʀᴀᴠᴀ ʙʟᴏϙᴜᴇᴀᴅᴀ 〕\n\n` +
                `👤 @${chave}\n📌 Tipo: ${t.motivo} (${t.detalhe})\n🗑️ Apaguei sem repassar.\n` +
                (removido ? `🚪 Removido(a) por reincidência.\n`
                    : atual.kick ? `⚠️ Aviso ${strikes[chave]}/${limite}.\n` : "") +
                `\n${B.rodape()}`,
            mentions: [autor]
        });
        return true;
    } catch (e) {
        console.error("⚠️ [antib] erro no escudo (contido):", e?.message || e);
        return true; // na dúvida, melhor não processar a mensagem suspeita
    }
}

// Compatibilidade com o wrapper antigo do arquivo principal. As falhas são
// só registradas no console; não punimos nem silenciamos remetentes humanos.
function registrarErro(_msg) {}
function deveIgnorar(_msg) { return false; }

// ==================================================
// ⚙️ COMANDO <prefixo>antib
// ==================================================
async function cmdAntib(sock, msg, args = []) {
    const grupo = msg.key.remoteJid;
    const P = config.PREFIX;
    if (!grupo?.endsWith("@g.us")) return B.enviar(sock, grupo, { text: "🧯 Esse comando só funciona em grupos." }, { quoted: msg });
    const autor = B.autorMsg(msg);
    if (!msg.key.fromMe && !(await B.ehAdminGrupo(sock, grupo, [autor, msg.key.participantAlt]))) {
        return B.enviar(sock, grupo, { text: "❌ Só administrador mexe na proteção." }, { quoted: msg });
    }

    const cfg = B.lerCfg(grupo, SISTEMA, PADRAO);
    const sub = String(args[0] || "").toLowerCase();
    const estado = B.lerEstado(sub);

    if (estado !== null) {
        B.salvarCfg(grupo, SISTEMA, { on: estado });
        const semAdm = estado && !(await B.botEhAdmin(sock, grupo)) ? "\n\n⚠️ Me dá *admin*, senão só seguro a trava sem apagar do grupo." : "";
        return B.enviar(sock, grupo, {
            text: `〔 🧯 ᴀɴᴛɪʙ 〕\n\n🔒 Ações visíveis: *${B.onOff(estado)}*\n🛡️ O escudo (não travar) fica SEMPRE ligado.${semAdm}\n\n${B.rodape()}`
        }, { quoted: msg });
    }
    if (sub === "kick") {
        const v = B.lerEstado(args[1]);
        if (v === null) return B.enviar(sock, grupo, { text: `Use: ${P}antib kick on / off` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { kick: v });
        return B.enviar(sock, grupo, { text: `🧯 Remover reincidente: *${v ? "sim" : "não"}*` }, { quoted: msg });
    }
    if (sub === "limite") {
        const n = parseInt(args[1], 10);
        if (!(n >= 1 && n <= 10)) return B.enviar(sock, grupo, { text: `Use: ${P}antib limite 1 a 10` }, { quoted: msg });
        B.salvarCfg(grupo, SISTEMA, { limite: n });
        return B.enviar(sock, grupo, { text: `🧯 Remoção na *${n}ª* trava.` }, { quoted: msg });
    }
    if (sub === "zerar") {
        B.salvarCfg(grupo, SISTEMA, { strikes: {} });
        return B.enviar(sock, grupo, { text: "🧯 Avisos do antib zerados." }, { quoted: msg });
    }

    return B.enviar(sock, grupo, {
        text: `〔 🧯 ᴀɴᴛɪʙ — ᴘʀᴏᴛᴇᴄ̧ᴀ̃ᴏ ᴄᴏɴᴛʀᴀ ᴇʀʀᴏs/ᴛʀᴀᴠᴀs 〕\n\n` +
            `🛡️ Escudo global: *SEMPRE LIGADO* (não deixa o bot cair)\n` +
            `🔒 Ações visíveis neste grupo: *${B.onOff(cfg.on)}*\n` +
            `🚪 Remover reincidente: *${cfg.kick ? `sim (${cfg.limite}ª vez)` : "não"}*\n\n` +
            `❀ ${P}antib on / off\n❀ ${P}antib kick on / off\n❀ ${P}antib limite 2\n❀ ${P}antib zerar\n\n${B.rodape()}`
    }, { quoted: msg });
}

module.exports = { escudoAntib, registrarErro, deveIgnorar, cmdAntib, medirTrava };
