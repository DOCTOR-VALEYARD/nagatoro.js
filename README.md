<div align="center">

<img src="src/midias/imagens/menu.png" alt="NAGATORO" width="420">

# 💜 NAGATORO — Bot de WhatsApp

**Se aguenta, fica. Se não aguenta, some.**

Bot de WhatsApp debochada, rápida e completa, feita em Node.js com Baileys.
Pensada para grupos de amizade e para equipes **FCC** de combate ao crime cibernético.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-v7-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)
![Termux](https://img.shields.io/badge/Termux-Android-000000?style=for-the-badge&logo=android&logoColor=3DDC84)
![Versão](https://img.shields.io/badge/vers%C3%A3o-V5-9D4DFF?style=for-the-badge)
![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-C9A2FF?style=for-the-badge)

</div>

---

## 📑 Sumário

- [Sobre](#-sobre)
- [Destaques](#-destaques)
- [Instalação no Termux](#-instalação-no-termux)
- [Ligar de novo](#-ligar-de-novo)
- [Atualizar a bot](#%EF%B8%8F-atualizar-a-bot)
- [Hospedagem (painel Pterodactyl)](#%EF%B8%8F-hospedagem-painel-pterodactyl)
- [Configuração](#%EF%B8%8F-configuração)
- [Comandos](#-comandos)
- [Áudios e mensagens dela](#-áudios-e-mensagens-dela)
- [Problemas comuns](#-problemas-comuns)
- [Créditos](#-créditos)

---

## 💜 Sobre

A **Nagatoro** é uma bot de WhatsApp com personalidade própria: provocadora, sarcástica e debochada, inspirada na personagem do anime. Ela conversa com IA, modera o grupo, analisa links suspeitos, faz relatório do dia, figurinhas, músicas, vídeos e jogos — tudo com menu de botões e cards roxos no estilo dela.

---

## ✨ Destaques

| | Recurso | O que faz |
|:-:|---|---|
| 🧠 | **IA com personalidade** | Conversa no deboche, lê imagens e lembra do contexto. Usa IAs grátis e, se você colocar, Gemini, Groq, OpenRouter ou Mistral. |
| 👑 | **Reconhece o dono** | Identifica o criador pelo número e pelo LID — ninguém consegue se passar por ele. |
| 🔗 | **Analisa link de grupo** | Mandou link `chat.whatsapp.com`? Ela lê nome, membros, criador, data e descrição **sem entrar** e diz se o grupo parece golpe, venda de dados ou spam. |
| 📰 | **Relatório do dia** | Antes do grupo fechar no horário automático, ela manda card + resumo: quem mais falou, assuntos e a fofoca do dia. Ou na hora, com `.relatorio`. |
| 🛡️ | **Proteção pesada** | Antilink, antifake, anti-NSFW, anti-palavrão, anti-trava, anti-APK, anti-invasão, anti-flood, lista negra e autoban. |
| 🕵️ | **X9** | Devolve tudo que apagarem: texto, foto, vídeo, áudio, figurinha e documento. |
| 🎵 | **Play profissional** | Card com capa, artista, canal e quem pediu, barra de download e botão para escolher áudio ou vídeo. |
| 🎴 | **Figurinhas** | Imagem, vídeo e GIF viram figurinha (inclusive animada), com nome do pacote e autor. Também no automático. |
| 🔮 | **Espaço Crush** | Jogo de combinar gemas no Sistema Solar, dentro do navegador: solo, desafio entre membros, ranking e perfil. |
| 🖼️ | **Cards prontos** | Entrada, saída, pedido de entrada, ranking, convite e saídas em cards instantâneos. |
| 💰 | **Economia** | Gold, banco, loja, inventário, missões, ranking, casamentos e amizades. |
| ♻️ | **Sempre de pé** | Caiu a conexão? Ela reconecta sozinha, sem precisar parear de novo. |

---

## 📲 Instalação no Termux

> Use o Termux da **F-Droid** ou do **GitHub**. A versão da Play Store é antiga e dá erro.

### 1️⃣ Atualize o Termux e instale o necessário (só na primeira vez)

```bash
termux-setup-storage
```

```bash
mkdir -p /data/data/com.termux/cache/apt/archives/partial && pkg update -y && pkg upgrade -y
```

```bash
pkg install -y git nodejs-lts ffmpeg imagemagick libwebp python python-pip && pip install -U yt-dlp
```

| Pacote | Para que serve |
|---|---|
| `git` | Baixar e atualizar a bot pelo repositório |
| `nodejs-lts` | Rodar a bot (Node.js 20 ou mais novo) |
| `ffmpeg` | Figurinha animada, áudio e vídeo |
| `imagemagick` / `libwebp` | Conversão de imagens e figurinhas |
| `python` / `yt-dlp` | Download de músicas e vídeos |

> Se o `pkg` der erro de **Failed to fetch**, rode `termux-change-repo`, escolha **Main repository**, pegue outro servidor e rode o comando de novo.

### 2️⃣ Baixe e ligue a Nagatoro (um comando só)

Cria a pasta `nagatoro`, baixa a bot dentro dela e já liga. Os módulos são instalados sozinhos pelo `npm start`:

```bash
cd ~ && rm -rf nagatoro && mkdir nagatoro && cd nagatoro && git clone https://github.com/DOCTOR-VALEYARD/nagatoro.js . && npm start
```

> Os avisos amarelos `npm warn` são normais, não são erro.

### 3️⃣ Conecte o WhatsApp

Escolha uma opção no menu que aparece:

| Opção | Como conectar |
|:-:|---|
| `1` | **QR Code**: WhatsApp → Dispositivos conectados → Conectar dispositivo → leia o QR. |
| `2` | **Código**: digite o número com DDI (ex.: `5511999999999`). No WhatsApp: Dispositivos conectados → Conectar dispositivo → **Conectar com número de telefone** → digite o código que apareceu. |

Pronto. Quando aparecer **"NAGATORO CONECTADA COM SUCESSO"**, mande `.menu` no grupo.

---

## 🔁 Ligar de novo

Fechou o Termux? A sessão fica salva na pasta `auth_info`. Não precisa baixar nem conectar de novo:

```bash
cd ~/nagatoro && npm start
```

> 💡 Para a bot não cair quando a tela apagar, segure a notificação do Termux e toque em **Acquire wakelock**.

---

## ⬆️ Atualizar a bot

Já tem a Nagatoro no Termux? **Não precisa baixar tudo de novo.** Saiu versão nova aqui no repositório, é só rodar:

```bash
cd ~/nagatoro && cp config.js ~/.nagatoro-config.bak && git fetch origin main && git reset --hard FETCH_HEAD && cp ~/.nagatoro-config.bak config.js && npm start
```

O que esse comando faz:

1. Guarda uma cópia do seu `config.js` (com as suas chaves e o seu número).
2. Baixa a versão nova e troca os arquivos da bot.
3. Devolve o seu `config.js` do jeito que estava.
4. Liga a bot (o `npm start` instala os módulos novos sozinho).

A conexão com o WhatsApp (`auth_info`), as configurações (`database`) e os dados dos grupos (`src/dados`) **não são apagados** — você não precisa conectar o WhatsApp de novo.

---

## 🖥️ Hospedagem (painel Pterodactyl)

1. Crie um servidor **Node.js 20+**.
2. Em **Startup**, coloque o repositório `https://github.com/DOCTOR-VALEYARD/nagatoro.js` e o arquivo principal `nagatoro.js` (ou o comando `npm start`).
3. Ligue o servidor: o `npm start` instala os módulos sozinho.
4. Conecte pelo código de pareamento (opção `2`) direto no console.

> O jogo **Espaço Crush** usa a porta do servidor automaticamente e descobre o endereço sozinho.

---

## ⚙️ Configuração

O jeito mais fácil é pela própria bot, sem mexer em arquivo. No PV (sendo o dono) ou num grupo onde você é ADM:

```
.configurar-bot
```

Muda **prefixo, nome da bot, nome e número do dono, foto do menu, fundo, GIFs e áudios** — vale na hora, sem reiniciar.

Para editar direto no arquivo:

```bash
cd ~/nagatoro && nano config.js
```

| Campo | Para que serve |
|---|---|
| `PREFIX` | Prefixo dos comandos (padrão `.`). |
| `BOT_NAME` | Nome da bot. |
| `OWNER_NAME` / `OWNER_NUMBER` | Nome e número do dono (com DDI, só números). |
| `OWNER_LID` | LID do dono — descubra mandando `.meuid`. |
| `AI_CHAVES.gemini` | Chave grátis do Gemini ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)). Opcional: sem chave ela usa IAs grátis. |
| `AI_CHAVES.groq` / `openrouter` / `mistral` | Outras chaves de IA (opcionais). |
| `AI_CHAVES.youtube` | Chave da YouTube Data API v3 — mostra views e canal no `.play` (opcional). |
| `ESPACO_CRUSH.URL` | Endereço do jogo (deixe vazio: ela descobre sozinha). |

> 🔐 **Nunca** publique o seu `config.js` com chaves preenchidas nem a pasta `auth_info`.

---

## 📋 Comandos

> O prefixo padrão é `.` — use `.menu` para ver tudo com botões.

<details>
<summary><b>🧠 IA e análise</b></summary>

| Comando | Função |
|---|---|
| `.ia` | Liga/desliga a IA no grupo |
| `.relatorio` | Relatório do dia **até agora** (card + resumo + fofoca) |
| `.relatoriodiario` | Liga/desliga o resumo automático das 23:59 |
| *mandar link de grupo* | Com a IA ligada, ela analisa o grupo sem entrar |
| `.meuid` | Mostra seu número e LID (para configurar o dono) |

</details>

<details>
<summary><b>🎵 Músicas e mídias</b></summary>

| Comando | Função |
|---|---|
| `.play` nome | Pesquisa e baixa música (escolha áudio ou vídeo) |
| `.video` nome ou link | Baixa vídeo |
| `.tiktok` / `.instagram` / `.kwai` link | Baixa da rede social |
| `.pinterest` / `.mediafire` link | Baixa do Pinterest / MediaFire |
| `.letra` artista - música | Letra da música |
| `.s` | Figurinha (responda imagem, vídeo ou GIF) |
| `.dvcl1` / `.dvcl0` | Liga/desliga a figurinha automática |
| `.gif` / `.toimg` / `.tomp3` | Converte mídia |
| `.voz` efeito | Efeitos de voz |

</details>

<details>
<summary><b>🎮 Jogos e brincadeiras</b></summary>

| Comando | Função |
|---|---|
| `.crush` | Espaço Crush (solo ou desafio) |
| `.rankcrush` | Ranking do Espaço Crush |
| `.forca` / `.quiz` / `.adivinha` | Jogos |
| `.jogodavelha` @pessoa | Jogo da velha |
| `.roleta` / `.sortear` | Sorteios |
| `.casal` / `.amizade` / `.dupla` | Combinações do grupo |
| `.matar` / `.tapa` / `.beijar` / `.abracar` | Interações com GIF |

</details>

<details>
<summary><b>💰 Economia</b></summary>

| Comando | Função |
|---|---|
| `.gold` / `.saldo` | Seu dinheiro |
| `.daily` / `.trabalhar` / `.bonus` | Ganhar gold |
| `.depositar` / `.sacar` / `.transferir` | Banco |
| `.loja` / `.inventario` / `.presente` | Loja e itens |
| `.topgold` / `.topxp` / `.rank` | Rankings |
| `.casamento` / `.divorcio` | Relacionamentos |

</details>

<details>
<summary><b>👥 Membros</b></summary>

| Comando | Função |
|---|---|
| `.perfil` | Seu perfil |
| `.membros` / `.adms` | Lista do grupo |
| `.resumo` / `.top10` / `.rankativo` | Atividade do dia |
| `.rank jornal` | Ranking em card |
| `.bug` / `.sugestao` | Fala com o dono |

</details>

<details>
<summary><b>🛡️ Proteção do grupo (só ADM)</b></summary>

**Liga/desliga com o mesmo comando:**

| Comando | Função |
|---|---|
| `.antilink` | Apaga links |
| `.antinota` | Apaga áudio e nota de voz |
| `.antiloc` | Apaga localização |
| `.antidoc` | Apaga documento |
| `.antinudes` / `.antinsfw` | Bloqueia nudez e +18 |
| `.antifake` | Barra número fake ou de fora |
| `.antipalavrao` | Apaga palavrão |
| `.x9` | Mostra mensagem apagada |

**Usam `on` / `off`:**

| Comando | Função |
|---|---|
| `.antip on` | Arquivo suspeito e APK (`.antip apk on`, `.antip kick on`) |
| `.antib on` | Anti-trava (`.antib kick on`) |
| `.antir on` | Anti-invasão em massa (`.antir limite 3`, `.antir fechar on`) |
| `.antig on` | Anti-flood (`.antig kick on`, `.antig limite 6`) |
| `.antispam on` / `.antiflood on` | Spam e flood |
| `.somenteadm on` | Só ADM fala |
| `.cagueta on` | Avisa quem ganhou/perdeu ADM |

**Usam `1` / `0`:** `.autoban 1` · `.aceitar 1` · `.mencao 1` · `.bemvindo 1`

</details>

<details>
<summary><b>⚔️ Administração (só ADM)</b></summary>

| Comando | Função |
|---|---|
| `.ban` / `.kick` @pessoa | Remove do grupo |
| `.promover` / `.rebaixar` @pessoa | Muda cargo |
| `.mute` / `.unmute` @pessoa | Silencia |
| `.warn` / `.unwarn` @pessoa | Advertência |
| `.abrir` / `.fechar` | Abre ou fecha na hora |
| `.fechar 23:00` / `.abrir 08:00` | Horário automático (com relatório antes de fechar) |
| `.blacklist` / `.tirarlista` @pessoa | Lista negra |
| `.marcar` / `.hidetag` | Marca todo mundo |

</details>

<details>
<summary><b>👑 Dono</b></summary>

| Comando | Função |
|---|---|
| `.configurar-bot` | Painel de configuração |
| `.ligar` / `.desligar` | Liga ou desliga a bot |
| `.restart` | Reinicia a conexão |
| `.broadcast` mensagem | Aviso para todos os grupos |
| `.backup` | Backup dos dados |

</details>

---

## 🔊 Áudios e mensagens dela

Cada situação tem uma pasta de **áudios** e uma de **mensagens**. Ela reveza: uma vez manda áudio, na outra manda mensagem.

```
src/midias/
├── audios/      → coloque os .mp3 aqui (1.mp3, 2.mp3, ...)
│   ├── bomdia/   boatarde/   boanoite/
│   ├── antiamor/ chamado/    menu/
│   └── prefixo/  entrada/    saida/
└── mensagens/   → uma mensagem por linha em mensagens.txt
```

Também dá para subir áudio pelo WhatsApp: `.configurar-bot` → **SUBIR ÁUDIO**.

---

## 🧰 Problemas comuns

<details>
<summary><b>"O WhatsApp desconectou este aparelho"</b></summary>

Só acontece se o aparelho foi removido em **Dispositivos conectados** (quedas comuns ela reconecta sozinha). Apague a sessão e conecte de novo:

```bash
cd ~/nagatoro && rm -rf auth_info && npm start
```

</details>

<details>
<summary><b>"Sessão aberta em outro lugar"</b></summary>

A mesma pasta `auth_info` está rodando em dois lugares (ex.: Termux e hospedagem). Deixe a bot ligada em **um lugar só**.

</details>

<details>
<summary><b>Figurinha de GIF ou vídeo não sai</b></summary>

```bash
pkg install -y ffmpeg imagemagick libwebp
```

</details>

<details>
<summary><b>Música ou vídeo não baixa</b></summary>

```bash
pkg install -y python python-pip && pip install -U yt-dlp
```

</details>

<details>
<summary><b><code>pkg</code> dá "Failed to fetch"</b></summary>

```bash
mkdir -p /data/data/com.termux/cache/apt/archives/partial && pkg update -y
```

Se continuar: `termux-change-repo` → **Main repository** → escolha outro espelho.

</details>

<details>
<summary><b>Erro ao instalar os módulos (npm)</b></summary>

```bash
cd ~/nagatoro && rm -rf node_modules package-lock.json && npm start
```

</details>

---

## 👑 Créditos

<div align="center">

Criado por **DOCTOR VALEYARD C'RIZZ LUNÁTICO**

[![Canal no WhatsApp](https://img.shields.io/badge/Canal-WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029VbEHp6CFHWpymLOJGZ28)
[![Instagram](https://img.shields.io/badge/Instagram-@__dvcl__-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://instagram.com/__dvcl__)
[![GitHub](https://img.shields.io/badge/GitHub-DOCTOR--VALEYARD-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/DOCTOR-VALEYARD)

<sub>💜 Feito com deboche e Node.js. Hehe~</sub>

</div>
