/* =================================================
   🔁 NAGATORO — ANTI-LOOP (detecta repetição / outro bot)
   📁 Arquivo: antiloop.js

   Se a MESMA mensagem chegar 3 vezes seguidas da mesma pessoa
   no mesmo chat, o bot assume que não é uma pessoa de verdade
   digitando (é outro bot, ou algum eco/automatização) e para
   de responder pra aquele remetente naquele chat — evitando o
   clássico loop de "dois bots" ficando se respondendo pra
   sempre (ex: os dois falando a palavra que dispara alguma
   resposta automática um do outro).

   Assim que o remetente manda algo DIFERENTE do que repetiu,
   o bloqueio é liberado automaticamente.
================================================= */

const estados = new Map(); // chave: `${chatId}::${remetente}` -> { ultimo, contagem, ignorado }

function chave(chatId, remetente) {
    return `${chatId}::${remetente}`;
}

/**
 * Chamar pra toda mensagem de texto recebida.
 * Retorna:
 *   { ignorar: true,  avisar: true  } -> é a 3ª repetição: manda aviso e para de responder
 *   { ignorar: true,  avisar: false } -> já estava ignorando esse remetente: fica em silêncio
 *   { ignorar: false, avisar: false } -> segue o processamento normal
 */
function verificarRepeticao(chatId, remetente, textoOriginal) {
    // Não classificar pessoas por repetição/velocidade: comandos, figurinhas
    // e tentativas legítimas podem ser repetidos. A detecção de outro bot
    // fica centralizada em anti-bot.js e considera somente o ID da mensagem.
    return { ignorar: false, avisar: false };
}

module.exports = { verificarRepeticao };
