
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useURL } from 'expo-linking';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemeColors } from '@/constants/theme';
import { FinanceField } from '@/components/finance-ui';
import {
  currentMonth,
  monthLabel,
  money,
  nextMonth,
  projectedRecurringTotal,
  recentMonths,
  type RecurringTransaction,
  type Transaction,
} from '@/lib/finance';
import { supabase } from '../lib/supabase';
import { useTheme, useThemeMode } from '@/hooks/use-theme';

export default function HomeScreen() {
  const monthOptions = useMemo(() => recentMonths(6), []);
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const linkingUrl = useURL();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [recurringError, setRecurringError] = useState('');
  const [month, setMonth] = useState(currentMonth());

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (!supabase?.auth) {
        throw new Error(
          'Supabase client is unavailable. Restart Expo with the cache cleared, then reload the app.'
        );
      }

      const { data: { session }, error: authError } =
        await supabase.auth.getSession();

      if (authError) throw authError;

      if (!session) {
        setAuthenticated(false);
        setUserEmail('');
        setTransactions([]);
        setRecurringSchedules([]);
        return;
      }

      setAuthenticated(true);
      setUserEmail(session.user.email ?? '');
      const [transactionData, recurringResult] = await Promise.all([
        (async () => {
          const allTransactions: Transaction[] = [];
          const startDate = `${monthOptions[0]}-01`;
          const endDate = `${nextMonth(monthOptions[monthOptions.length - 1])}-01`;

          for (let from = 0; ; from += 500) {
            const { data, error: queryError } = await supabase
              .from('transactions')
              .select(
                'id, user_id, kind, amount, category, description, transaction_date, created_at'
              )
              .gte('transaction_date', startDate)
              .lt('transaction_date', endDate)
              .order('transaction_date', { ascending: false })
              .order('created_at', { ascending: false })
              .range(from, from + 499);
            if (queryError) throw queryError;

            const page = (data ?? []) as Transaction[];
            allTransactions.push(...page);
            if (page.length < 500) break;
          }
          return allTransactions;
        })(),
        supabase
          .from('recurring_transactions')
          .select(
            'id,user_id,kind,amount,category,description,frequency,start_date,next_due_date,end_date,active'
          )
          .order('next_due_date', { ascending: true }),
      ]);

      setTransactions(transactionData);
      if (recurringResult.error) {
        setRecurringSchedules([]);
        setRecurringError(
          'Recurring schedules are unavailable. Check that the recurring-transactions SQL setup has been completed.'
        );
      } else {
        setRecurringSchedules(
          (recurringResult.data ?? []) as RecurringTransaction[]
        );
        setRecurringError('');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load transactions.'
      );
    } finally {
      setLoading(false);
    }
  }, [monthOptions]);

  const submitAuth = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthMessage('');

    try {
      if (authMode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: Linking.createURL('/?flow=recovery') }
        );
        if (error) throw error;
        setAuthMessage(
          'If an account matches that email, a password reset link will be sent. Open it on this device to choose a new password.'
        );
        return;
      }

      if (authMode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setAuthMode('login');
        setPassword('');
        setAuthMessage('Your password was updated. You are now signed in.');
        await loadTransactions();
        return;
      }

      const result = authMode === 'login'
        ? await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: Linking.createURL('/') },
          });

      if (result.error) throw result.error;

      if (result.data.session) {
        await loadTransactions();
      } else {
        setAuthMode('login');
        setAuthMessage(
          'Account created. Check your email to confirm your address, then sign in.'
        );
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Could not authenticate.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!linkingUrl) return;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(linkingUrl);
    } catch (err) {
      console.error('Could not parse the authentication callback URL.', err);
      setAuthError('The authentication link is invalid. Request a new link.');
      return;
    }

    const fragment = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
    const code = parsedUrl.searchParams.get('code');
    const accessToken =
      parsedUrl.searchParams.get('access_token') ??
      fragment.get('access_token');
    const refreshToken =
      parsedUrl.searchParams.get('refresh_token') ??
      fragment.get('refresh_token');
    const recovery =
      parsedUrl.pathname.includes('reset-password') ||
      parsedUrl.searchParams.get('flow') === 'recovery' ||
      parsedUrl.searchParams.get('type') === 'recovery' ||
      fragment.get('type') === 'recovery';

    if (recovery) {
      setAuthMode('reset');
      setAuthMessage('');
      setAuthError('');
    }

    if (!code && (!accessToken || !refreshToken)) return;

    void (async () => {
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.setSession({
            access_token: accessToken!,
            refresh_token: refreshToken!,
          });
      if (result.error) {
        setAuthError(result.error.message);
        return;
      }
      setAuthenticated(false);
      if (!recovery) {
        await loadTransactions();
      }
    })().catch((err: unknown) => {
      setAuthError(
        err instanceof Error ? err.message : 'Could not complete sign-in.'
      );
    });
  }, [linkingUrl, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [loadTransactions])
  );

  const visibleTransactions = transactions.filter((item) =>
    item.transaction_date.startsWith(month)
  );
  const isIncome = (item: Transaction) =>
    item.kind.trim().toLowerCase() === 'income';

  const income = visibleTransactions
    .filter(isIncome)
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const expenses = visibleTransactions
    .filter((item) => !isIncome(item))
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const balance = income - expenses;
  const projectedBalance =
    balance + projectedRecurringTotal(recurringSchedules, month);
  const monthName = monthLabel(month);
  const spendingByCategory = visibleTransactions.reduce<Record<string, number>>(
    (totals, item) => {
      if (!isIncome(item)) {
        totals[item.category] = (totals[item.category] ?? 0) + Number(item.amount);
      }
      return totals;
    },
    {}
  );
  const topCategories = Object.entries(spendingByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const monthlyTrend = monthOptions.map((trendMonth) => {
    const monthTransactions = transactions.filter((transaction) =>
      transaction.transaction_date.startsWith(trendMonth)
    );
    return {
      month: trendMonth,
      income: monthTransactions
        .filter(isIncome)
        .reduce((sum, item) => sum + Number(item.amount), 0),
      expenses: monthTransactions
        .filter((item) => !isIncome(item))
        .reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });
  const trendMax = Math.max(
    1,
    ...monthlyTrend.flatMap((item) => [item.income, item.expenses])
  );

  const signOut = () => {
    Alert.alert('Sign out?', 'You can sign in again at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void supabase.auth
            .signOut()
            .then(({ error: signOutError }) => {
              if (signOutError) {
                setError(signOutError.message);
                return;
              }
              setAuthenticated(false);
              setTransactions([]);
              setRecurringSchedules([]);
            })
            .catch((err: unknown) => {
              setError(
                err instanceof Error ? err.message : 'Could not sign out.'
              );
            });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>YOUR MONEY, AT A GLANCE</Text>
            <Text style={styles.heading}>My Finances</Text>
          </View>
          <View style={styles.themeControl}>
            <Text style={styles.themeLabel}>Dark mode</Text>
            <Switch
              accessibilityRole="switch"
              accessibilityLabel="Dark mode"
              value={mode === 'dark'}
              onValueChange={(enabled) =>
                setMode(enabled ? 'dark' : 'light')
              }
              trackColor={{
                false: theme.border,
                true: theme.primary,
              }}
              thumbColor={theme.surface}
            />
          </View>
        </View>

        {authenticated ? (
          <View style={styles.accountRow}>
            <Text style={styles.accountEmail}>{userEmail}</Text>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={signOut}
              accessibilityRole="button"
            >
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {authenticated ? (
          <FinanceField
            label="Dashboard month (YYYY-MM)"
            theme={theme}
            value={month}
            onChangeText={setMonth}
            placeholder="2026-10"
            keyboardType="numbers-and-punctuation"
            maxLength={7}
          />
        ) : null}

        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.statusText}>
              Loading your transactions...
            </Text>
          </View>
        ) : !authenticated ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Animated.View
              key={authMode}
              entering={FadeInDown.duration(280).reduceMotion(ReduceMotion.System)}
              style={styles.messageCard}
            >
              <Text style={styles.emptyTitle}>
                {authMode === 'login'
                  ? 'Welcome back'
                  : authMode === 'signup'
                    ? 'Create your account'
                    : authMode === 'forgot'
                      ? 'Reset your password'
                      : 'Choose a new password'}
              </Text>
              <Text style={styles.messageText}>
                {authMode === 'login'
                  ? 'Sign in to see your saved transactions.'
                  : authMode === 'signup'
                    ? 'Create an account to start tracking your money.'
                    : authMode === 'forgot'
                      ? "We'll email you a secure password reset link."
                      : 'Enter your new password (at least 8 characters).'}
              </Text>

              {authMode !== 'reset' ? (
                <TextInput
                  style={styles.authInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  accessibilityLabel="Email address"
                />
              ) : null}
              {authMode !== 'forgot' ? (
                <TextInput
                  style={styles.authInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (at least 8 characters)"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  autoComplete={
                    authMode === 'login' ? 'current-password' : 'new-password'
                  }
                  textContentType={
                    authMode === 'login' ? 'password' : 'newPassword'
                  }
                  accessibilityLabel={
                    authMode === 'reset' ? 'New password' : 'Password'
                  }
                />
              ) : null}

              {authError ? (
                <Text style={styles.authError}>{authError}</Text>
              ) : null}
              {authMessage ? (
                <Text style={styles.authMessage}>{authMessage}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.retryButton,
                  authLoading && styles.disabledButton,
                ]}
                onPress={submitAuth}
                disabled={
                  authLoading ||
                  !email.trim() ||
                  (authMode !== 'forgot' && password.length < 8)
                }
              >
                {authLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.retryText}>
                    {authMode === 'login'
                      ? 'Sign in'
                      : authMode === 'signup'
                        ? 'Create account'
                        : authMode === 'forgot'
                          ? 'Send reset link'
                          : 'Update password'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.authModeButton}
                onPress={() => {
                  setAuthMode(
                    authMode === 'login'
                      ? 'signup'
                      : authMode === 'signup'
                        ? 'login'
                        : 'login'
                  );
                  setAuthError('');
                  setAuthMessage('');
                }}
              >
                <Text style={styles.authModeText}>
                  {authMode === 'login'
                    ? 'New here? Create an account'
                    : authMode === 'signup'
                      ? 'Already have an account? Sign in'
                      : 'Back to sign in'}
                </Text>
              </TouchableOpacity>
              {authMode === 'login' ? (
                <TouchableOpacity
                  style={styles.authModeButton}
                  onPress={() => {
                    setAuthMode('forgot');
                    setAuthError('');
                    setAuthMessage('');
                  }}
                >
                  <Text style={styles.authModeText}>Forgot your password?</Text>
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          </KeyboardAvoidingView>
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorTitle}>
              Couldn&apos;t load your transactions
            </Text>
            <Text style={styles.messageText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadTransactions}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.monthIntro}>
              <Text style={styles.greeting}>YOUR MONEY, MADE CLEARER</Text>
              <Text style={styles.monthTitle}>{monthName}</Text>
            </View>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Net balance</Text>
              <Text style={styles.balanceAmount}>
                {money(balance)}
              </Text>
              <Text style={styles.balanceFooter}>Selected month · CAD</Text>
            </View>
            {recurringError ? (
              <View style={styles.messageCard}>
                <Text style={styles.authError}>{recurringError}</Text>
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Six-month trends</Text>
              <Text style={styles.count}>Income vs expenses</Text>
            </View>
            <View style={styles.chartCard}>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={styles.incomeLegendMark} />
                  <Text style={styles.category}>Income</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.expenseLegendMark} />
                  <Text style={styles.category}>Expenses</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartBars}
              >
                {monthlyTrend.map((item) => (
                  <View key={item.month} style={styles.chartMonth}>
                    <View style={styles.chartPair}>
                      <View
                        accessibilityLabel={`${item.month} income ${money(item.income)}`}
                        style={[
                          styles.chartBar,
                          styles.incomeBar,
                          { height: Math.max(4, (item.income / trendMax) * 112) },
                        ]}
                      />
                      <View
                        accessibilityLabel={`${item.month} expenses ${money(item.expenses)}`}
                        style={[
                          styles.chartBar,
                          styles.expenseBar,
                          { height: Math.max(4, (item.expenses / trendMax) * 112) },
                        ]}
                      />
                    </View>
                    <Text style={styles.chartMonthLabel}>
                      {item.month.slice(5)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={styles.incomeAmount}>
                  {money(income)}
                </Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={styles.expenseAmount}>
                  {money(expenses)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Projected balance</Text>
                <Text
                  style={[
                    styles.projectedAmount,
                    {
                      color: projectedBalance < 0 ? theme.expense : theme.primary,
                    },
                  ]}
                >
                  {money(projectedBalance)}
                </Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Spending insights</Text>
              <Text style={styles.count}>Top categories</Text>
            </View>
            {topCategories.length === 0 ? (
              <View style={styles.messageCard}>
                <Text style={styles.messageText}>
                  Add expenses in {monthName} to see a spending breakdown.
                </Text>
              </View>
            ) : (
              topCategories.map(([category, amount]) => {
                const percent = expenses > 0 ? (amount / expenses) * 100 : 0;
                return (
                  <View key={category} style={styles.insightRow}>
                    <View style={styles.insightLabelRow}>
                      <Text style={styles.insightCategory}>{category}</Text>
                      <Text style={styles.category}>
                        {money(amount)} · {Math.round(percent)}%
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.min(percent, 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/transactions')}
              >
                <Text style={styles.quickActionText}>Manage transactions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push('/planning')}
              >
                <Text style={styles.quickActionText}>Budgets & schedules</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Recent Transactions
              </Text>
              <Text style={styles.count}>
                {visibleTransactions.length} this month
              </Text>
            </View>

            {visibleTransactions.length === 0 ? (
              <View style={styles.messageCard}>
                <Text style={styles.emptyTitle}>
                  No transactions this month
                </Text>
                <Text style={styles.messageText}>
                  Try selecting a different month or add your first
                  transaction.
                </Text>
              </View>
            ) : (
              visibleTransactions.slice(0, 5).map((item) => {
                const incomeItem = isIncome(item);

                return (
                  <View key={item.id} style={styles.transaction}>
                    <View
                      style={[
                        styles.transactionIcon,
                        incomeItem
                          ? styles.incomeIcon
                          : styles.expenseIcon,
                      ]}
                    >
                      <Text style={styles.iconText}>
                        {incomeItem ? '+' : '−'}
                      </Text>
                    </View>

                    <View style={styles.details}>
                      <Text style={styles.transactionTitle}>
                        {item.description?.trim() ||
                          item.category ||
                          'Transaction'}
                      </Text>
                      <Text style={styles.category}>
                        {item.category || 'Uncategorized'} ·{' '}
                        {item.transaction_date}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.amount,
                        incomeItem
                          ? styles.incomeAmount
                          : styles.expenseAmount,
                      ]}
                    >
                      {incomeItem ? '+' : '−'}
                      {money(Number(item.amount))}
                    </Text>
                  </View>
                );
              })
            )}

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadTransactions}
            >
              <Text style={styles.refreshText}>
                Refresh transactions
              </Text>
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              Recurring schedules are projections and do not post transactions
              automatically.
            </Text>
          </>
        )}

        <Text style={styles.disclaimer}>
          Connected to your Supabase project
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      padding: 20,
      paddingBottom: 36,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    greeting: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 6,
    },
    heading: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
    },
    themeControl: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    themeLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: -12,
      marginBottom: 14,
    },
    accountEmail: {
      color: theme.textSecondary,
      fontSize: 12,
      flex: 1,
    },
    signOutButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
    },
    signOutText: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 12,
    },
    monthIntro: {
      gap: 4,
      marginTop: 4,
      marginBottom: 4,
    },
    chartCard: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 24,
    },
    chartLegend: {
      flexDirection: 'row',
      gap: 18,
      marginBottom: 12,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    incomeLegendMark: {
      width: 10,
      height: 10,
      borderRadius: 3,
      backgroundColor: theme.income,
    },
    expenseLegendMark: {
      width: 10,
      height: 10,
      borderRadius: 3,
      backgroundColor: theme.expense,
    },
    chartBars: {
      flexGrow: 1,
      justifyContent: 'space-between',
      gap: 10,
      paddingTop: 4,
    },
    chartMonth: {
      width: 42,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    chartPair: {
      height: 116,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    chartBar: {
      width: 13,
      borderTopLeftRadius: 5,
      borderTopRightRadius: 5,
    },
    incomeBar: {
      backgroundColor: theme.income,
    },
    expenseBar: {
      backgroundColor: theme.expense,
    },
    chartMonthLabel: {
      color: theme.textSecondary,
      fontSize: 10,
      marginTop: 8,
    },
    monthTitle: {
      color: theme.text,
      fontSize: 25,
      fontWeight: '900',
    },
    balanceCard: {
      backgroundColor: theme.primary,
      borderRadius: 24,
      padding: 24,
      marginBottom: 18,
    },
    balanceLabel: {
      color: theme.balanceLabel,
      fontSize: 14,
    },
    balanceAmount: {
      color: '#FFFFFF',
      fontSize: 34,
      fontWeight: '800',
      marginTop: 12,
      marginBottom: 16,
    },
    balanceFooter: {
      color: theme.balanceFooter,
      fontSize: 12,
    },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 30,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      minHeight: 100,
      minWidth: '47%',
    },
    summaryLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      marginBottom: 12,
    },
    incomeAmount: {
      color: theme.income,
      fontSize: 15,
      fontWeight: '800',
    },
    expenseAmount: {
      color: theme.expense,
      fontSize: 15,
      fontWeight: '800',
    },
    projectedAmount: {
      fontSize: 15,
      fontWeight: '800',
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '800',
    },
    count: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    insightRow: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    insightLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    insightCategory: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    progressTrack: {
      height: 8,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: theme.surfaceAlt,
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: 10,
    },
    quickActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    quickAction: {
      flex: 1,
      minWidth: '45%',
      minHeight: 46,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.primarySoft,
    },
    quickActionText: {
      textAlign: 'center',
      color: theme.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    transaction: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 13,
      marginBottom: 10,
    },
    transactionIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },
    incomeIcon: {
      backgroundColor: theme.incomeBackground,
    },
    expenseIcon: {
      backgroundColor: theme.expenseBackground,
    },
    iconText: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.icon,
    },
    details: {
      flex: 1,
      marginRight: 6,
    },
    transactionTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 5,
    },
    category: {
      color: theme.textMuted,
      fontSize: 10,
    },
    amount: {
      fontSize: 12,
      fontWeight: '800',
    },
    status: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 14,
    },
    statusText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    messageCard: {
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 20,
      marginBottom: 18,
    },
    errorTitle: {
      color: theme.expense,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 8,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 8,
    },
    messageText: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    authInput: {
      height: 50,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginTop: 14,
      color: theme.text,
      backgroundColor: theme.surface,
    },
    authError: {
      color: theme.expense,
      fontSize: 13,
      marginTop: 12,
    },
    authMessage: {
      color: theme.income,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 12,
    },
    disabledButton: {
      opacity: 0.6,
    },
    authModeButton: {
      alignSelf: 'center',
      padding: 12,
      marginTop: 8,
    },
    authModeText: {
      color: theme.primary,
      fontWeight: '700',
      textAlign: 'center',
    },
    retryButton: {
      alignSelf: 'flex-start',
      marginTop: 16,
      backgroundColor: theme.primary,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 12,
    },
    retryText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    refreshButton: {
      backgroundColor: theme.primarySoft,
      padding: 15,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 14,
    },
    refreshText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    disclaimer: {
      color: theme.textMuted,
      textAlign: 'center',
      fontSize: 11,
      marginTop: 18,
    },
  });
