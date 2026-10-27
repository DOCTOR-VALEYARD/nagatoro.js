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

/**
 * ⏳ Manda a ampulheta SEM esperar (não atrasa o comando) e devolve um objeto
 * com finalizar(): apaga a ampulheta (ela fica visível pelo menos um instante).
 */
function iniciarAmpulheta(sock, chat, msg) {
    const inicio = Date.now();
    let promessa = null;
    try { promessa = sock.sendMessage(chat, { text: "⏳" }); /* sem citar: citar apagava a marcação da mensagem do comando */ } catch { promessa = null; }
    return {
        async finalizar() {
            try {
                const enviada = await promessa;
                if (!enviada?.key) return;
                const falta = 700 - (Date.now() - inicio);
                if (falta > 0) await new Promise(r => setTimeout(r, falta));
                await sock.sendMessage(chat, { delete: enviada.key });
            } catch {}
        }
    };
}

module.exports = { podeResponderPrefixo, contarComando, reagir, iniciarAmpulheta };
