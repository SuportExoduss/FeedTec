import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adicionarFeedback, adicionarTecnico, definirChaveGemini, editarTecnico, feedbacksPorDia, lerDadosJson, maisNova, maisRecente, removerFeedback, removerTecnico, tecnicosOrdenados } from './dados';
import { conversaComoTexto, inverterFalas, lerTranscricao, montarPedido } from './prompt';
import { DADOS_VAZIOS } from '../types';

test('adiciona, edita, ordena e remove técnicos', () => {
  let d = adicionarTecnico(DADOS_VAZIOS, '  Zé   Silva ', 'Campo', 10);
  d = adicionarTecnico(d, 'Ana', '', 20);
  assert.deepEqual(tecnicosOrdenados(d).map(t => t.nome), ['Ana', 'Zé Silva']);
  assert.equal(d.tecnicos[1].funcao, undefined);
  assert.equal(d.alteradoEm, 20);

  const ze = d.tecnicos[0];
  d = editarTecnico(d, ze.id, 'José', '', 30);
  assert.equal(d.tecnicos[0].nome, 'José');
  assert.equal('funcao' in d.tecnicos[0], false);

  d = removerTecnico(d, ze.id, 40);
  assert.deepEqual(d.tecnicos.map(t => t.nome), ['Ana']);
});

test('recusa nome vazio ou repetido', () => {
  const d = adicionarTecnico(DADOS_VAZIOS, 'Ana');
  assert.throws(() => adicionarTecnico(d, '   '));
  assert.throws(() => adicionarTecnico(d, 'ana'));
  assert.throws(() => editarTecnico(adicionarTecnico(d, 'Bia'), d.tecnicos[0].id, 'BIA'));
});

test('vence o mais recente e JSON inválido vira null', () => {
  const a = { ...DADOS_VAZIOS, alteradoEm: 1 }, b = { ...DADOS_VAZIOS, alteradoEm: 2 };
  assert.equal(maisRecente(a, b), b);
  assert.equal(maisRecente(b, a), b);
  assert.equal(lerDadosJson('lixo'), null);
  assert.equal(lerDadosJson('{"versao":2,"tecnicos":[]}'), null);
  assert.deepEqual(lerDadosJson('{"versao":1,"tecnicos":[{"id":"x","nome":"A"},{"nome":3}],"alteradoEm":5}')?.tecnicos, [{ id: 'x', nome: 'A' }]);
});

test('feedbacks: adiciona, agrupa por dia, remove junto com o técnico', () => {
  let d = adicionarTecnico(DADOS_VAZIOS, 'Ana', '', 1);
  const ana = d.tecnicos[0].id;
  const dia1 = new Date(2026, 10, 3, 9).getTime();
  const dia2 = new Date(2026, 10, 5, 9).getTime();
  d = adicionarFeedback(d, ana, 'positivo', ' bom ', 'Parabéns', dia1);
  d = adicionarFeedback(d, ana, 'melhorar', 'atraso', 'Atenção', dia2);
  d = adicionarFeedback(d, ana, 'neutro', 'x', 'Registro', dia2 + 1000);
  assert.throws(() => adicionarFeedback(d, ana, 'neutro', 'x', '  '));
  const grupos = feedbacksPorDia(d, ana);
  assert.deepEqual(grupos.map(g => g.dia), ['05/11/2026', '03/11/2026']);
  assert.deepEqual(grupos[0].itens.map(f => f.texto), ['Registro', 'Atenção']);
  assert.equal(d.feedbacks[0].bruto, 'bom');

  d = removerFeedback(d, grupos[0].itens[0].id, 5);
  assert.equal(d.feedbacks.length, 2);
  d = removerTecnico(d, ana, 6);
  assert.equal(d.feedbacks.length, 0);
});

test('feedback gravado: conversa e áudio vão e voltam do JSON; lixo é descartado', () => {
  let d = adicionarTecnico(DADOS_VAZIOS, 'Ana', '', 1);
  const conversa = [{ quem: 'eu' as const, texto: 'Oi' }, { quem: 'tecnico' as const, texto: 'Bom dia' }];
  d = adicionarFeedback(d, d.tecnicos[0].id, 'neutro', 'Oi', 'Registro', 2, { conversa, audioId: 'a1' });
  const lido = lerDadosJson(JSON.stringify(d))!;
  assert.deepEqual(lido.feedbacks[0].conversa, conversa);
  assert.equal(lido.feedbacks[0].audioId, 'a1');
  const sujo = JSON.parse(JSON.stringify(d));
  sujo.feedbacks[0].conversa = [{ quem: 'outro', texto: 1 }];
  sujo.feedbacks[0].audioId = 5;
  const limpo = lerDadosJson(JSON.stringify(sujo))!.feedbacks[0];
  assert.equal(limpo.conversa, undefined);
  assert.equal(limpo.audioId, undefined);
});

test('chave Gemini e JSON antigo sem feedbacks', () => {
  let d = definirChaveGemini(DADOS_VAZIOS, ' abc ', 1);
  assert.equal(d.chaveGemini, 'abc');
  d = definirChaveGemini(d, '', 2);
  assert.equal('chaveGemini' in d, false);
  const antigo = lerDadosJson('{"versao":1,"tecnicos":[],"alteradoEm":3}');
  assert.deepEqual(antigo?.feedbacks, []);
  const ruim = lerDadosJson('{"versao":1,"tecnicos":[],"feedbacks":[{"id":"1","tecnicoId":"t","texto":"a","tom":"bravo"}],"alteradoEm":3}');
  assert.deepEqual(ruim?.feedbacks, []);
});

test('pedido ao Gemini leva tom, nome e anotações', () => {
  const p = montarPedido('melhorar', 'Ana', '  chegou atrasada na OS 12 ');
  assert.match(p, /Técnico: Ana/);
  assert.match(p, /A melhorar/);
  assert.match(p, /chegou atrasada na OS 12/);
  assert.throws(() => montarPedido('neutro', 'Ana', '   '));
  assert.ok(!p.includes('Contexto do gestor'));
  assert.ok(montarPedido('neutro', 'Ana', 'x', ' não citar atraso ').includes('Contexto do gestor (ressalvas para gerar):\n"""\nnão citar atraso\n"""'));
});

test('transcrição: aceita JSON do Gemini e descarta lixo', () => {
  assert.deepEqual(lerTranscricao('```json\n[{"quem":"eu","texto":" Oi "},{"quem":"A","texto":"x"},{"quem":"tecnico","texto":""},{"quem":"tecnico","texto":"Bom dia"}]\n```'),
    [{ quem: 'eu', texto: 'Oi' }, { quem: 'tecnico', texto: 'Bom dia' }]);
  assert.deepEqual(lerTranscricao('não é json'), []);
});

test('inverte quem fala e vira anotações', () => {
  const falas = inverterFalas([{ quem: 'eu', texto: 'Oi' }, { quem: 'tecnico', texto: 'Bom dia' }]);
  assert.deepEqual(falas.map(f => f.quem), ['tecnico', 'eu']);
  assert.equal(conversaComoTexto(falas), 'Técnico: Oi\nEu: Bom dia');
});

test('histórico geral: todos os técnicos e só gravados', () => {
  let d = adicionarTecnico(adicionarTecnico(DADOS_VAZIOS, 'Ana', '', 1), 'Bia', '', 2);
  const [ana, bia] = d.tecnicos.map(t => t.id);
  d = adicionarFeedback(d, ana, 'neutro', 'x', 'Escrito', 3);
  d = adicionarFeedback(d, bia, 'neutro', 'x', 'Gravado', 4, { conversa: [{ quem: 'eu', texto: 'Oi' }] });
  assert.deepEqual(feedbacksPorDia(d).flatMap(g => g.itens.map(f => f.texto)), ['Gravado', 'Escrito']);
  assert.deepEqual(feedbacksPorDia(d, undefined, true).flatMap(g => g.itens.map(f => f.texto)), ['Gravado']);
});

test('versão nova do APK', () => {
  assert.ok(maisNova('0.2.0', '0.1.10'));
  assert.ok(maisNova('0.1.10', '0.1.9'));
  assert.ok(maisNova('1.0', '0.9.9'));
  assert.ok(!maisNova('0.1.0', '0.1.0'));
  assert.ok(!maisNova('0.1.0', '0.2.0'));
});
