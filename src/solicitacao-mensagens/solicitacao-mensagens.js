/* =================================================
   🙋 NAGATORO — MENSAGENS DE SOLICITAÇÃO DE ENTRADA
   📁 Arquivo: solicitacao-mensagens.js

   Duas categorias:
   - pendente: quando alguém pede pra entrar (debochada)
   - recusada: quando um admin recusa (deboche no talo)
================================================= */

const pendentes = [
    "😏 Olha só... @{nome} tá batendo na porta. Que carinha de quem vai implorar, hein? Admins, decidam aí.",
    "🤭 @{nome} quer entrar! Ai que fofo, achou que era só pedir? Hehe~ ADMs, vocês que lutem.",
    "🙄 Mais um(a) na porta: @{nome}. Vai, admin, tem dó ou não tem?",
    "😼 @{nome} pediu pra entrar. Senta e espera, senpai. Ninguém aqui tem pressa.",
    "👀 @{nome} tá espiando pela fresta da porta... que coisinha ansiosa. Admins?",
    "😈 Pedido novo de @{nome}! Eu já tô preparando o deboche de boas-vindas, só falta um admin aprovar.",
    "💅 @{nome} quer fazer parte disso aqui? Coragem, hein. Admin, libera pra eu me divertir.",
    "🖤 @{nome} tocou a campainha. Vou fingir que não ouvi... ADMs, ouviram?",
    "😏 @{nome} mandou solicitação. Tá esperando o quê, um tapete vermelho? Hehe~",
    "🤭 Fila da porta: @{nome}, a ansiedade e mais nada. Admins, bora.",
    "🙃 @{nome} apareceu pedindo passagem. Fala por favor primeiro, né, senpai?",
    "😼 @{nome} quer entrar. Eu deixaria... só pra zoar. Admin decide.",
];

const recusadas = [
    "😂 HAHAHAHA! @{quemRecusou} recusou @{nome}! Nem passou da porta, que vergonha alheia... tá fofo.",
    "🤭 Ai, @{nome}... BARRADO(A)! @{quemRecusou} olhou, pensou um segundo e disse NÃO. Chora não, senpai. Ou chora, eu gosto.",
    "😈 @{quemRecusou} fechou a porta na cara de @{nome}! Até eu senti o vento daqui. HEHE~",
    "🙄 @{nome} implorou pra entrar e @{quemRecusou} nem ligou. Que dó... só que não.",
    "💀 RIP pedido de @{nome}. Causa da morte: @{quemRecusou} com zero paciência. Velório? Ninguém vai.",
    "😏 @{nome} achou que ia ser fácil? @{quemRecusou} mostrou que não. Volta pra casa, kimo~",
    "🖤 Recusado(a)! @{quemRecusou} olhou o perfil de @{nome} e falou: 'nem a pau'. Eu concordo, tá?",
    "😂 @{nome} foi barrado(a) por @{quemRecusou}! Vai tentar de novo? Por favor tenta, eu quero rir mais.",
    "🫵 OLHA ELE(A)! @{nome} levou um NÃO de @{quemRecusou}. Tira print, gente, isso é histórico.",
    "😼 @{quemRecusou} recusou @{nome} tão rápido que nem deu tempo de eu debochar direito. Que eficiência!",
    "🤡 @{nome} ficou do lado de fora igual cachorro na chuva. Culpa de @{quemRecusou}. Eu? Só tô rindo.",
    "💅 Pedido de @{nome} foi pro lixo. @{quemRecusou} nem leu. Eu li... e ri. HEHE~",
];

function preencher(texto, valores) {
    let resultado = texto;
    for (const chave of Object.keys(valores)) {
        resultado = resultado.replace(new RegExp(`\\{${chave}\\}`, "g"), valores[chave]);
    }
    return resultado;
}

function gerarMensagemSolicitacao(nome) {
    const escolhida = pendentes[Math.floor(Math.random() * pendentes.length)];
    return preencher(escolhida, { nome });
}

function gerarMensagemRecusa(nome, quemRecusou) {
    const escolhida = recusadas[Math.floor(Math.random() * recusadas.length)];
    return preencher(escolhida, { nome, quemRecusou });
}

module.exports = { gerarMensagemSolicitacao, gerarMensagemRecusa };
