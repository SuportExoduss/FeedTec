# Status

## F1 — Base (código pronto, falta login real)
- [x] Projeto Expo 58 + expo-router + web; `android/` gerada uma vez (prebuild) com plugins do navalha
- [x] Projeto Firebase `feedtec-app` + app web + app Android `com.trevotec.feedtec` (SHA-1 dos 2 debug.keystore)
- [x] Técnicos: adicionar / editar / remover (testes em `src/lib/dados.test.ts`)
- [x] Drive: pasta `FeedTec/feedtec.json`, cache local, último a gravar vence
- [x] Web: tela de login renderiza sem erro (navegador do painel)
- [x] Login Google ativado no Firebase (Authentication iniciado) e Google Drive API ativada no projeto
- [x] `google-services.json` com clients OAuth (raiz e `android/app/`); `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no `.env.local`
- [x] Web: login Google, técnico criado e salvo em `FeedTec/feedtec.json` no Drive (corrigida corrida do token no 1º login)
- [ ] Web: editar/remover pela tela (lógica coberta pelos testes)
- [ ] **Dono (Android Studio):** abrir `android/`, Sync, Run no celular e testar login + técnicos

- [x] Nome no Android Studio: `android/.idea/.name` = FeedTec (antes aparecia "android"; feche e abra o projeto)

## F2 — Feedback escrito (código pronto)
- [x] Feedback no `feedtec.json`: tom, anotações, texto final; histórico do técnico agrupado por dia (testes)
- [x] Chave do Gemini no Perfil, com aviso de LGPD (plano grátis pode usar os textos; ativar faturamento)
- [x] Telas: novo feedback (tom → anotações → Gerar → ajustar → Salvar) e ver feedback (copiar/compartilhar, remover no ⋮)
- [x] Web: feedback real gerado com Gemini, salvo, no histórico do dia e conferido no Drive (05/11)
- [x] Prompt: 1ª pessoa do supervisor, estilo registro de acompanhamento (ref. do dono), tom muda a tonalidade; reserva `flash-lite` no 503 e 20 s por modelo
- [ ] **Dono (Android Studio):** Sync + Run e testar gerar/compartilhar (sem mudança nativa nesta fase)

## F3 — Feedback gravado (código pronto)
- [x] `expo-audio` + plugin no `app.json`; gravação mono 16 kHz 32 kbps (Android: `.aac`; web: `audio/mp4` ou `webm`)
- [x] Gravar conversa no novo feedback: aviso LGPD (avisar o técnico), cronômetro, pausar/continuar, parar
- [x] Gemini transcreve separando vozes A/B (áudio inline, até ~1 h); o gestor escolhe qual é a dele; a conversa vira as anotações
- [x] Feedback guarda `conversa` e `audioId`; áudio vai para a pasta FeedTec no Drive ao salvar (sem Drive, salva sem o áudio)
- [x] Ver feedback: abas Feedback / Conversa com balões (eu à direita)
- [x] Web: transcrição real conferida com WAV de 2 vozes (06/11); microfone bloqueado no painel, gravação não testada aqui
- [ ] Upload do áudio no Drive não testado (token expirou); conferir no 1º feedback gravado
- [ ] **Mudança nativa (à mão):** `RECORD_AUDIO` e `MODIFY_AUDIO_SETTINGS` no `AndroidManifest.xml`; módulo nativo `expo-audio`
- [ ] **Dono (Android Studio):** Sync + Run, gravar uma conversa real, conferir transcrição, vozes, aba Conversa e o áudio no Drive

## F4 — Menu lateral (código pronto)
- [x] Menu ☰ na tela inicial: Histórico e Perfil (Tarefas/Reuniões na F5)
- [x] Histórico geral por dia, com nome do técnico, tom, 🎤 nos gravados e filtro Todos/Gravados (teste)
- [x] Player na aba Conversa: tocar/pausar, barra com toque para pular, tempo; Android toca direto do Drive, web baixa antes; pede reconectar se o token expirou
- [x] Web: menu e histórico conferidos (06/11)
- [ ] Player não testado (nenhum feedback gravado com áudio ainda); sem mudança nativa nesta fase
- [ ] **Dono (Android Studio):** junto com o teste da F3, abrir o feedback gravado → aba Conversa → ouvir

## F5 — Agenda (código pronto)
- [x] Tarefas (título, dia, lembrete opcional, descrição, feita) e reuniões semanais (dia da semana, hora, descrição) no `feedtec.json` (testes em `src/lib/agenda.test.ts`)
- [x] Telas no ☰: Tarefas (círculo marca feita; tocar abre editar/remover; atrasada em vermelho) e Reuniões (próxima data); dia em dd/mm, sem ano = próxima ocorrência
- [x] Lembretes locais (`src/services/lembretes.native.ts`): tarefa no dia/hora; reunião toda semana 15 min antes; refaz tudo quando tarefas/reuniões mudam (inclusive vindas do Drive); sair cancela. Web: só a tela
- [x] Web: criar/editar/marcar tarefa e criar reunião conferidos (06/11); remover não testado (confirm do navegador)
- [ ] **Mudança nativa (à mão):** `POST_NOTIFICATIONS` e `RECEIVE_BOOT_COMPLETED` no `AndroidManifest.xml`; plugin `expo-notifications` no `app.json`; módulo nativo `expo-notifications`
- [ ] **Dono (Android Studio):** Sync + Run; criar tarefa para daqui a 2 min e aceitar a permissão; conferir o aviso (app aberto e fechado); reunião para hoje +20 min

## F6 — Ícone, splash e publicação web (código pronto)
- [x] Ícone adaptativo em vetor (balão com ✓, #3FB8A0 sobre #101214): `drawable/ic_launcher_foreground.xml` + `mipmap-anydpi-v26/ic_launcher(_round).xml` (com monochrome). Os `.webp` antigos ficam como reserva (Android < 8)
- [x] Splash: `drawable/splashscreen_logo.xml` usa o mesmo vetor
- [ ] **Mudança nativa (à mão):** os 4 XML acima. `expo prebuild` apagaria tudo; não rodar
- [x] Web: `public/favicon.svg`; `scripts/preparar-web.cjs` põe o favicon e `lang="pt-BR"` no `index.html`
- [x] Hosting: `firebase.json` (SPA, cache de 1 ano em `_expo/` e `assets/`, HTML sem cache), `.firebaserc` (feedtec-app), `npm run deploy`
- [x] Build web conferido (06/11); servidor local do Hosting não abriu no painel
- [x] Publicado (`npm run deploy`) → https://feedtec-app.web.app (06/11): tela de login, favicon, pt-BR e ícones OK, sem erros no console
- [ ] **Dono (Google Cloud Console):** em Credenciais → client OAuth web, adicionar `https://feedtec-app.web.app` (e `https://feedtec-app.firebaseapp.com`) nas origens JavaScript autorizadas; senão o login Google falha no site
- [ ] **Dono:** criar keystore de release (hoje o release assina com a chave de debug) e cadastrar o SHA-1 dela no app Android do Firebase
- [ ] **Dono (Android Studio):** Sync + Run e conferir ícone (inclusive o temático do Android 13) e splash

## F7 — Agenda completa, bateria, resumo da gravação e novo ícone (código pronto)
- [x] Seletores próprios (`src/components/seletores.tsx`): calendário (mês, hoje marcado) e relógio circular (horas 1–12 por fora, 13–00 por dentro, minutos de 5 em 5) em Tarefas e Reuniões
- [x] Reunião recorrente (toda semana) ou avulsa (dia no calendário); pautas uma a uma (título + descrição) no lugar da descrição; `descricao` antiga vira 1 pauta ao ler o JSON
- [x] No dia (selo HOJE): marcar pautas tratadas + devolutiva → aba Realizadas (reunião, dia, pautas ✓/✗, devolutiva). Pautas não tratadas ficam só no registro do dia, não seguem; recorrente volta sem pautas, avulsa sai das agendadas (teste em `agenda.test.ts`)
- [x] Perfil: passo a passo para pegar a chave do Gemini
- [x] Filtro Todos/Gravados saiu do Histórico e foi para a tela do técnico
- [x] Gravação: o prompt pede só os assuntos relevantes, em resumo de poucos parágrafos; caixa "Adicionar contexto ou ressalvas" acima de Gerar abre um campo que vai no pedido como "Contexto do gestor" (teste em `dados.test.ts`)
- [x] Reiniciar o celular: o `expo-notifications` reagenda sozinho (BOOT_COMPLETED, já no manifesto); depende da bateria liberada
- [x] Bateria como no Navalha: faixa em Tarefas/Reuniões/Perfil → tela "Lembretes com o app fechado" (bateria sem restrição por fabricante + alarmes e lembretes); some quando liberado
- [x] Ícone: arte do dono (`D:\downloadseedtec icone.png`, 512 px): `mipmap-*/ic_launcher_foreground.png` (arte nos 66 dp do centro) sobre `@color/ic_launcher_background` #2151F7; `ic_launcher(_round).webp` legados regerados; splash usa o mesmo PNG; sem ícone monocromático (temático do Android 13 cai no colorido). Web: `public/favicon.png` + `apple-touch-icon.png` (o `favicon.svg` e o vetor antigo saíram). Cortes redondo/squircle conferidos numa prévia
- [ ] **Mudança nativa (à mão):** `BateriaPackage.kt` (novo) + `add(BateriaPackage())` no `MainApplication.kt`; `SCHEDULE_EXACT_ALARM` no `AndroidManifest.xml`; módulo nativo `expo-intent-launcher`; PNGs do ícone em `mipmap-*`, `mipmap-anydpi-v26/ic_launcher(_round).xml`, cor `ic_launcher_background` e `splashscreen_logo.xml`
- [x] Web conferida (06/11): filtro Gravados no técnico, caixa de contexto, relógio, reunião avulsa com pautas → HOJE → registrar → Realizadas (1 de 2 tratadas); corrigido botão dentro de botão no item da pauta (web)
- [ ] Gravação real não testada no painel (microfone bloqueado); remover registro na web não confirmado (confirm do navegador)
- [ ] **Dono (Android Studio):** Sync + Run; liberar bateria e alarmes pela faixa; gravar uma conversa longa e conferir se o feedback sai resumido; testar a caixa de contexto; reunião de hoje → registrar → Realizadas; reiniciar o celular com uma tarefa agendada e conferir o aviso; conferir o ícone novo
- [x] Endereço novo: site `feedtec` criado no projeto feedtec-app; `firebase.json` com `"site": "feedtec"` → https://feedtec.web.app (06/11, login e console OK). O antigo feedtec-app.web.app continua no ar com a versão de 06/11
- [x] Firebase Auth → Domínios autorizados: `feedtec.web.app` adicionado (06/11). Client OAuth web não precisa mudar: o login web usa `signInWithPopup`, que passa pelo handler em feedtec-app.firebaseapp.com (já autorizado)

## F8 — Avisos no navegador (site aberto) — 06/11/2026

- Perfil (só web): "Ativar avisos no navegador" pede a permissão. Com o FeedTec aberto em alguma aba (pode ser em segundo plano),
  `src/services/lembretes.ts` confere a cada 30 s os avisos da agenda (`avisosDaAgenda` em `lib/agenda.ts`, mesmos do celular)
  e mostra pelo service worker `public/avisos-sw.js` (tocar abre o site). Sem servidor: nada sai do Drive.
- Aba/navegador fechado não toca: web push exigiria Cloud Functions (plano Blaze), que o dono decidiu não ativar.
  iPhone: só com o site instalado na tela de início.
- Console: foram criados um Firestore vazio (Standard, southamerica-east1) e uma chave VAPID no Cloud Messaging, hoje sem uso;
  pode apagar ou deixar (sem custo).
- Sair da conta desliga os avisos neste navegador. Android: nada muda.

## F9 — Aviso de atualização do APK — 06/11/2026
- APK no Drive (pasta FeedTec APK): https://drive.google.com/file/d/1kpX9jZED2jeXz6zp58fpD1iOlBBe_mEc/view
- O app Android lê `https://feedtec.web.app/versao.json` ao abrir; se `versao` > `version` do app.json, mostra faixa na tela inicial que abre o link.
- **Para lançar versão nova** (link do Drive nunca muda):
  1. Subir `version` em `app.json` e `versionName` + `versionCode` (+1) em `android/app/build.gradle`.
  2. Android Studio: Sync + build do APK debug (mesmo computador = mesma chave, instala por cima).
  3. Drive › clique direito no `app-debug.apk` › Gerenciar versões › Enviar nova versão.
  4. Atualizar `versao` em `public/versao.json` e `npm run deploy`.
- 08/11: versão subida para 0.1.1 (versionCode 2) à mão no app.json e build.gradle, para testar o aviso no APK 0.1.0.
- 09/11: transcrição em streaming (thinking low, sem reinício aos 120 s), Gemini já separa Eu/Técnico (botão Inverter) e botão "Arquivo" para enviar áudio de outro app (Files API acima de 15 MB). Novo módulo nativo expo-document-picker: precisa de Sync no Android Studio e APK novo.

## F10 — Ícone novo, splash com o nome e abertura que pula com toque — 07/11/2026
- [x] Ícone: arte do dono `D:\downloads\feedtec icone.png` (1254 px). `mipmap-*/ic_launcher_foreground.png` (arte nos 70 dp do centro) sobre `ic_launcher_background` #0034FA (mesmo azul da borda da arte); `ic_launcher(_round).webp` legados e `public/favicon.png` / `apple-touch-icon.png` regerados
- [x] Nome: `D:\downloads\nome feedtec sem fundo.png` limpo (respingos do recorte removidos, cores sólidas) → `assets/nome-feedtec.png`
- [x] Splash nativa: fundo #101827 + nome (`drawable-xxxhdpi/splashscreen_logo.png`, o `drawable/splashscreen_logo.xml` saiu)
- [x] `src/components/Abertura.tsx`: emenda na splash com o mesmo nome, fica 0,7 s e some; toque em qualquer lugar pula
- [ ] **Mudança nativa (à mão):** PNGs em `mipmap-*`, `drawable-xxxhdpi/splashscreen_logo.png`, cores em `values/colors.xml`
- [ ] **Dono (Android Studio):** Sync + Run; conferir ícone (redondo e quadrado) e a abertura

## F11 — Lembretes: avisar antes, repetição de 30 min e botão Feito — 07/11/2026
- [x] Tarefa e reunião ganham `antes` (minutos, 0–1440). Sem o campo: tarefa na hora, reunião 15 min antes (dados antigos seguem iguais)
- [x] `CampoAntes` (seletores.tsx): roleta de minutos (1–60) e de horas (1–24) + "Na hora"
- [x] `avisosDaAgenda` virou a fonte única (celular e site). Tarefa: avisa e repete a cada 30 min por até 4 h enquanto não for feita. Reunião: repete a cada 30 min até começar; recorrente agenda 4 semanas à frente com gatilho de data (o app refaz ao abrir)
- [x] Botão **Feito** na notificação: tarefa fica feita; reunião grava `ciente` (início da ocorrência) e para de repetir só nela. Marcar feita no app também para
- [x] Celular: categoria `lembrete` com ação `feito` (abre o app para o JS marcar); até 60 avisos agendados por vez
- [x] Site: `actions` + `requireInteraction` no aviso; `avisos-sw.js` manda o Feito para a aba aberta
- [x] Feito antes dos dados carregarem fica na fila (Estado.tsx) para não gravar sobre dados vazios
- [ ] Sem mudança nativa (expo-notifications já está no projeto)
- [ ] **Dono:** Sync + Run; criar tarefa com aviso 1 min antes, testar Feito com o app fechado e a repetição

## Fase 3 — redesign (em andamento)
- Paleta nova (azul #2457E7, amarelo #F5C842, noite #101827, claro #F5F7FC, sucesso #19A58B), tema claro/escuro seguindo o sistema, fonte Inter (`@expo-google-fonts/inter`, carregada em tempo de execução: **sem mudança nativa**).
- Barra inferior (Início, Técnicos, Tarefas, Reuniões, Mais) no lugar do menu lateral; lista de técnicos foi para `/tecnicos`.
- Home nova: saudação, 4 contadores e próximos compromissos (aprovada).
- Técnicos: avatar com iniciais e selo Ativo/Inativo (`inativo` no JSON; alternar no ⋮ do técnico; inativos no fim).
- Tarefas: abas Pendentes / Em andamento / Concluídas; campos novos opcionais `andamento`, `prioridade` (alta/baixa; ausente = média) e `responsavelId`.
- Reuniões: abas com contagem. Histórico: filtros Todos / A melhorar / Neutro / Positivo / Gravados.
- Perfil em seções (Integração com IA, Configurações, Sobre, Sair). Tema Sistema/Claro/Escuro guardado só no aparelho (AsyncStorage `feedtec.tema`).
- Conferido no navegador (escuro e claro). Sem mudança nativa. **Falta:** deploy (só com "sim") e teste no celular.
