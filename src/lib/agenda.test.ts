import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adicionarReuniao, moverTarefa, situacao, adicionarTarefa, alternarFeita, avisosDaAgenda, concluirAviso, editarTarefa, lerDia, lerHora, proximaReuniao, registrarReuniao, removerTarefa, reuniaoDeHoje, reunioesOrdenadas, tarefasOrdenadas } from './agenda';
import { adicionarTecnico, alternarAtivo, lerDadosJson, tecnicosOrdenados } from './dados';
import { DADOS_VAZIOS } from '../types';

const agora = new Date(2026, 10, 6, 10, 0).getTime(); // sexta, 06/11/2026 10:00

test('lê hora e dia digitados', () => {
  assert.equal(lerHora('9:30'), '09:30');
  assert.equal(lerHora('0930'), '09:30');
  assert.equal(lerHora('24:00'), null);
  assert.equal(lerDia('10/11', agora), '2026-11-10');
  assert.equal(lerDia('01/01', agora), '2027-01-01'); // já passou: ano que vem
  assert.equal(lerDia('06/11', agora), '2026-11-06'); // hoje vale
  assert.equal(lerDia('31/02/2026', agora), null);
  assert.equal(lerDia('5/3/27', agora), '2027-03-05');
});

test('próxima reunião semanal', () => {
  const r = { id: 'r', titulo: 'Equipe', diaSemana: 5, hora: '09:00', pautas: [], criadoEm: 0 }; // sexta 9h: já passou hoje
  assert.equal(proximaReuniao(r, agora).getDate(), 13);
  assert.equal(proximaReuniao({ ...r, hora: '11:00' }, agora).getDate(), 6);
  assert.equal(proximaReuniao({ ...r, diaSemana: 1 }, agora).getDate(), 9);
  assert.equal(proximaReuniao({ ...r, dia: '2026-11-20' }, agora).getDate(), 20); // única
});

test('tarefas e reuniões: CRUD, ordem e volta do JSON', () => {
  let d = adicionarTarefa(DADOS_VAZIOS, { titulo: ' Vistoria ', dia: '2026-11-10', hora: '8:00' }, 1);
  d = adicionarTarefa(d, { titulo: 'Relatório', dia: '2026-11-07' }, 2);
  d = adicionarTarefa(d, { titulo: 'Ligar', dia: '2026-11-07', hora: '14:00', descricao: ' cliente ' }, 3);
  assert.throws(() => adicionarTarefa(d, { titulo: 'x', dia: '2026-11-07', hora: '25:00' }));
  assert.throws(() => adicionarTarefa(d, { titulo: ' ', dia: '2026-11-07' }));
  assert.deepEqual(tarefasOrdenadas(d).map(t => t.titulo), ['Ligar', 'Relatório', 'Vistoria']);
  const ligar = tarefasOrdenadas(d)[0];
  assert.equal(ligar.descricao, 'cliente');
  d = alternarFeita(d, ligar.id, 4);
  assert.deepEqual(tarefasOrdenadas(d).map(t => t.titulo), ['Relatório', 'Vistoria', 'Ligar']);
  d = editarTarefa(d, ligar.id, { titulo: 'Ligar de novo', dia: '2026-11-08' }, 5);
  const editada = d.tarefas!.find(t => t.id === ligar.id)!;
  assert.equal(editada.feita, true);
  assert.equal(editada.hora, undefined);
  d = adicionarReuniao(d, { titulo: 'Equipe', diaSemana: 1, hora: '9:00', pautas: [] }, 6);
  d = adicionarReuniao(d, { titulo: 'Gerência', diaSemana: 5, hora: '11:00', pautas: [] }, 7);
  assert.deepEqual(reunioesOrdenadas(d, agora).map(r => r.titulo), ['Gerência', 'Equipe']);
  const lido = lerDadosJson(JSON.stringify(d))!;
  assert.deepEqual(lido.tarefas, d.tarefas);
  assert.deepEqual(lido.reunioes, d.reunioes);
  d = removerTarefa(d, ligar.id, 8);
  assert.equal(d.tarefas!.length, 2);
  const sujo = JSON.parse(JSON.stringify(d));
  sujo.tarefas[0].dia = '2026-02-31';
  sujo.reunioes[0].diaSemana = 9;
  const limpo = lerDadosJson(JSON.stringify(sujo))!;
  assert.equal(limpo.tarefas!.length, 1);
  assert.equal(limpo.reunioes!.length, 1);
});

test('reunião do dia: pautas não tratadas ficam no registro, não seguem', () => {
  const pautas = [{ id: 'a', titulo: 'Metas', descricao: 'linha 1\nlinha 2' }, { id: 'b', titulo: 'Férias' }];
  let d = adicionarReuniao(DADOS_VAZIOS, { titulo: 'Equipe', diaSemana: 5, hora: '09:00', pautas }, 1);
  d = adicionarReuniao(d, { titulo: 'Cliente', diaSemana: 0, dia: '2026-11-06', hora: '15:00', pautas: [{ id: 'c', titulo: 'Proposta' }] }, 2);
  assert.throws(() => adicionarReuniao(d, { titulo: 'x', diaSemana: 1, hora: '09:00', pautas: [{ id: 'z', titulo: ' ' }] }));
  const [eq, cli] = d.reunioes!;
  assert.equal(cli.diaSemana, 5); // sai da data
  assert.ok(reuniaoDeHoje(d, eq, agora) && reuniaoDeHoje(d, cli, agora));
  d = registrarReuniao(d, eq.id, ['a'], ' Meta de 95% ', agora);
  assert.deepEqual(d.reunioes!.find(r => r.id === eq.id)!.pautas, []); // recorrente volta vazia
  assert.equal(reuniaoDeHoje(d, d.reunioes!.find(r => r.id === eq.id)!, agora), false);
  d = registrarReuniao(d, cli.id, [], '', agora);
  assert.equal(d.reunioes!.length, 1); // única sai da agenda
  const feita = d.realizadas![0];
  assert.deepEqual(feita.pautas.map(p => [p.id, p.tratada]), [['a', true], ['b', false]]);
  assert.equal(feita.devolutiva, 'Meta de 95%');
  assert.equal(feita.dia, '2026-11-06');
  assert.deepEqual(lerDadosJson(JSON.stringify(d))!.realizadas, d.realizadas);
  // JSON da F5: descrição vira a 1ª pauta
  const velho = lerDadosJson(JSON.stringify({ versao: 1, tecnicos: [], reunioes: [{ id: 'v', titulo: 'V', diaSemana: 2, hora: '08:00', descricao: 'Pontos', criadoEm: 0 }] }))!;
  assert.deepEqual(velho.reunioes![0].pautas, [{ id: 'v-p', titulo: 'Pauta', descricao: 'Pontos' }]);
});

test('avisos: antes, repetição de 30 min e Feito', () => {
  const h = (dia: number, hh: number, mm = 0) => new Date(2026, 10, dia, hh, mm).getTime();
  let d = adicionarTarefa(DADOS_VAZIOS, { titulo: 'Ligar', dia: '2026-11-06', hora: '14:00', antes: 60 }, agora);
  d = adicionarTarefa(d, { titulo: 'Passou', dia: '2026-11-06', hora: '06:00' }, agora); // 4 h de repetição já acabaram
  d = adicionarTarefa(d, { titulo: 'Sem hora', dia: '2026-11-06', antes: 30 }, agora);
  d = adicionarReuniao(d, { titulo: 'Semanal', diaSemana: 5, hora: '10:10', pautas: [] }, agora); // aviso de hoje (9:55) já passou
  d = adicionarReuniao(d, { titulo: 'Única', diaSemana: 0, dia: '2026-11-09', hora: '08:00', antes: 90, pautas: [{ id: 'p', titulo: 'x' }] }, agora);
  assert.equal(d.tarefas![2].antes, undefined); // sem hora, sem aviso
  const av = avisosDaAgenda(d, agora);
  const de = (t: string) => av.filter(a => a.titulo === t).map(a => a.quando);
  assert.deepEqual(de('Ligar'), Array.from({ length: 9 }, (_, i) => h(6, 13) + i * 30 * 60000));
  assert.deepEqual(de('Passou'), []);
  assert.deepEqual(de('Única'), [h(9, 6, 30), h(9, 7), h(9, 7, 30)]);
  assert.deepEqual(de('Semanal'), [h(13, 9, 55), h(20, 9, 55), h(27, 9, 55)]); // 4 semanas contando hoje
  assert.equal(av.find(a => a.titulo === 'Única')!.corpo, 'Reunião às 08:00 · 1 pauta');
  assert.ok(av.every((a, i) => i === 0 || av[i - 1].quando <= a.quando));
  assert.equal(new Set(av.map(a => a.id)).size, av.length);

  // Feito: tarefa fica feita; reunião para só naquela ocorrência.
  const tarefa = av.find(a => a.titulo === 'Ligar')!.alvo;
  const semana = av.find(a => a.titulo === 'Semanal')!.alvo;
  let f = concluirAviso(d, tarefa, agora + 1);
  f = concluirAviso(f, semana, agora + 1);
  assert.equal(f.tarefas![0].feita, true);
  assert.deepEqual(avisosDaAgenda(f, agora).filter(a => a.titulo === 'Semanal').map(a => a.quando), [h(20, 9, 55), h(27, 9, 55)]);
  assert.equal(concluirAviso(f, { tipo: 'tarefa', id: 'sumiu' }, agora + 2), f);
});

test('tarefa: prioridade, responsável, situação e técnico inativo', () => {
  let d = adicionarTarefa(DADOS_VAZIOS, { titulo: 'A', dia: '2026-11-10', prioridade: 'alta', responsavelId: 't1' }, 1);
  d = adicionarTarefa(d, { titulo: 'B', dia: '2026-11-10', prioridade: 'media' }, 2);
  const [a, b] = d.tarefas!;
  assert.equal(a.prioridade, 'alta'); assert.equal(a.responsavelId, 't1'); assert.equal(b.prioridade, undefined);
  d = moverTarefa(d, a.id, 'andamento', 3);
  assert.equal(situacao(d.tarefas![0]), 'andamento');
  d = editarTarefa(d, a.id, { titulo: 'A2', dia: '2026-11-11', prioridade: 'baixa' }, 4);
  assert.equal(situacao(d.tarefas![0]), 'andamento'); assert.equal(d.tarefas![0].responsavelId, undefined);
  d = moverTarefa(d, a.id, 'concluida', 5);
  assert.deepEqual([d.tarefas![0].feita, d.tarefas![0].andamento], [true, undefined]);
  d = adicionarTecnico(adicionarTecnico(d, 'Ana', '', 6), 'Bia', '', 7);
  d = alternarAtivo(d, d.tecnicos[0].id, 8);
  assert.deepEqual(tecnicosOrdenados(d).map(t => t.nome), ['Bia', 'Ana']);
  const volta = lerDadosJson(JSON.stringify({ ...d, tarefas: [...d.tarefas!, { ...b, id: 'x', prioridade: 'urgente', andamento: 'sim' }] }))!;
  assert.deepEqual(volta.tarefas![0], d.tarefas![0]);
  assert.deepEqual([volta.tarefas![2].prioridade, volta.tarefas![2].andamento], [undefined, undefined]);
  assert.equal(volta.tecnicos[0].inativo, true);
  assert.equal(alternarAtivo(d, d.tecnicos[0].id, 9).tecnicos[0].inativo, undefined);
});
