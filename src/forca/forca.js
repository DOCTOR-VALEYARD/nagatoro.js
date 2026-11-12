const config = require("../../config");

const palavras = [
    { palavra: "CRIPTOANÁLISE", dica: "A arte de decifrar códigos e comunicações protegidas." },
    { palavra: "EFÊMERO", dica: "Aquilo que dura apenas um breve momento, passageiro." },
    { palavra: "MISANTROPO", dica: "Aquele que evita o convívio social ou nutre aversão à humanidade." },
    { palavra: "ESTOICISMO", dica: "Escola filosófica que prega a resiliência e o controle das emoções." },
    { palavra: "ENTROPIA", dica: "Medida da desordem ou aleatoriedade em um sistema termodinâmico." },
    { palavra: "PARADIGMA", dica: "Um modelo ou padrão que define como algo é compreendido em certa época." },
    { palavra: "QUIMÉRICO", dica: "Algo que é puramente imaginário, fantástico ou impossível." },
    { palavra: "HEGEMONIA", dica: "Supremacia ou influência dominante de uma entidade sobre outras." },
    { palavra: "SINESTESIA", dica: "Fenômeno onde um sentido evoca a percepção de outro simultaneamente." },
    { palavra: "PROSOPAGNOSIA", dica: "Condição neurológica que impede o reconhecimento de rostos familiares." }
];

const jogosAtivos = new Map();

function normalizar(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
}

async function forca(sock, from, msg, args = []) {
    const acao = String(args[0] || "").toLowerCase();
    if (acao === "cancelar" || acao === "parar") {
        if (!jogosAtivos.has(from)) {
            return sock.sendMessage(from, { text: "Não há jogo da forca ativo." }, { quoted: msg });
        }
        jogosAtivos.delete(from);
        return sock.sendMessage(from, { text: "🛑 Jogo da forca cancelado." }, { quoted: msg });
    }

    if (acao === "start" || acao === "iniciar") {
        if (jogosAtivos.has(from)) {
            return sock.sendMessage(from, { text: "⚠️ Já existe uma rodada em curso. Termine ou cancele antes de iniciar outra." }, { quoted: msg });
        }
        const item = palavras[Math.floor(Math.random() * palavras.length)];
        const respostaNormalizada = normalizar(item.palavra);
        jogosAtivos.set(from, {
            palavra: respostaNormalizada,
            exibicao: item.palavra,
            dica: item.dica,
            letrasDescobertas: Array.from(respostaNormalizada, ch => /[A-Z]/.test(ch) ? "_" : ch),
            tentativas: 6,
            letrasErradas: []
        });
        const jogo = jogosAtivos.get(from);
        const prefixo = config.PREFIX || ".";
        const texto = `💀 *DESAFIO DA FORCA — NÍVEL HARD*\n\n🔍 *PISTA:* ${jogo.dica}\n🧩 *ESTRUTURA:* ${jogo.letrasDescobertas.join(" ")}\n❤️ *TENTATIVAS:* ${jogo.tentativas}\n\nUse *${prefixo}forca [letra]*. Para encerrar: *${prefixo}forca cancelar*.`;
        return sock.sendMessage(from, { text: texto }, { quoted: msg });
    }

    const jogo = jogosAtivos.get(from);
    if (!jogo) {
        const prefixo = config.PREFIX || ".";
        return sock.sendMessage(from, { text: `❌ Sem jogo ativo. Inicie com *${prefixo}forca start*.` }, { quoted: msg });
    }

    const letra = normalizar(args[0] || "");
    if (!/^[A-Z]$/.test(letra)) {
        return sock.sendMessage(from, { text: "❌ Envie uma única letra. Acentos são aceitos (por exemplo, Á também vale como A)." }, { quoted: msg });
    }
    if (jogo.letrasDescobertas.includes(letra) || jogo.letrasErradas.includes(letra)) {
        return sock.sendMessage(from, { text: `⚠️ A letra *${letra}* já foi testada.` }, { quoted: msg });
    }

    if (jogo.palavra.includes(letra)) {
        for (let i = 0; i < jogo.palavra.length; i++) {
            if (jogo.palavra[i] === letra) jogo.letrasDescobertas[i] = letra;
        }
        if (!jogo.letrasDescobertas.includes("_")) {
            jogosAtivos.delete(from);
            return sock.sendMessage(from, { text: `🏆 *VITÓRIA!* Você decifrou: *${jogo.exibicao}*!` }, { quoted: msg });
        }
    } else {
        jogo.tentativas--;
        jogo.letrasErradas.push(letra);
        if (jogo.tentativas <= 0) {
            jogosAtivos.delete(from);
            return sock.sendMessage(from, { text: `💀 *FIM DE JOGO!* A palavra era: *${jogo.exibicao}*.` }, { quoted: msg });
        }
    }

    const texto = `🎮 *FORCA ATIVA*\n\n🔍 *PISTA:* ${jogo.dica}\n🧩 *ESTRUTURA:* ${jogo.letrasDescobertas.join(" ")}\n❤️ *TENTATIVAS:* ${jogo.tentativas}\n🚫 *LETRAS ERRADAS:* ${jogo.letrasErradas.join(", ") || "—"}`;
    return sock.sendMessage(from, { text: texto }, { quoted: msg });
}

module.exports = { forca, normalizar };
