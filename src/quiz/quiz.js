const config = require("../../config");

const perguntasQuiz = [
    { pergunta: "Qual é o único metal que permanece líquido em temperatura ambiente?", resposta: "MERCÚRIO", dica: "Seu símbolo químico é Hg." },
    { pergunta: "Quem é o autor da obra 'A Divina Comédia'?", resposta: "DANTE ALIGHIERI", dica: "Ele descreveu os nove círculos do inferno." },
    { pergunta: "Qual é a montanha mais alta do sistema solar?", resposta: "MONTE OLIMPO", dica: "Não fica na Terra, mas sim no planeta vermelho." },
    { pergunta: "Em que ano ocorreu a queda do Muro de Berlim?", resposta: "1989", dica: "Final da década de 80." },
    { pergunta: "Qual é o elemento mais abundante na crosta terrestre?", resposta: "OXIGÊNIO", dica: "Essencial para a nossa respiração." },
    { pergunta: "Quem formulou a Teoria da Relatividade Geral?", resposta: "ALBERT EINSTEIN", dica: "Famoso pela equação E=mc²." },
    { pergunta: "Qual é o país com o maior número de fusos horários no mundo?", resposta: "FRANÇA", dica: "Considere seus territórios ultramarinos espalhados pelo globo." },
    { pergunta: "Qual é o nome do algoritmo de consenso utilizado pelo Bitcoin?", resposta: "PROOF OF WORK", dica: "Prova de Trabalho (em inglês)." },
    { pergunta: "Qual é a capital do Cazaquistão?", resposta: "ASTANA", dica: "Já foi chamada de Nur-Sultan recentemente." },
    { pergunta: "Qual é o maior satélite natural do sistema solar?", resposta: "GANIMEDES", dica: "Orbita o gigante gasoso Júpiter." }
];

const jogosAtivos = new Map();

function normalizar(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

async function quiz(sock, from, msg, args = []) {
    const acao = String(args[0] || "").toLowerCase();
    if (acao === "cancelar" || acao === "parar") {
        if (!jogosAtivos.has(from)) return sock.sendMessage(from, { text: "Não há quiz ativo." }, { quoted: msg });
        jogosAtivos.delete(from);
        return sock.sendMessage(from, { text: "🛑 Quiz cancelado." }, { quoted: msg });
    }
    if (acao === "start" || acao === "iniciar") {
        if (jogosAtivos.has(from)) return sock.sendMessage(from, { text: "⚠️ Já existe um desafio pendente. Responda ou cancele primeiro." }, { quoted: msg });
        const item = perguntasQuiz[Math.floor(Math.random() * perguntasQuiz.length)];
        jogosAtivos.set(from, { pergunta: item.pergunta, resposta: normalizar(item.resposta), exibicao: item.resposta, dica: item.dica, tentativas: 2 });
        const jogo = jogosAtivos.get(from);
        const prefixo = config.PREFIX || ".";
        const texto = `🧠 *DESAFIO INTELECTUAL*\n\n❓ *QUESTÃO:* ${jogo.pergunta}\n💡 *PISTA:* ${jogo.dica}\n❤️ *TENTATIVAS:* ${jogo.tentativas}\n\nResponda com *${prefixo}quiz [resposta]*. Para encerrar: *${prefixo}quiz cancelar*.`;
        return sock.sendMessage(from, { text: texto }, { quoted: msg });
    }

    const jogo = jogosAtivos.get(from);
    if (!jogo) {
        const prefixo = config.PREFIX || ".";
        return sock.sendMessage(from, { text: `❌ Sem quiz ativo. Inicie com *${prefixo}quiz start*.` }, { quoted: msg });
    }
    const tentativa = normalizar(args.join(" "));
    if (!tentativa) return sock.sendMessage(from, { text: "❌ Insira sua resposta para o desafio." }, { quoted: msg });
    if (tentativa === jogo.resposta) {
        jogosAtivos.delete(from);
        return sock.sendMessage(from, { text: `🎯 *CORRETO!* Resposta: *${jogo.exibicao}*!` }, { quoted: msg });
    }

    jogo.tentativas--;
    if (jogo.tentativas <= 0) {
        jogosAtivos.delete(from);
        return sock.sendMessage(from, { text: `🌑 *FIM DE JOGO!* A resposta correta era: *${jogo.exibicao}*.` }, { quoted: msg });
    }
    const texto = `❌ *ERRADO!* Tente novamente.\n\n❓ *QUESTÃO:* ${jogo.pergunta}\n💡 *PISTA:* ${jogo.dica}\n❤️ *TENTATIVAS RESTANTES:* ${jogo.tentativas}`;
    return sock.sendMessage(from, { text: texto }, { quoted: msg });
}

module.exports = { quiz, normalizar };
