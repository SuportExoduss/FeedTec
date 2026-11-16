// FeedTec Drive: mantém o site conectado ao Google Drive sem pedir login a cada hora.
// O site abre o Google num pop-up; o Google volta aqui (/retorno) com um código; trocamos pelo acesso
// (1 h) + chave de renovação usando o segredo do cliente (só este Worker conhece) e entregamos ao site
// por postMessage. Depois o site chama /renovar com a chave. Nada é guardado aqui.
const PERMITIDOS = ['https://feedtec.web.app', 'https://feedtec-app.web.app', 'http://localhost:8081'];
const TOKEN = 'https://oauth2.googleapis.com/token';

async function google(env, campos) {
  const r = await fetch(TOKEN, { method: 'POST', body: new URLSearchParams({ client_id: env.CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET.trim(), ...campos }) });
  return { ok: r.ok, dados: await r.json() };
}

function cors(origem) {
  return PERMITIDOS.includes(origem)
    ? { 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origem = req.headers.get('Origin') ?? '';

    if (url.pathname === '/retorno') {
      // state = "<origem do site>|<nonce>": só entregamos a uma origem da lista.
      const [alvo, nonce] = (url.searchParams.get('state') ?? '').split('|');
      if (!PERMITIDOS.includes(alvo) || !nonce) return new Response('Origem inválida.', { status: 400 });
      const code = url.searchParams.get('code');
      const res = code
        ? await google(env, { code, grant_type: 'authorization_code', redirect_uri: `${url.origin}/retorno` })
        : { ok: false, dados: { error: url.searchParams.get('error') ?? 'sem código' } };
      const msg = res.ok
        ? { nonce, access_token: res.dados.access_token, expires_in: res.dados.expires_in, refresh_token: res.dados.refresh_token, id_token: res.dados.id_token }
        : { nonce, erro: String(res.dados.error_description ?? res.dados.error ?? 'falhou') };
      const js = JSON.stringify(msg).replace(/</g, '\u003c');
      return new Response(`<!doctype html><meta charset="utf-8"><p>Pode fechar esta janela.</p><script>opener&&opener.postMessage(${js},${JSON.stringify(alvo)});close()</script>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }

    if (url.pathname === '/renovar') {
      const h = cors(origem);
      if (req.method === 'OPTIONS') return new Response(null, { status: h['Access-Control-Allow-Origin'] ? 204 : 403, headers: h });
      if (req.method !== 'POST' || !h['Access-Control-Allow-Origin']) return new Response('Proibido.', { status: 403 });
      const { refresh } = await req.json().catch(() => ({}));
      if (typeof refresh !== 'string' || !refresh) return Response.json({ erro: 'sem chave' }, { status: 400, headers: h });
      const res = await google(env, { refresh_token: refresh, grant_type: 'refresh_token' });
      // invalid_grant = chave revogada/vencida: o site pede login de novo.
      return Response.json(res.ok ? { access_token: res.dados.access_token, expires_in: res.dados.expires_in } : { erro: res.dados.error ?? 'falhou' },
        { status: res.ok ? 200 : 401, headers: { ...h, 'Cache-Control': 'no-store' } });
    }

    return new Response('FeedTec Drive', { status: 404 });
  },
};
