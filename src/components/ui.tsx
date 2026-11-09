// Peças de tela. Regra do app: pouca coisa visível; o resto fica no menu ⋮ do canto superior.
// Telas sem `voltar` são abas: a barra inferior (BarraAbas) cuida da margem de baixo.
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { colors, fonte, radius, space, type } from '../theme';

/** Coluna central: em tablet e computador tudo fica na mesma largura e alinhado ao centro. */
export const COLUNA = { width: '100%', maxWidth: 720, alignSelf: 'center' } as const;

export interface ItemMenu { titulo: string; onPress: () => void; perigo?: boolean }

/** Cabeçalho enxuto: voltar, título e ⋮ com as opções escondidas. */
export function Tela({ titulo, voltar, menu, children }: {
  titulo: string; voltar?: boolean; menu?: ItemMenu[]; children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <SafeAreaView edges={voltar ? undefined : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(2), height: 56, gap: space(1), ...COLUNA }}>
        {voltar ? <Icone nome="arrow-back" rotulo="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          : <View style={{ width: space(2) }} />}
        <Text accessibilityRole="header" numberOfLines={1} style={[type.title, { flex: 1, fontSize: 22 }]}>{titulo}</Text>
        {menu?.length ? <Icone nome="ellipsis-vertical" rotulo="Mais opções" onPress={() => setAberto(true)} /> : null}
      </View>
      <View style={{ flex: 1, ...COLUNA }}>{children}</View>
      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={{ flex: 1 }} onPress={() => setAberto(false)} accessibilityLabel="Fechar menu">
          <SafeAreaView style={{ alignItems: 'flex-end', padding: space(2) }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, minWidth: 200, paddingVertical: space(1) }}>
              {menu?.map(i => (
                <Pressable key={i.titulo} accessibilityRole="menuitem" onPress={() => { setAberto(false); i.onPress(); }}
                  style={({ pressed }) => ({ paddingVertical: space(3), paddingHorizontal: space(4), opacity: pressed ? 0.6 : 1 })}>
                  <Text style={[type.body, i.perigo && { color: colors.danger }]}>{i.titulo}</Text>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

export function Icone({ nome, rotulo, onPress, cor = colors.text }: { nome: keyof typeof Ionicons.glyphMap; rotulo: string; onPress: () => void; cor?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo} hitSlop={8}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={nome} size={22} color={cor} />
    </Pressable>
  );
}

export function Botao({ titulo, onPress, carregando, disabled, secundario, icone }: {
  titulo: string; onPress: () => void; carregando?: boolean; disabled?: boolean; secundario?: boolean; icone?: ReactNode;
}) {
  const off = disabled || carregando;
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!carregando }}
      style={({ pressed }) => ({
        minHeight: 48, borderRadius: radius.input, flexDirection: 'row', gap: space(2), alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: space(4), backgroundColor: secundario ? 'transparent' : colors.accent,
        borderWidth: secundario ? 1 : 0, borderColor: colors.border, opacity: off ? 0.5 : pressed ? 0.8 : 1,
      })}>
      {carregando ? <ActivityIndicator color={secundario ? colors.text : colors.accentText} /> : icone}
      <Text style={{ fontSize: 16, fontFamily: fonte.semi, color: secundario ? colors.text : colors.accentText }}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({ rotulo, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ gap: space(1) }}>
      <Text style={type.caption}>{rotulo}</Text>
      <TextInput accessibilityLabel={rotulo} placeholderTextColor={colors.textMuted} {...props}
        style={{ minHeight: 48, borderRadius: radius.input, borderWidth: 1, borderColor: colors.border, color: colors.text,
          paddingHorizontal: space(3), fontSize: 16, fontFamily: fonte.regular, backgroundColor: colors.bg,
          ...(props.multiline ? { minHeight: 140, paddingVertical: space(3), textAlignVertical: 'top' as const } : {}) }} />
    </View>
  );
}

/** Janela central para formulários curtos (ex.: novo técnico). */
export function Dialogo({ visivel, titulo, onFechar, children }: { visivel: boolean; titulo: string; onFechar: () => void; children: ReactNode }) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: space(5) }}>
        <View style={{ width: '100%', maxWidth: 440, maxHeight: '100%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.card }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space(5), gap: space(4) }}>
            <Text accessibilityRole="header" style={[type.title, { fontSize: 20 }]}>{titulo}</Text>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Abas: até 3 opções viram um seletor segmentado (uma linha, larguras iguais, fonte se ajusta à largura medida);
 *  mais que isso, uma linha só de chips com rolagem lateral. Nunca quebram linha. */
export function Abas<T extends string>({ opcoes, valor, onChange }: { opcoes: { valor: T; titulo: string }[]; valor: T; onChange: (v: T) => void }) {
  const [largura, setLargura] = useState(0);
  if (opcoes.length > 3) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: space(2) }}>
        {opcoes.map(o => {
          const sel = o.valor === valor;
          return (
            <Pressable key={o.valor} accessibilityRole="tab" accessibilityState={{ selected: sel }} onPress={() => onChange(o.valor)}
              style={{ height: 36, justifyContent: 'center', paddingHorizontal: space(4), borderRadius: 999, borderWidth: 1,
                borderColor: sel ? colors.accent : colors.border, backgroundColor: sel ? colors.accent : 'transparent' }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: fonte.semi, color: sel ? colors.accentText : colors.text }}>{o.titulo}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }
  // ponytail: largura de letra estimada (0,6 × fonte para Inter semibold); medir texto de verdade se algum rótulo cortar.
  const maior = Math.max(...opcoes.map(o => o.titulo.length));
  const util = largura / opcoes.length - space(3) * 2 - 8;
  const fonteTam = largura ? Math.max(11, Math.min(14, util / (maior * 0.6))) : 14;
  return (
    <View accessibilityRole="tablist" onLayout={e => setLargura(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      {opcoes.map(o => {
        const sel = o.valor === valor;
        return (
          <Pressable key={o.valor} accessibilityRole="tab" accessibilityState={{ selected: sel }} onPress={() => onChange(o.valor)}
            style={{ flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(1), borderRadius: 999,
              backgroundColor: sel ? colors.accent : 'transparent' }}>
            <Text numberOfLines={1} style={{ fontSize: fonteTam, fontFamily: fonte.semi, color: sel ? colors.accentText : colors.textMuted }}>{o.titulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Caixa de marcar com texto. */
export function Marca({ texto, marcado, onPress, children }: { texto: string; marcado: boolean; onPress: () => void; children?: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }}
      style={({ pressed }) => ({ flexDirection: 'row', gap: space(3), alignItems: 'flex-start', paddingVertical: space(2), opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={marcado ? 'checkbox' : 'square-outline'} size={24} color={marcado ? colors.accent : colors.textMuted} />
      <View style={{ flex: 1, gap: space(1) }}>
        <Text style={[type.body, { fontFamily: fonte.semi }]}>{texto}</Text>
        {children}
      </View>
    </Pressable>
  );
}

/** Botão + flutuante no canto (adicionar). */
export function BotaoMais({ rotulo, onPress }: { rotulo: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={rotulo}
      style={({ pressed }) => ({ position: 'absolute', right: space(5), bottom: space(6), width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
      <Ionicons name="add" size={28} color={colors.accentText} />
    </Pressable>
  );
}

/** Etiqueta pequena colorida (status, prioridade). */
export const Selo = ({ texto, cor }: { texto: string; cor: string }) => (
  <Text style={{ fontSize: 12, fontFamily: fonte.semi, color: cor, backgroundColor: cor + '22', paddingHorizontal: space(2),
    paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>{texto}</Text>
);

const TONS_AVATAR = ['#2457E7', '#19A58B', '#C99A0E', '#8B5CF6', '#E5675B'];
/** Círculo com as iniciais; a cor sai do nome, então é sempre a mesma para a pessoa. */
export function Avatar({ nome, tamanho = 44, apagado }: { nome: string; tamanho?: number; apagado?: boolean }) {
  const partes = nome.trim().split(/\s+/);
  const iniciais = ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  const cor = apagado ? colors.textMuted : TONS_AVATAR[[...nome].reduce((s, c) => s + c.charCodeAt(0), 0) % TONS_AVATAR.length];
  return (
    <View style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor + '2E', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: cor, fontFamily: fonte.negrito, fontSize: tamanho * 0.36 }}>{iniciais}</Text>
    </View>
  );
}

export const Erro =({ texto }: { texto: string | null }) =>
  texto ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 14 }}>{texto}</Text> : null;

/** Confirmação que funciona no Android (Alert) e na web (Alert não faz nada lá). */
export function confirmar(titulo: string, mensagem: string, acao: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${titulo}\n\n${mensagem}`));
  return new Promise(ok => Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel', onPress: () => ok(false) },
    { text: acao, style: 'destructive', onPress: () => ok(true) },
  ], { cancelable: true, onDismiss: () => ok(false) }));
}

export const mensagem = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado. Tente de novo.');
