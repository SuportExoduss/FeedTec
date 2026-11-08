// Campos de data e hora: tocar abre um calendário ou um relógio no tema do app (sem lib nem seletor do sistema).
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { diaIso, mostrarDia, textoAntes } from '../lib/agenda';
import { colors, radius, space, type } from '../theme';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const dois = (n: number) => String(n).padStart(2, '0');

/** Parece um Campo; mostra o valor e abre o seletor. */
function Gatilho({ rotulo, texto, icone, onPress }: { rotulo: string; texto?: string; icone: 'calendar-outline' | 'time-outline' | 'notifications-outline'; onPress: () => void }) {
  return (
    <View style={{ gap: space(1), flex: 1 }}>
      <Text style={type.caption}>{rotulo}</Text>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${rotulo}: ${texto ?? 'escolher'}`}
        style={({ pressed }) => ({ minHeight: 48, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
          paddingHorizontal: space(3), flexDirection: 'row', alignItems: 'center', gap: space(2), opacity: pressed ? 0.7 : 1 })}>
        <Ionicons name={icone} size={18} color={colors.textMuted} />
        <Text style={[type.body, !texto && { color: colors.textMuted }]}>{texto ?? 'Escolher'}</Text>
      </Pressable>
    </View>
  );
}

function Janela({ visivel, onFechar, children, rodape }: { visivel: boolean; onFechar: () => void; children: React.ReactNode; rodape: React.ReactNode }) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable onPress={onFechar} accessibilityLabel="Fechar" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space(5) }}>
        <Pressable style={{ width: '100%', maxWidth: 340, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.card,
          borderWidth: 1, borderColor: colors.border, padding: space(4), gap: space(3) }}>
          {children}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space(2) }}>{rodape}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const Acao = ({ titulo, onPress, cor = colors.accent }: { titulo: string; onPress: () => void; cor?: string }) => (
  <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}
    style={({ pressed }) => ({ paddingVertical: space(2), paddingHorizontal: space(3), opacity: pressed ? 0.6 : 1 })}>
    <Text style={{ color: cor, fontWeight: '600', fontSize: 15 }}>{titulo}</Text>
  </Pressable>
);

/** Data em AAAA-MM-DD. `opcional` mostra "Limpar". */
export function CampoData({ rotulo, valor, onChange, opcional }: { rotulo: string; valor?: string; onChange: (iso: string | undefined) => void; opcional?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const hoje = diaIso(new Date());
  const base = valor ?? hoje;
  const [mes, setMes] = useState({ a: +base.slice(0, 4), m: +base.slice(5, 7) - 1 });
  const abrir = () => { const b = valor ?? hoje; setMes({ a: +b.slice(0, 4), m: +b.slice(5, 7) - 1 }); setAberto(true); };
  const andar = (n: number) => setMes(({ a, m }) => ({ a: a + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));
  const vazios = new Date(mes.a, mes.m, 1).getDay();
  const total = new Date(mes.a, mes.m + 1, 0).getDate();
  const celulas = [...Array(vazios).fill(0), ...Array.from({ length: total }, (_, i) => i + 1)];
  const escolher = (iso?: string) => { onChange(iso); setAberto(false); };
  return (
    <>
      <Gatilho rotulo={rotulo} texto={valor ? mostrarDia(valor) : undefined} icone="calendar-outline" onPress={abrir} />
      <Janela visivel={aberto} onFechar={() => setAberto(false)}
        rodape={<>{opcional && valor ? <Acao titulo="Limpar" cor={colors.textMuted} onPress={() => escolher(undefined)} /> : null}
          <Acao titulo="Hoje" onPress={() => escolher(hoje)} /><Acao titulo="Cancelar" cor={colors.textMuted} onPress={() => setAberto(false)} /></>}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => andar(-1)} accessibilityLabel="Mês anterior" hitSlop={8} style={{ padding: space(2) }}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={[type.body, { flex: 1, textAlign: 'center', fontWeight: '600' }]}>{MESES[mes.m]} {mes.a}</Text>
          <Pressable onPress={() => andar(1)} accessibilityLabel="Próximo mês" hitSlop={8} style={{ padding: space(2) }}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((l, i) => (
            <Text key={i} style={[type.caption, { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: space(1) }]}>{l}</Text>
          ))}
          {celulas.map((n, i) => {
            if (!n) return <View key={`v${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
            const iso = `${mes.a}-${dois(mes.m + 1)}-${dois(n)}`;
            const sel = iso === valor;
            return (
              <View key={iso} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                <Pressable onPress={() => escolher(iso)} accessibilityRole="button" accessibilityLabel={mostrarDia(iso)} accessibilityState={{ selected: sel }}
                  style={({ pressed }) => ({ flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: sel ? colors.accent : pressed ? colors.border : 'transparent',
                    borderWidth: iso === hoje && !sel ? 1 : 0, borderColor: colors.accent })}>
                  <Text style={{ fontSize: 15, color: sel ? colors.accentText : colors.text, fontWeight: sel ? '700' : '400' }}>{n}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Janela>
    </>
  );
}

const TAM = 252; // diâmetro do relógio
const BOLA = 36;

/** Número no anel, a `r` px do centro; 0 = topo, sentido horário. */
function Numero({ pos, r, texto, sel, pequeno, onPress }: { pos: number; r: number; texto: string; sel: boolean; pequeno?: boolean; onPress: () => void }) {
  const ang = (pos / 12) * 2 * Math.PI;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ selected: sel }} hitSlop={2}
      style={{ position: 'absolute', width: BOLA, height: BOLA, borderRadius: BOLA / 2, alignItems: 'center', justifyContent: 'center',
        left: TAM / 2 + r * Math.sin(ang) - BOLA / 2, top: TAM / 2 - r * Math.cos(ang) - BOLA / 2, backgroundColor: sel ? colors.accent : 'transparent' }}>
      <Text style={{ fontSize: pequeno ? 13 : 15, color: sel ? colors.accentText : pequeno ? colors.textMuted : colors.text, fontWeight: sel ? '700' : '400' }}>{texto}</Text>
    </Pressable>
  );
}

/** Hora em HH:MM. Primeiro as horas (anel de fora 1–12, de dentro 13–00), depois os minutos de 5 em 5. */
export function CampoHora({ rotulo, valor, onChange, opcional }: { rotulo: string; valor?: string; onChange: (hora: string | undefined) => void; opcional?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<'h' | 'm'>('h');
  const [h, setH] = useState(9);
  const [m, setM] = useState(0);
  const abrir = () => {
    const [vh, vm] = (valor ?? '09:00').split(':').map(Number);
    setH(vh); setM(vm); setModo('h'); setAberto(true);
  };
  const fora = TAM / 2 - BOLA / 2 - 4;
  const dentro = fora - 40;
  // ponteiro: de 0 a 12 posições; horas de dentro (13–23 e 0) têm ponteiro mais curto
  const pos = modo === 'h' ? h % 12 : m / 5;
  const curto = modo === 'h' && (h === 0 || h > 12);
  const ponteiro = curto ? dentro : fora;
  const titulo = (t: string, ativo: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={4} style={{ paddingHorizontal: space(2), borderRadius: radius.input, backgroundColor: ativo ? colors.border : 'transparent' }}>
      <Text style={{ fontSize: 44, fontWeight: '600', color: ativo ? colors.accent : colors.text }}>{t}</Text>
    </Pressable>
  );
  return (
    <>
      <Gatilho rotulo={rotulo} texto={valor} icone="time-outline" onPress={abrir} />
      <Janela visivel={aberto} onFechar={() => setAberto(false)}
        rodape={<>{opcional && valor ? <Acao titulo="Limpar" cor={colors.textMuted} onPress={() => { onChange(undefined); setAberto(false); }} /> : null}
          <Acao titulo="Cancelar" cor={colors.textMuted} onPress={() => setAberto(false)} />
          <Acao titulo="OK" onPress={() => { onChange(`${dois(h)}:${dois(m)}`); setAberto(false); }} /></>}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          {titulo(dois(h), modo === 'h', () => setModo('h'))}
          <Text style={{ fontSize: 44, color: colors.textMuted }}>:</Text>
          {titulo(dois(m), modo === 'm', () => setModo('m'))}
        </View>
        <View style={{ width: TAM, height: TAM, borderRadius: TAM / 2, backgroundColor: colors.bg, alignSelf: 'center' }}>
          {/* ponteiro: um quadrado do tamanho do relógio girado em volta do centro, com a linha do centro para cima */}
          <View pointerEvents="none" style={{ position: 'absolute', width: TAM, height: TAM, transform: [{ rotate: `${pos * 30}deg` }] }}>
            <View style={{ position: 'absolute', left: TAM / 2 - 1, top: TAM / 2 - ponteiro, width: 2, height: ponteiro, backgroundColor: colors.accent }} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: TAM / 2 - 4, top: TAM / 2 - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
          {modo === 'h' ? <>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <Numero key={n} pos={n % 12} r={fora} texto={String(n)} sel={h === n} onPress={() => { setH(n); setModo('m'); }} />
            ))}
            {Array.from({ length: 12 }, (_, i) => (i + 13) % 24).map(n => (
              <Numero key={n} pos={n % 12} r={dentro} texto={dois(n)} sel={h === n} pequeno onPress={() => { setH(n); setModo('m'); }} />
            ))}
          </> : Array.from({ length: 12 }, (_, i) => i * 5).map(n => (
            <Numero key={n} pos={n / 5} r={fora} texto={dois(n)} sel={m === n} onPress={() => setM(n)} />
          ))}
        </View>
      </Janela>
    </>
  );
}

const MINUTOS = Array.from({ length: 60 }, (_, i) => i + 1);
const HORAS = Array.from({ length: 24 }, (_, i) => i + 1);

/** Quanto tempo antes avisar, em minutos: roleta de minutos (1–60) e de horas (1–24); "Na hora" = 0. */
export function CampoAntes({ rotulo, valor, onChange }: { rotulo: string; valor: number; onChange: (min: number) => void }) {
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState(valor);
  const escolher = (min: number) => { onChange(min); setAberto(false); };
  const roleta = (titulo: string, itens: number[], fator: number, sufixo: string) => (
    <View style={{ flex: 1, gap: space(1) }}>
      <Text style={[type.caption, { textAlign: 'center' }]}>{titulo}</Text>
      <ScrollView style={{ height: 220, borderRadius: radius.input, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space(1) }}>
        {itens.map(n => {
          const ativo = n * fator === sel;
          return (
            <Pressable key={n} onPress={() => setSel(n * fator)} accessibilityRole="button" accessibilityLabel={`${n} ${sufixo}`} accessibilityState={{ selected: ativo }}
              style={({ pressed }) => ({ minHeight: 40, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center',
                backgroundColor: ativo ? colors.accent : pressed ? colors.border : 'transparent' })}>
              <Text style={{ fontSize: 15, color: ativo ? colors.accentText : colors.text, fontWeight: ativo ? '700' : '400' }}>{n} {sufixo}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
  return (
    <>
      <Gatilho rotulo={rotulo} texto={textoAntes(valor)} icone="notifications-outline" onPress={() => { setSel(valor); setAberto(true); }} />
      <Janela visivel={aberto} onFechar={() => setAberto(false)}
        rodape={<><Acao titulo="Na hora" cor={colors.textMuted} onPress={() => escolher(0)} />
          <Acao titulo="Cancelar" cor={colors.textMuted} onPress={() => setAberto(false)} />
          <Acao titulo="OK" onPress={() => escolher(sel)} /></>}>
        <Text style={[type.body, { textAlign: 'center', fontWeight: '600' }]}>{textoAntes(sel)}</Text>
        <View style={{ flexDirection: 'row', gap: space(3) }}>
          {roleta('Minutos', MINUTOS, 1, 'min')}
          {roleta('Horas', HORAS, 60, 'h')}
        </View>
      </Janela>
    </>
  );
}
