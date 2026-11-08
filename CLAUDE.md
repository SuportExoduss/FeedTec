# FeedTec — guia para o Claude Code

App de feedbacks para a equipe técnica (gestão de OS): lista de técnicos, feedback escrito ou gravado,
IA (Gemini) formata nos tons A melhorar / Neutro / Positivo. Android + web para PC, um código só.
Mesmo modelo do navalha: **Expo SDK 58 + expo-router + react-native-web**.

## Onde estamos
- Roadmap: `docs/roadmap.md`. Andamento: `docs/status.md` (marcar só o que foi testado).
- Seguir as fases em ordem; não adiantar fase sem o dono pedir.

## Build Android: só pelo Android Studio (decisão do dono)
- A pasta `android/` é versionada e abre direto no Android Studio. **Sync e build são do dono.**
- Não rode `npx expo prebuild` (já foi rodado uma vez para criar `android/`), nem `expo run:android`, nem `gradlew`.
  Mudança nativa vai à mão em `android/` (e no `app.json`/plugin correspondente). Sem EAS e sem conta Expo.
- Ao mexer em algo nativo, anote em `docs/status.md` o que o dono precisa sincronizar/buildar.
- Web é testada no navegador do painel (`npx expo start --web`, sem `CI=1`: com ele o Metro não recarrega arquivos).

## Arquitetura
- Login: Firebase Auth (Google) — projeto `feedtec-app`. Web: pop-up; Android: `@react-native-google-signin`.
- Dados: **Google Drive do usuário**, pasta visível `FeedTec/` com `feedtec.json` (escopo `drive.file`).
  Sem Firestore. Cache no aparelho (AsyncStorage) e envio ao Drive logo depois (`src/Estado.tsx`).
- IA: Gemini chamado direto do app com a chave do próprio gestor (AI Studio), colada no Perfil e salva no
  `feedtec.json` dele. Sem servidor (decisão do dono). Prompt em `src/lib/prompt.ts`, chamada em `src/services/gemini.ts`.
- Pacote Android: `com.trevotec.feedtec`.

## Comandos
```bash
npm test             # lógica pura (src/lib) — tsx --test
npm run typecheck
npx expo export --platform web   # garante que o bundle compila
```
Antes de dizer que algo está pronto: testes, typecheck e export web passando.

## Convenções
- Tudo em português (nomes, textos). Comentários curtos explicando o porquê.
- Tela enxuta: o que não é essencial vai para o menu ⋮ (`Tela` em `src/components/ui.tsx`).
- Datas como `Millis` (número).
