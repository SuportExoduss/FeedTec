// Lembretes com o app fechado (Android), no mesmo esquema do Navalha: o app confere sozinho a bateria
// (BateriaPackage.kt → FeedTecBateria) e o alarme exato, e abre direto a tela certa da marca do celular.
// Cada lista é uma ordem de tentativas; a última é sempre uma tela padrão do Android. Base: AutoStarter e
// dontkillmyapp.com; as telas da Xiaomi foram testadas no Navalha (Redmi Note 13, HyperOS 2, out/2026).
// Não usamos REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: a Google Play restringe essa permissão.
import { Linking, NativeModules, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as N from 'expo-notifications';

const PACOTE = 'com.trevotec.feedtec';

interface TelaAjuste { acao: string; pacote?: string; classe?: string; dados?: string; extras?: Record<string, string> }

const MAIN = 'android.intent.action.MAIN';
const tela = (pacote: string, classe: string, extras?: Record<string, string>): TelaAjuste => ({ acao: MAIN, pacote, classe, extras });
/** "Uso da bateria pelo app" (Android 12+) e, de reserva, os detalhes do app (existe em todo Android). */
const PADRAO: TelaAjuste[] = [
  { acao: 'android.settings.VIEW_ADVANCED_POWER_USAGE_DETAIL', dados: `package:${PACOTE}` },
  { acao: 'android.settings.APPLICATION_DETAILS_SETTINGS', dados: `package:${PACOTE}` },
];

const fabricante = () => String((Platform.constants as { Manufacturer?: string }).Manufacturer ?? '').toLowerCase();
const xiaomi = () => /xiaomi|redmi|poco/.test(fabricante());
const huawei = () => /huawei|honor/.test(fabricante());

function telasBateria(): TelaAjuste[] {
  if (xiaomi()) return [
    tela('com.miui.securitycenter', 'com.miui.powercenter.legacypowerrank.PowerDetailActivity', { package_name: PACOTE }),
    tela('com.miui.powerkeeper', 'com.miui.powerkeeper.ui.HiddenAppsConfigActivity', { package_name: PACOTE, package_label: 'FeedTec' }),
    ...PADRAO,
  ];
  if (huawei()) return [tela('com.huawei.systemmanager', 'com.huawei.systemmanager.power.ui.HwPowerManagerActivity'), ...PADRAO];
  if (fabricante().includes('asus')) return [tela('com.asus.mobilemanager', 'com.asus.mobilemanager.powersaver.PowerSaverSettings'), ...PADRAO];
  return PADRAO;
}

/** O que fazer na tela que abrir (o texto acompanha a marca). */
export function passosBateria(): string {
  if (xiaomi()) return 'Escolha “Nenhuma restrição”.';
  if (fabricante().includes('samsung')) return 'Escolha “Sem restrições” (ou ligue “Permitir uso em segundo plano”).';
  if (huawei()) return 'Deixe o FeedTec sem restrição de bateria.';
  return 'Ligue “Permitir uso em segundo plano” (ou escolha “Sem restrições”).';
}

/** Abre a primeira tela que existir; o intent-launcher rejeita na hora quando não existe, então tenta a próxima. */
export async function abrirBateria(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const t of telasBateria()) {
    try {
      await IntentLauncher.startActivityAsync(t.acao, {
        ...(t.pacote ? { packageName: t.pacote } : {}), ...(t.classe ? { className: t.classe } : {}),
        ...(t.dados ? { data: t.dados } : {}), ...(t.extras ? { extra: t.extras } : {}),
      });
      return;
    } catch { /* esta marca/versão não tem essa tela */ }
  }
  await Linking.openSettings().catch(() => undefined);
}

export async function bateriaLiberada(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const m = NativeModules.FeedTecBateria as { liberada(): Promise<boolean> } | undefined;
  return m ? m.liberada().catch(() => false) : false;
}

/** Sem o alarme exato, o Android pode atrasar o lembrete vários minutos. */
export async function alarmeExato(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (await N.getExactAlarmPermissionsAsync().catch(() => ({ granted: false }))).granted;
}

export const pedirAlarmeExato = () => N.requestExactAlarmPermissionsAsync().catch(() => undefined);

/** Tudo pronto para avisar com o app fechado? */
export async function avisosLiberados(): Promise<boolean> {
  const [b, a] = await Promise.all([bateriaLiberada(), alarmeExato()]);
  return b && a;
}
