import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SPACING, FONT_SIZES } from '../constants/theme';
import { Palette } from '../theme/palettes';
import { useThemedStyles } from '../theme/ThemeContext';
import { useAuth, Role } from '../auth/AuthContext';
import { callApi, describeApiError } from '../services/api/apiClient';
import { loadAverias } from '../services/storageService';
import { confirmAction, showMessage } from '../utils/dialogs';

type Tab = 'users' | 'audit' | 'settings' | 'migration';

type TecnicoRow = {
  id: string;
  nombre: string;
  email: string | null;
  rol: Role;
  activo: boolean;
  codigo: { estado: string; expiraEn: string | null; diasRestantes: number; pendienteEntrega: boolean; codigoId: string | null };
};

type AuditRow = { id: number; en: string; actor_nombre: string | null; accion: string; objetivo: string | null; detalle: unknown };

const ROLES: Role[] = ['administrador', 'tecnico', 'consulta'];
const ROLE_LABEL: Record<Role, string> = { administrador: 'Administrador', tecnico: 'Técnico', consulta: 'Consulta' };
const BACKUP_KEY = '@gestion_averias/backup_premigracion';
const ONE_TIME = 'Guárdalo ahora: no se volverá a mostrar.';

export function AdminScreen({ onDataChanged }: { onDataChanged: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('users');

  if (!isAdmin) return <Text style={styles.hint}>Solo los administradores pueden acceder.</Text>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Usuarios' },
    { key: 'audit', label: 'Auditoría' },
    { key: 'settings', label: 'Ajustes' },
    { key: 'migration', label: 'Migración' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading} accessibilityRole="header">
        Administración
      </Text>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
            style={[styles.tab, tab === t.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'users' ? <UsersTab /> : null}
      {tab === 'audit' ? <AuditTab /> : null}
      {tab === 'settings' ? <SettingsTab /> : null}
      {tab === 'migration' ? <MigrationTab onDataChanged={onDataChanged} /> : null}
    </ScrollView>
  );
}

function UsersTab() {
  const styles = useThemedStyles(createStyles);
  const { tecnico: me } = useAuth();
  const [rows, setRows] = useState<TecnicoRow[] | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Role>('tecnico');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await callApi<{ tecnicos: TecnicoRow[] }>('tecnicos.list');
      setRows(r.tecnicos);
    } catch (e) {
      showMessage('Error', describeApiError(e));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      showMessage('Error', describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      if (!nombre.trim()) throw new Error('Indica el nombre del técnico.');
      const r = await callApi<{ code: string; expiraEn: string }>('tecnicos.create', { nombre, email, rol });
      setNombre('');
      setEmail('');
      showMessage('Técnico creado', `Código de acceso de ${nombre}:\n\n${r.code}\n\nVálido hasta ${new Date(r.expiraEn).toLocaleDateString()}.\nEntrégalo por un canal seguro. ${ONE_TIME}`);
    });

  const reissue = (t: TecnicoRow) =>
    confirmAction('Reemitir código', `Se generará un código nuevo para ${t.nombre} y se cerrarán sus sesiones.`, 'Reemitir', 'Cancelar', () =>
      void run(async () => {
        const r = await callApi<{ code: string }>('codigos.reemitir', { tecnicoId: t.id, motivo: 'Reemisión por administrador' });
        showMessage('Nuevo código', `${t.nombre}:\n\n${r.code}\n\n${ONE_TIME}`);
      })
    );

  const revoke = (t: TecnicoRow) =>
    confirmAction('Revocar código', `${t.nombre} no podrá acceder hasta que reemitas un código. Se cierran sus sesiones al instante.`, 'Revocar', 'Cancelar', () =>
      void run(async () => {
        await callApi('codigos.revocar', { tecnicoId: t.id, motivo: 'Revocado por posible compromiso' });
      })
    );

  const collect = (t: TecnicoRow) =>
    run(async () => {
      const r = await callApi<{ code: string }>('codigos.recoger', { codigoId: t.codigo.codigoId });
      showMessage('Código pendiente de entrega', `${t.nombre}:\n\n${r.code}\n\n${ONE_TIME}`);
    });

  const toggleActive = (t: TecnicoRow) =>
    confirmAction(t.activo ? 'Desactivar usuario' : 'Activar usuario', t.nombre, 'Confirmar', 'Cancelar', () =>
      void run(async () => {
        await callApi('tecnicos.update', { id: t.id, activo: !t.activo });
      })
    );

  const changeRole = (t: TecnicoRow, next: Role) =>
    run(async () => {
      await callApi('tecnicos.update', { id: t.id, rol: next });
    });

  return (
    <View style={styles.section}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nuevo técnico</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre completo" placeholderTextColor="#888" accessibilityLabel="Nombre completo" />
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Correo (opcional)" autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#888" accessibilityLabel="Correo" />
        <View style={styles.chips}>
          {ROLES.map((r) => (
            <Pressable key={r} onPress={() => setRol(r)} accessibilityRole="radio" accessibilityState={{ selected: rol === r }} style={[styles.chip, rol === r && styles.chipActive]}>
              <Text style={[styles.chipText, rol === r && styles.chipTextActive]}>{ROLE_LABEL[r]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={create} disabled={busy} accessibilityRole="button">
          <Text style={styles.buttonText}>Crear y generar código</Text>
        </Pressable>
      </View>

      {rows === null ? <ActivityIndicator /> : null}
      {rows?.map((t) => (
        <View key={t.id} style={styles.card}>
          <Text style={styles.name}>
            {t.nombre}
            {t.id === me?.id ? ' (tú)' : ''}
          </Text>
          <Text style={styles.hint}>
            {ROLE_LABEL[t.rol]} · {t.activo ? 'Activo' : 'Desactivado'} · {t.email ?? 'sin correo'}
          </Text>
          <Text style={styles.hint}>
            Código: {t.codigo.estado}
            {t.codigo.estado === 'activo' ? ` · caduca ${new Date(t.codigo.expiraEn!).toLocaleDateString()} (${t.codigo.diasRestantes} d)` : ''}
            {t.codigo.pendienteEntrega ? ' · PENDIENTE DE ENTREGA' : ''}
          </Text>
          <View style={styles.chips}>
            {ROLES.map((r) => (
              <Pressable key={r} onPress={() => r !== t.rol && void changeRole(t, r)} accessibilityRole="radio" accessibilityState={{ selected: t.rol === r }} style={[styles.chip, t.rol === r && styles.chipActive]}>
                <Text style={[styles.chipText, t.rol === r && styles.chipTextActive]}>{ROLE_LABEL[r]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chips}>
            {t.codigo.pendienteEntrega ? <SmallButton label="Recoger código" onPress={() => void collect(t)} /> : null}
            <SmallButton label="Reemitir código" onPress={() => reissue(t)} />
            <SmallButton label="Revocar" onPress={() => revoke(t)} />
            <SmallButton label={t.activo ? 'Desactivar' : 'Activar'} onPress={() => toggleActive(t)} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable style={styles.small} onPress={onPress} accessibilityRole="button">
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

function AuditTab() {
  const styles = useThemedStyles(createStyles);
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    callApi<{ eventos: AuditRow[] }>('auditoria.list', { limit: 200 })
      .then((r) => setRows(r.eventos))
      .catch((e) => {
        showMessage('Error', describeApiError(e));
        setRows([]);
      });
  }, []);

  if (rows === null) return <ActivityIndicator />;
  if (rows.length === 0) return <Text style={styles.hint}>Sin eventos registrados.</Text>;
  return (
    <View style={styles.section}>
      {rows.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.name}>{r.accion}</Text>
          <Text style={styles.hint}>
            {new Date(r.en).toLocaleString()} · {r.actor_nombre ?? 'Sistema'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SettingsTab() {
  const styles = useThemedStyles(createStyles);
  const [contacto, setContacto] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    callApi<{ contacto: string }>('config.public', {}, { token: null }).then((r) => setContacto(r.contacto)).catch(() => undefined);
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await callApi('config.set', { contacto });
      showMessage('Guardado', 'El contacto para solicitar códigos se ha actualizado.');
    } catch (e) {
      showMessage('Error', describeApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Contacto para solicitar códigos</Text>
      <Text style={styles.hint}>Se muestra en la pantalla de acceso a quien pulsa «¿Necesitas un código de acceso?».</Text>
      <TextInput style={styles.input} value={contacto} onChangeText={setContacto} autoCapitalize="none" accessibilityLabel="Contacto" />
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={save} disabled={busy} accessibilityRole="button">
        <Text style={styles.buttonText}>Guardar</Text>
      </Pressable>
    </View>
  );
}

type LegacyPhoto = { uri?: string; remoteUrl?: string; id: string; fileName: string; mimeType: string; width?: number; height?: number };

function MigrationTab({ onDataChanged }: { onDataChanged: () => void }) {
  const styles = useThemedStyles(createStyles);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const migrate = () =>
    confirmAction(
      'Migrar datos de este dispositivo',
      'Se hará una copia de seguridad local y se añadirán al servidor los registros que aún no existan. No se borra ni se sobrescribe nada.',
      'Migrar',
      'Cancelar',
      () =>
        void (async () => {
          setBusy(true);
          try {
            const legacy = await loadAverias();
            if (legacy.length === 0) {
              setResult('Este dispositivo no tiene datos antiguos que migrar.');
              return;
            }
            await AsyncStorage.setItem(BACKUP_KEY, JSON.stringify({ fecha: new Date().toISOString(), averias: legacy }));

            let skippedPhotos = 0;
            const payload = legacy.map((a) => {
              const fotos = ((a.fotos ?? []) as LegacyPhoto[]).flatMap((p) => {
                const url = p.remoteUrl || (p.uri && /^https:\/\//i.test(p.uri) ? p.uri : '');
                if (!url) {
                  skippedPhotos++;
                  return [];
                }
                return [{ id: p.id, fileName: p.fileName, mimeType: p.mimeType, width: p.width, height: p.height, remoteUrl: url }];
              });
              return { ...a, fotos };
            });

            let inserted = 0;
            let skipped = 0;
            for (let i = 0; i < payload.length; i += 200) {
              const r = await callApi<{ inserted: number; skipped: number }>('averias.import', { averias: payload.slice(i, i + 200), origen: 'migracion-local' });
              inserted += r.inserted;
              skipped += r.skipped;
            }
            onDataChanged();
            setResult(
              `Migración completada.\n• Registros nuevos en el servidor: ${inserted}\n• Ya existían (no se tocaron): ${skipped}\n• Fotos que solo existían en este dispositivo y no se pudieron migrar: ${skippedPhotos}\n• Copia de seguridad guardada en este dispositivo.`
            );
          } catch (e) {
            setResult(`No se pudo completar la migración: ${describeApiError(e)}. Tus datos locales siguen intactos; puedes reintentar.`);
          } finally {
            setBusy(false);
          }
        })()
    );

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Migrar datos antiguos</Text>
      <Text style={styles.hint}>
        Copia al servidor central las averías guardadas en este dispositivo (la copia local anterior). Ejecútalo en el equipo que tenga los datos más completos. Es repetible: lo que ya exista se omite.
      </Text>
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={migrate} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Migrar datos de este dispositivo</Text>}
      </Pressable>
      {result ? <Text style={styles.hint}>{result}</Text> : null}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 96, width: '100%', maxWidth: 720, alignSelf: 'center' },
    heading: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text },
    section: { gap: SPACING.sm },
    tabs: { flexDirection: 'row', backgroundColor: COLORS.surfaceAlt, borderRadius: 10, padding: 3, gap: 3, borderWidth: 1, borderColor: COLORS.border },
    tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
    tabActive: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.text, fontWeight: '600', fontSize: FONT_SIZES.sm },
    tabTextActive: { color: COLORS.onPrimary },
    card: { backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, gap: SPACING.sm },
    cardTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.text },
    name: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.text },
    hint: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, lineHeight: 18 },
    input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, color: COLORS.text, borderRadius: 10, paddingHorizontal: SPACING.md, fontSize: FONT_SIZES.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: { minHeight: 40, paddingHorizontal: SPACING.md, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.text, fontSize: FONT_SIZES.sm, fontWeight: '600' },
    chipTextActive: { color: COLORS.onPrimary },
    button: { minHeight: 48, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    buttonText: { color: COLORS.onPrimary, fontWeight: '700' },
    disabled: { opacity: 0.6 },
    small: { minHeight: 40, paddingHorizontal: SPACING.md, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    smallText: { color: COLORS.primary, fontWeight: '600', fontSize: FONT_SIZES.sm },
  });
