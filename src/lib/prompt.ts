// Monta o pedido ao Gemini. Puro (sem rede) para dar para testar.
import type { Fala, Tom } from '../types';

export const ROTULO_TOM: Record<Tom, string> = { melhorar: 'A melhorar', neutro: 'Neutro', positivo: 'Positivo' };

const OBJETIVO: Record<Tom, string> = {
  melhorar: 'tonalidade firme e construtiva: dar destaque aos pontos a corrigir e às metas combinadas, sem deixar de ser respeitoso',
  neutro: 'tonalidade objetiva e equilibrada: registrar o que foi conversado e alinhado sem pender para elogio nem cobrança',
  positivo: 'tonalidade de reconhecimento e incentivo: valorizar os resultados e o potencial, tratando os pontos a melhorar como próximos passos de crescimento',
};

export const INSTRUCAO = `Você transforma as anotações de um supervisor de equipe técnica (ordens de serviço, instalação, campo e manutenção) no registro formal de um feedback.
Escreva em português do Brasil como o próprio supervisor escrevendo o registro: tudo o que o supervisor fez, disse ou fará vai em primeira pessoa ("eu apresentei…", "reforcei que…", "estarei acompanhando…"), nunca "o supervisor". O técnico aparece em terceira pessoa ("o técnico demonstrou…", "ele manifestou…"). Não soe como alguém de fora contando o que viu ou ouviu.
Transforme as anotações num documento de acompanhamento profissional, fluido e humano, como o registro de uma conversa real (não um formulário): melhore o vocabulário, a pontuação e a ordem das ideias, um parágrafo por assunto. Varie as referências ao técnico (nome, "ele", "o colaborador") em vez de repetir "o técnico".
Pode reescrever frases, explicar melhor o porquê de cada ponto (o impacto de uma meta, a razão de um alinhamento) e fechar com um parágrafo de conclusão e o objetivo para os próximos meses, desde que tudo saia do que está nas anotações.
Não invente fatos: nada de nomes, datas, números, metas, ocorrências ou reações do técnico que não estejam nas anotações. Mantenha todos os números e nomes citados.
O tom escolhido muda a tonalidade do texto inteiro, não os fatos.
As anotações podem ser a transcrição da conversa ("Eu:" é o supervisor, "Técnico:" é o técnico): nesse caso identifique só os assuntos mais relevantes (desempenho, problemas, combinados, metas e próximos passos) e faça um resumo enxuto do que foi conversado e combinado, sem copiar as falas, sem citar diálogo e sem registrar conversa paralela, repetições ou rodeios. O registro de uma conversa gravada deve caber em poucos parágrafos curtos, mesmo que a conversa tenha sido longa.
Se vier "Contexto do gestor", use-o para entender e priorizar os assuntos e respeite as ressalvas dele (o que omitir, como tratar um ponto); não trate o contexto como fato novo da conversa sem que ele diga isso.
Responda apenas com o texto do feedback, sem título, sem cabeçalho, sem markdown e sem comentários seus. Um parágrafo por assunto, quantos as anotações pedirem.`;

export function montarPedido(tom: Tom, nomeTecnico: string, anotacoes: string, contexto = ''): string {
  const a = anotacoes.trim();
  if (!a) throw new Error('Escreva o que aconteceu antes de gerar.');
  const c = contexto.trim();
  return `Técnico: ${nomeTecnico}
Tom: ${ROTULO_TOM[tom]} — o objetivo é ${OBJETIVO[tom]}.${c ? `
Contexto do gestor (ressalvas para gerar):
"""
${c}
"""` : ''}
Anotações do gestor:
"""
${a}
"""`;
}

/** Pede a conversa já separada entre o gestor ("eu") e o técnico, para não perguntar quem é quem. */
export const transcricao = (tecnico: string) => `Transcreva em português do Brasil esta conversa de feedback entre um supervisor e o técnico ${tecnico}.
Em cada trecho diga quem fala: "eu" é o supervisor (quem conduz a conversa, avalia, cobra, elogia e combina metas) e "tecnico" é ${tecnico}. Se não der para distinguir pela voz, decida pelo conteúdo.
Junte frases seguidas da mesma pessoa num só item.
Transcreva fielmente, só corrigindo a pontuação; não resuma, não invente e ignore ruídos.
Responda só com JSON: [{"quem":"eu","texto":"..."},{"quem":"tecnico","texto":"..."}]`;

/** Lê o JSON da transcrição sem confiar nele: descarta itens estranhos. */
export function lerTranscricao(json: string): Fala[] {
  try {
    const a = JSON.parse(json.replace(/^```(json)?|```$/g, '').trim());
    return (Array.isArray(a) ? a : [])
      .filter(t => (t?.quem === 'eu' || t?.quem === 'tecnico') && typeof t.texto === 'string' && t.texto.trim())
      .map(t => ({ quem: t.quem, texto: t.texto.trim() }));
  } catch {
    return [];
  }
}

/** Para quando o Gemini troca quem é quem. */
export const inverterFalas = (falas: Fala[]): Fala[] =>
  falas.map(f => ({ ...f, quem: f.quem === 'eu' ? 'tecnico' : 'eu' }));

/** A conversa vira as "anotações" que seguem para o feedback. */
export const conversaComoTexto = (falas: Fala[]) =>
  falas.map(f => `${f.quem === 'eu' ? 'Eu' : 'Técnico'}: ${f.texto}`).join('\n');
