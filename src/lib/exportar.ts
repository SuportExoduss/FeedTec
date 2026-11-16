// Exportar ocorrências: Word (.docx com fotos), Excel (CSV com link das fotos) e PDF (com fotos).
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun } from 'docx';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Image, Platform } from 'react-native';
import { mostrarDia } from './agenda';
import { porDia } from './ocorrencias';
import type { Ocorrencia } from '../types';

/** Foto já baixada: data URI JPEG e tamanho em px. */
export type Foto = { uri: string; largura: number; altura: number };
export type Fotos = Record<string, Foto>;

export const linkFoto = (id: string) => `https://drive.google.com/file/d/${id}/view`;

export const tamanho = (uri: string) =>
  new Promise<{ largura: number; altura: number }>((ok, falha) => Image.getSize(uri, (largura, altura) => ok({ largura, altura }), falha));

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/** Salva e abre o "compartilhar" (celular) ou baixa o arquivo (web). */
async function entregar(nome: string, mime: string, conteudo: string | ArrayBuffer) {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: mime }));
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    return;
  }
  const f = new File(Paths.cache, nome);
  if (f.exists) f.delete();
  await f.write(conteudo);
  await Sharing.shareAsync(f.uri, { mimeType: mime, dialogTitle: 'Salvar ou enviar' });
}

export function csv(os: Ocorrencia[]): string {
  const cel = (s = '') => `"${s.replace(/"/g, '""')}"`;
  const linhas = [['Dia', 'Título', 'Tipo', 'Descrição', 'Observação', 'Fotos'],
    ...[...os].sort((a, b) => a.dia.localeCompare(b.dia) || a.criadoEm - b.criadoEm).map(o =>
      [mostrarDia(o.dia), o.titulo, o.tipo ?? '', o.descricao ?? '', o.observacao ?? '', (o.fotos ?? []).map(linkFoto).join(' ')])];
  // BOM + ";" = o Excel em português abre com acentos e colunas certas.
  return '﻿' + linhas.map(l => l.map(cel).join(';')).join('\r\n');
}

export function html(titulo: string, os: Ocorrencia[], fotos: Fotos): string {
  const corpo = porDia(os).reverse().map(g => `<h2>${mostrarDia(g.dia)} · ${g.itens.length}</h2>` + g.itens.map(o => `
    <div class="oc"><h3>${esc(o.titulo)}${o.tipo ? ` <small>${esc(o.tipo)}</small>` : ''}</h3>
    ${o.descricao ? `<p>${esc(o.descricao)}</p>` : ''}${o.observacao ? `<p><b>Observação:</b> ${esc(o.observacao)}</p>` : ''}
    ${(o.fotos ?? []).filter(id => fotos[id]).map(id => `<img src="${fotos[id].uri}">`).join('')}</div>`).join('')).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    body{font-family:Arial,sans-serif;color:#101827;margin:24px} h1{font-size:20px} h2{font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}
    h3{font-size:14px;margin:0 0 4px} small{color:#2457E7;font-weight:normal} p{font-size:13px;margin:4px 0}
    .oc{margin:10px 0 16px;break-inside:avoid} img{max-width:48%;max-height:320px;margin:6px 6px 0 0;border-radius:6px}
  </style></head><body><h1>${esc(titulo)}</h1><p>${os.length} ocorrência(s)</p>${corpo}</body></html>`;
}

async function docx(titulo: string, os: Ocorrencia[], fotos: Fotos): Promise<ArrayBuffer> {
  const filhos: Paragraph[] = [new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
    new Paragraph(`${os.length} ocorrência(s)`)];
  for (const g of porDia(os).reverse()) {
    filhos.push(new Paragraph({ text: `${mostrarDia(g.dia)} · ${g.itens.length}`, heading: HeadingLevel.HEADING_2 }));
    for (const o of g.itens) {
      filhos.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(o.titulo), ...(o.tipo ? [new TextRun({ text: `  ${o.tipo}`, color: '2457E7' })] : [])] }));
      if (o.descricao) filhos.push(...o.descricao.split('\n').map(l => new Paragraph(l)));
      if (o.observacao) filhos.push(new Paragraph({ children: [new TextRun({ text: 'Observação: ', bold: true }), new TextRun(o.observacao)] }));
      for (const id of o.fotos ?? []) {
        const f = fotos[id];
        if (!f) continue;
        const w = Math.min(400, f.largura);
        filhos.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ type: 'jpg', data: f.uri, transformation: { width: w, height: Math.round(w * f.altura / f.largura) } })] }));
      }
    }
  }
  return Packer.toArrayBuffer(new Document({ sections: [{ children: filhos }] }));
}

export type Formato = 'word' | 'excel' | 'pdf';

export async function exportar(formato: Formato, titulo: string, os: Ocorrencia[], fotos: Fotos) {
  const nome = titulo.replace(/[\\/:*?"<>|]/g, '-');
  if (formato === 'excel') return entregar(`${nome}.csv`, 'text/csv', csv(os));
  if (formato === 'word') return entregar(`${nome}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', await docx(titulo, os, fotos));
  const pagina = html(titulo, os, fotos);
  if (Platform.OS === 'web') {
    // Abre a página e chama a impressão do navegador ("Salvar como PDF").
    const w = window.open('', '_blank');
    if (!w) throw new Error('O navegador bloqueou a janela. Libere pop-ups para este site.');
    w.document.write(pagina.replace('</body>', '<script>onload = () => print()</script></body>'));
    w.document.close();
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: pagina });
  const f = new File(Paths.cache, `${nome}.pdf`);
  if (f.exists) f.delete();
  await new File(uri).move(f);
  await Sharing.shareAsync(f.uri, { mimeType: 'application/pdf', dialogTitle: 'Salvar ou enviar' });
}
