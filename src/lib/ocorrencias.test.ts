import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adicionarOcorrencia, definirResumo, definirTipo, doTipo, deslocar, editarOcorrencia, intervalo, noPeriodo, ponderacao, porDia, removerOcorrencia, rotuloPeriodo, tiposExistentes } from './ocorrencias';
import { lerDadosJson } from './dados';
import { escolherTipo } from './prompt';
import { DADOS_VAZIOS } from '../types';

test('semana vai de segunda a domingo; mês e dia', () => {
  assert.deepEqual(intervalo('semana', '2026-11-12'), ['2026-11-09', '2026-11-15']); // quinta
  assert.deepEqual(intervalo('semana', '2026-11-15'), ['2026-11-09', '2026-11-15']); // domingo
  assert.deepEqual(intervalo('semana', '2026-11-16'), ['2026-11-16', '2026-11-22']); // segunda
  assert.deepEqual(intervalo('mes', '2026-02-10'), ['2026-02-01', '2026-02-28']);
  assert.equal(deslocar('mes', '2026-01-31', -1), '2025-12-01');
  assert.equal(deslocar('semana', '2026-12-28', 1), '2027-01-04');
  assert.equal(rotuloPeriodo('semana', '2026-11-12'), '09/11 a 15/11');
  assert.equal(rotuloPeriodo('mes', '2026-11-12'), 'novembro 2026');
});

test('adiciona, edita, filtra, agrupa e remove', () => {
  let { dados: d, nova } = adicionarOcorrencia(DADOS_VAZIOS, { dia: '2026-11-10', titulo: ' Cabo rompido ', observacao: '  ', fotos: ['f1'] }, 10);
  assert.equal(nova.titulo, 'Cabo rompido');
  assert.equal('observacao' in nova, false);
  d = adicionarOcorrencia(d, { dia: '2026-11-03', titulo: 'Poste caído' }, 20).dados;
  d = definirTipo(d, nova.id, 'Rede física', 30);
  d = editarOcorrencia(d, nova.id, { dia: '2026-11-10', titulo: 'Cabo rompido na rua', descricao: 'x' }, 40);
  assert.equal(d.ocorrencias![0].tipo, 'Rede física');
  assert.equal(d.ocorrencias![0].fotos, undefined);
  assert.equal(noPeriodo(d, 'semana', '2026-11-12').length, 1);
  assert.deepEqual(porDia(noPeriodo(d, 'mes', '2026-11-12')).map(g => g.dia), ['2026-11-10', '2026-11-03']);
  assert.throws(() => adicionarOcorrencia(d, { dia: '2026-11-03', titulo: ' ' }));
  assert.equal(removerOcorrencia(d, nova.id).ocorrencias!.length, 1);
});

test('ponderação conta por tipo no mês e nos anteriores', () => {
  let d = DADOS_VAZIOS;
  for (const [dia, tipo] of [['2026-11-02', 'A'], ['2026-11-05', 'A'], ['2026-10-01', 'A'], ['2026-11-07', 'B'], ['2026-06-01', 'A']]) {
    const r = adicionarOcorrencia(d, { dia, titulo: tipo });
    d = definirTipo(r.dados, r.nova.id, tipo);
  }
  d = adicionarOcorrencia(d, { dia: '2026-09-01', titulo: 'sem' }).dados;
  assert.deepEqual(ponderacao(d, '2026-11-12'), [
    { tipo: 'A', meses: [2, 1, 0, 0], total: 3 },
    { tipo: 'B', meses: [1, 0, 0, 0], total: 1 },
    { tipo: 'Sem tipo', meses: [0, 0, 1, 0], total: 1 },
  ]);
  assert.deepEqual(tiposExistentes(d).map(t => t.tipo), ['A', 'B']);
  assert.deepEqual(doTipo(d, 'A').map(o => o.dia), ['2026-11-05', '2026-11-02', '2026-10-01', '2026-06-01']);
  assert.equal(doTipo(d, 'Sem tipo').length, 1);
  assert.deepEqual(lerDadosJson(JSON.stringify({ ...definirResumo(d, 'A', 'Resumo'), resumos: { A: 'Resumo', B: 3 } }))!.resumos, { A: 'Resumo' });
});

test('JSON do Drive guarda ocorrências válidas', () => {
  const d = lerDadosJson(JSON.stringify({ versao: 1, tecnicos: [], alteradoEm: 1, ocorrencias: [
    { id: 'a', dia: '2026-11-10', titulo: 'T', tipo: 'X', fotos: ['f', 3], criadoEm: 5 }, { id: 'b', dia: 'ontem', titulo: 'T' }] }))!;
  assert.deepEqual(d.ocorrencias, [{ id: 'a', dia: '2026-11-10', titulo: 'T', tipo: 'X', fotos: ['f'], criadoEm: 5 }]);
});

test('tipo do Gemini usa a grafia de um tipo existente', () => {
  assert.equal(escolherTipo(' rede FÍSICA. ', ['Rede física', 'Cliente']), 'Rede física');
  assert.equal(escolherTipo('"Atraso na visita"', ['Rede física']), 'Atraso na visita');
  assert.equal(escolherTipo('', []), 'Outros');
});
