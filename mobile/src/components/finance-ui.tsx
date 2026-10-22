import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import type { TransactionKind } from '@/lib/finance';

export function FinanceCard({
  children,
  theme,
  style,
  ...props
}: ViewProps & { theme: ThemeColors }) {
  return (
    <View
      {...props}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function FinanceButton({
  title,
  onPress,
  theme,
  variant = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  theme: ThemeColors;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const backgroundColor =
    variant === 'primary'
      ? theme.primary
      : variant === 'danger'
        ? theme.expenseBackground
        : theme.surfaceAlt;
  const color =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'danger'
        ? theme.expense
        : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.55 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function FinanceField({
  label,
  theme,
  inputStyle,
  ...props
}: TextInputProps & { label: string; theme: ThemeColors; inputStyle?: object }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            color: theme.text,
          },
          inputStyle,
        ]}
      />
    </View>
  );
}

export function CategoryChoices({
  kind,
  categories,
  selected,
  onSelect,
  theme,
  disabled = false,
}: {
  kind: TransactionKind;
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  theme: ThemeColors;
  disabled?: boolean;
}) {
  return (
    <View style={styles.categoryList}>
      {categories.map((category) => {
        const active = selected === category;
        const tint = kind === 'income' ? theme.income : theme.primary;
        return (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onSelect(category)}
            style={[
              styles.categoryChoice,
              {
                backgroundColor: active ? theme.primarySoft : theme.surfaceAlt,
                borderColor: active ? tint : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: active ? tint : theme.textSecondary },
              ]}
            >
              {category}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ScreenTitle({
  title,
  subtitle,
  theme,
}: {
  title: string;
  subtitle: string;
  theme: ThemeColors;
}) {
  return (
    <View style={styles.screenTitle}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        {subtitle}
      </Text>
    </View>
  );
}

export const financeUiStyles = StyleSheet.create({
  body: { flex: 1 },
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowSpace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heading: { fontSize: 18, fontWeight: '800' },
  text: { fontSize: 14, lineHeight: 20 },
  muted: { fontSize: 13, lineHeight: 19 },
  divider: { height: StyleSheet.hairlineWidth },
  stack: { gap: 12 },
  amount: { fontWeight: '800', fontSize: 15 },
  empty: { textAlign: 'center', paddingVertical: 24, lineHeight: 21 },
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  fieldGroup: { gap: 7 },
  label: { fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 15,
  },
  categoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChoice: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  categoryText: { fontSize: 13, fontWeight: '600' },
  screenTitle: { gap: 4, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 14, lineHeight: 20 },
});
