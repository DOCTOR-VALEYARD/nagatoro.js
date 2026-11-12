const config = require("../../config");

const enigmas = [
    { palavra: "SILÊNCIO", dica: "Aquele que me quebra ao dizer o meu nome." },
    { palavra: "FUTURO", dica: "Eu sempre estou chegando, mas nunca estou aqui hoje." },
    { palavra: "PIANO", dica: "Tenho oitenta e oito teclas, mas não abro nenhuma porta." },
    { palavra: "RELÓGIO", dica: "Tenho mãos, mas não posso segurar nada; corro, mas não tenho pernas." },
    { palavra: "ECO", dica: "Falo sem boca e ouço sem ouvidos. Não tenho corpo, mas ganho vida com o vento." },
    { palavra: "ESTRELA", dica: "Saímos à noite sem sermos chamadas, e nos perdemos de dia sem sermos roubadas." },
    { palavra: "PROMESSA", dica: "Sou algo que você pode fazer, mas ninguém mais pode ver. Se me quebrar, perco o valor." },
    { palavra: "IDADE", dica: "O que é que sobe, sobe, sobe e nunca mais desce?" },
    { palavra: "DÚVIDA", dica: "Quanto mais você tem de mim, menos você sabe." },
    { palavra: "TEMPO", dica: "Eu devoro todas as coisas: pássaros, feras, árvores, flores; róio o ferro, mordo o aço; mato reis, destruo cidades e esmago montanhas." }
];

const jogosAtivos = new Map();

function normalizar(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

async function adivinha(sock, from, msg, args = []) {
    const acao = String(args[0] || "").toLowerCase();
    if (acao === "cancelar" || acao === "parar") {
        if (!jogosAtivos.has(from)) return sock.sendMessage(from, { text: "Não há enigma ativo." }, { quoted: msg });
        jogosAtivos.delete(from);
        return sock.sendMessage(from, { text: "🛑 Enigma cancelado." }, { quoted: msg });
    }
    if (acao === "start" || acao === "iniciar") {
        if (jogosAtivos.has(from)) return sock.sendMessage(from, { text: "⚠️ Já existe um enigma pendente. Resolva-o ou cancele primeiro." }, { quoted: msg });
        const item = enigmas[Math.floor(Math.random() * enigmas.length)];
        jogosAtivos.set(from, { resposta: normalizar(item.palavra), exibicao: item.palavra, dica: item.dica, tentativas: 3 });
        const jogo = jogosAtivos.get(from);
        const prefixo = config.PREFIX || ".";
        const texto = `🧩 *ENIGMA DO MESTRE*\n\n🤔 *CHARADA:* “${jogo.dica}”\n📝 *TAMANHO:* ${Array.from(jogo.exibicao).length} caracteres\n❤️ *VIDAS:* ${jogo.tentativas}\n\nResponda com *${prefixo}adivinha [palavra]*. Para encerrar: *${prefixo}adivinha cancelar*.`;
        return sock.sendMessage(from, { text: texto }, { quoted: msg });
    }

    const jogo = jogosAtivos.get(from);
    if (!jogo) {
        const prefixo = config.PREFIX || ".";
        return sock.sendMessage(from, { text: `❌ Nenhum enigma ativo. Use *${prefixo}adivinha start*.` }, { quoted: msg });
    }
    const tentativa = normalizar(args.join(" "));
    if (!tentativa) return sock.sendMessage(from, { text: "❌ Insira seu palpite." }, { quoted: msg });
    if (tentativa === jogo.resposta) {
        jogosAtivos.delete(from);
        return sock.sendMessage(from, { text: `✨ *ACERTO!* Você desvendou: *${jogo.exibicao}*!` }, { quoted: msg });
    }

    jogo.tentativas--;
    if (jogo.tentativas <= 0) {
        jogosAtivos.delete(from);
        return sock.sendMessage(from, { text: `🌑 *FIM DE JOGO!* A resposta era: *${jogo.exibicao}*.` }, { quoted: msg });
    }
    return sock.sendMessage(from, { text: `❌ *AINDA NÃO!*\n\n🤔 *CHARADA:* “${jogo.dica}”\n❤️ *TENTATIVAS RESTANTES:* ${jogo.tentativas}` }, { quoted: msg });
}

module.exports = { adivinha, normalizar };
