// Fotos das ocorrências: câmera ou galeria → reduz (~1600 px, JPEG) → pasta FeedTec no Drive. Mostra baixando do Drive.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { baixarArquivo, salvarArquivoNoDrive } from '../services/drive';
import { tokenDrive } from '../services/googleSignIn';
import { base64 } from '../services/gemini';
import { tamanho, type Foto } from '../lib/exportar';
import { colors, radius, space } from '../theme';

const LADO = 1600;
// ponytail: cache só em memória (some ao fechar o app); fotos pequenas, baixar de novo é barato.
const cache = new Map<string, Promise<Foto>>();

/** Foto do Drive como data URI (serve para <Image> e para a exportação). */
export function carregarFoto(id: string): Promise<Foto> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const token = await tokenDrive();
      if (!token) throw new Error('Entre de novo no Google para ver as fotos.');
      const uri = `data:image/jpeg;base64,${await base64(await baixarArquivo(token, id))}`;
      return { uri, ...(await tamanho(uri)) };
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Abre câmera ou galeria; devolve o id no Drive (ou null se cancelou). */
export async function escolherFoto(origem: 'camera' | 'galeria'): Promise<string | null> {
  if (origem === 'camera' && Platform.OS !== 'web' && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
    throw new Error('Libere a câmera para o FeedTec nas configurações do celular.');
  const r = await (origem === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({ mediaTypes: ['images'], quality: 1 });
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  const ctx = ImageManipulator.manipulate(a.uri);
  if (Math.max(a.width, a.height) > LADO) ctx.resize(a.width >= a.height ? { width: LADO } : { height: LADO });
  const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  const uri = `data:image/jpeg;base64,${img.base64}`;
  const token = await tokenDrive();
  if (!token) throw new Error('Entre de novo no Google para anexar fotos.');
  const blob = await (await fetch(uri)).blob();
  const id = await salvarArquivoNoDrive(token, new Blob([blob], { type: 'image/jpeg' }), `ocorrencia-${new Date().toISOString().slice(0, 16)}.jpg`);
  cache.set(id, Promise.resolve({ uri, largura: img.width, altura: img.height }));
  return id;
}

function Miniatura({ id, onPress, onRemover }: { id: string; onPress: () => void; onRemover?: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { carregarFoto(id).then(f => setUri(f.uri), () => setErro(true)); }, [id]);
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel="Abrir foto"
      style={{ width: 84, height: 84, borderRadius: radius.input, overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
        : erro ? <Ionicons name="image-outline" size={24} color={colors.textMuted} /> : <ActivityIndicator color={colors.textMuted} />}
      {onRemover ? (
        <Pressable onPress={onRemover} accessibilityRole="button" accessibilityLabel="Remover foto" hitSlop={8}
          style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 2 }}>
          <Ionicons name="close" size={16} color="#fff" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Linha de miniaturas; tocar abre a foto em tela cheia. */
export function Miniaturas({ ids, onRemover }: { ids: string[]; onRemover?: (id: string) => void }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => { setUri(null); if (aberta) carregarFoto(aberta).then(f => setUri(f.uri), () => undefined); }, [aberta]);
  if (!ids.length) return null;
  return (
    <>
      <ScrollView horizontal contentContainerStyle={{ gap: space(2) }}>
        {ids.map(id => <Miniatura key={id} id={id} onPress={() => setAberta(id)} onRemover={onRemover && (() => onRemover(id))} />)}
      </ScrollView>
      <Modal visible={!!aberta} transparent animationType="fade" onRequestClose={() => setAberta(null)}>
        <Pressable onPress={() => setAberta(null)} accessibilityLabel="Fechar foto"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {uri ? <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <ActivityIndicator color="#fff" />}
        </Pressable>
      </Modal>
    </>
  );
}
