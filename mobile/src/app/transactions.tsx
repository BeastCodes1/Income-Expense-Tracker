import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CategoryChoices,
  FinanceButton,
  FinanceCard,
  FinanceField,
  financeUiStyles as ui,
  ScreenTitle,
} from '@/components/finance-ui';
import { useTheme } from '@/hooks/use-theme';
import {
  CATEGORIES,
  currentMonth,
  money,
  nextMonth,
  today,
  transactionsToCsv,
  validDate,
  type Transaction,
  type TransactionKind,
} from '@/lib/finance';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 25;

export default function TransactionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [editor, setEditor] = useState<Transaction | null | undefined>();

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        setTransactions([]);
        setHasMore(false);
        setError('Enter a valid month in YYYY-MM format.');
        return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        setUserId('');
        setTransactions([]);
        return;
      }
      setUserId(session.user.id);

      const { data, error: queryError } = await supabase
        .from('transactions')
        .select(
          'id,user_id,kind,amount,category,description,transaction_date,created_at'
        )
        .gte('transaction_date', `${month}-01`)
        .lt('transaction_date', `${nextMonth(month)}-01`)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (queryError) throw queryError;
      setTransactions((data ?? []) as Transaction[]);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load transactions.'
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  useFocusEffect(
    useCallback(() => {
      void loadTransactions();
    }, [loadTransactions])
  );

  const visible = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.transaction_date.startsWith(month) &&
          `${transaction.category} ${transaction.description} ${transaction.kind}`
            .toLowerCase()
            .includes(search.trim().toLowerCase())
      ),
    [transactions, month, search]
  );

  const closeEditor = () => setEditor(undefined);

  const loadMore = async () => {
    if (loadingMore || !hasMore || !userId) return;
    setLoadingMore(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('transactions')
        .select(
          'id,user_id,kind,amount,category,description,transaction_date,created_at'
        )
        .gte('transaction_date', `${month}-01`)
        .lt('transaction_date', `${nextMonth(month)}-01`)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(transactions.length, transactions.length + PAGE_SIZE - 1);
      if (queryError) throw queryError;

      setTransactions((current) => [...current, ...((data ?? []) as Transaction[])]);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more transactions.');
    } finally {
      setLoadingMore(false);
    }
  };

  const exportTransactions = async () => {
    if (exporting || !userId) return;
    setExporting(true);
    setError('');

    try {
      const allTransactions: Transaction[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error: queryError } = await supabase
          .from('transactions')
          .select(
            'id,user_id,kind,amount,category,description,transaction_date,created_at'
          )
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(from, from + 499);
        if (queryError) throw queryError;

        const page = (data ?? []) as Transaction[];
        allTransactions.push(...page);
        if (page.length < 500) break;
      }

      if (allTransactions.length === 0) {
        setError('There are no transactions to export yet.');
        return;
      }

      const csvFile = new File(Paths.cache, `transactions-${today()}.csv`);
      csvFile.create({ overwrite: true });
      csvFile.write(transactionsToCsv(allTransactions));
      await Sharing.shareAsync(csvFile.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export transactions',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not export transactions.'
      );
    } finally {
      setExporting(false);
    }
  };

  const deleteTransaction = (transaction: Transaction) => {
    Alert.alert(
      'Delete transaction?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const { error: deleteError } = await supabase
                  .from('transactions')
                  .delete()
                  .eq('id', transaction.id)
                  .eq('user_id', userId);
                if (deleteError) {
                  setError(deleteError.message);
                  return;
                }
                setTransactions((current) =>
                  current.filter((item) => item.id !== transaction.id)
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'Could not delete this transaction.'
                );
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[ui.body, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ScrollView contentContainerStyle={ui.content}>
        <ScreenTitle
          title="Transactions"
          subtitle="Search, add, edit, or remove your income and expenses."
          theme={theme}
        />

        <FinanceField
          label="Month (YYYY-MM)"
          theme={theme}
          value={month}
          onChangeText={setMonth}
          placeholder="2026-10"
          keyboardType="numbers-and-punctuation"
          maxLength={7}
        />
        <FinanceField
          label="Search"
          theme={theme}
          value={search}
          onChangeText={setSearch}
          placeholder="Description, category, type"
          autoCapitalize="none"
        />
        <FinanceButton
          title="Add transaction"
          theme={theme}
          onPress={() => setEditor(null)}
          disabled={!userId}
        />
        <FinanceButton
          title={exporting ? 'Preparing CSV…' : 'Export all transactions (CSV)'}
          theme={theme}
          variant="secondary"
          onPress={() => void exportTransactions()}
          disabled={!userId || exporting}
        />

        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : !userId ? (
          <FinanceCard theme={theme}>
            <Text style={[ui.text, { color: theme.textSecondary }]}>
              Sign in on the Overview tab to manage your transactions.
            </Text>
            <FinanceButton
              title="Go to Overview"
              theme={theme}
              onPress={() => router.push('/')}
            />
          </FinanceCard>
        ) : error ? (
          <FinanceCard theme={theme}>
            <Text style={[ui.text, { color: theme.expense }]}>{error}</Text>
            <FinanceButton
              title="Try again"
              theme={theme}
              onPress={() => void loadTransactions()}
            />
          </FinanceCard>
        ) : visible.length === 0 ? (
          <FinanceCard theme={theme}>
            <Text style={[ui.muted, { color: theme.textSecondary }]}>
              {transactions.length} of this month&apos;s records loaded
              {hasMore ? '. Load more to search older records.' : '.'}
            </Text>
            <Text style={[ui.empty, { color: theme.textSecondary }]}>
              No transactions found for this month and search.
            </Text>
            {hasMore ? (
              <FinanceButton
                title={loadingMore ? 'Loading…' : 'Load more transactions'}
                theme={theme}
                onPress={() => void loadMore()}
                disabled={loadingMore}
              />
            ) : null}
          </FinanceCard>
        ) : (
          <>
            <Text style={[ui.muted, { color: theme.textSecondary }]}>
              Showing {visible.length} matches from {transactions.length}{' '}
              loaded{hasMore ? '. Load more to search older records.' : '.'}
            </Text>
            {visible.map((transaction) => (
              <FinanceCard key={transaction.id} theme={theme}>
                <View style={ui.rowSpace}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[ui.heading, { color: theme.text }]}>
                      {transaction.description || transaction.category}
                    </Text>
                    <Text style={[ui.muted, { color: theme.textSecondary }]}>
                      {transaction.kind} · {transaction.category} ·{' '}
                      {transaction.transaction_date}
                    </Text>
                  </View>
                  <Text
                    style={[
                      ui.amount,
                      {
                        color:
                          transaction.kind === 'income'
                            ? theme.income
                            : theme.expense,
                      },
                    ]}
                  >
                    {transaction.kind === 'income' ? '+' : '−'}
                    {money(Number(transaction.amount))}
                  </Text>
                </View>
                <View style={ui.row}>
                  <FinanceButton
                    title="Edit"
                    theme={theme}
                    variant="secondary"
                    onPress={() => setEditor(transaction)}
                  />
                  <FinanceButton
                    title="Delete"
                    theme={theme}
                    variant="danger"
                    onPress={() => deleteTransaction(transaction)}
                  />
                </View>
              </FinanceCard>
            ))}
            {hasMore ? (
              <FinanceButton
                title={loadingMore ? 'Loading…' : 'Load more transactions'}
                theme={theme}
                onPress={() => void loadMore()}
                disabled={loadingMore}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      {editor !== undefined ? (
        <TransactionEditor
          key={editor?.id ?? 'new-transaction'}
          theme={theme}
          userId={userId}
          transaction={editor}
          onClose={closeEditor}
          onSaved={(saved) => {
            setTransactions((current) =>
              [saved, ...current.filter((item) => item.id !== saved.id)].sort(
                (a, b) =>
                  b.transaction_date.localeCompare(a.transaction_date) ||
                  (b.created_at ?? '').localeCompare(a.created_at ?? '')
              )
            );
            closeEditor();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function TransactionEditor({
  theme,
  userId,
  transaction,
  onClose,
  onSaved,
}: {
  theme: ReturnType<typeof useTheme>;
  userId: string;
  transaction: Transaction | null;
  onClose: () => void;
  onSaved: (transaction: Transaction) => void;
}) {
  const [kind, setKind] = useState<TransactionKind>(
    transaction?.kind ?? 'expense'
  );
  const [category, setCategory] = useState(
    transaction?.category ?? 'Food'
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : ''
  );
  const [description, setDescription] = useState(
    transaction?.description ?? ''
  );
  const [date, setDate] = useState(
    transaction?.transaction_date ?? today()
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setCategory(next === 'income' ? 'Salary' : 'Food');
  };

  const save = async () => {
    setError('');
    const numericAmount = Number(amount);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > 9999999999.99 ||
      !/^\d+(\.\d{1,2})?$/.test(amount)
    ) {
      setError('Enter a positive amount with up to 2 decimal places.');
      return;
    }
    if (!CATEGORIES[kind].includes(category)) {
      setError('Choose a valid category.');
      return;
    }
    if (description.length > 240) {
      setError('Description must be 240 characters or fewer.');
      return;
    }
    if (!validDate(date)) {
      setError('Enter a valid date as YYYY-MM-DD.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        kind,
        category,
        amount: numericAmount,
        description: description.trim(),
        transaction_date: date,
      };
      const result = transaction
        ? await supabase
            .from('transactions')
            .update(payload)
            .eq('id', transaction.id)
            .eq('user_id', userId)
            .select(
              'id,user_id,kind,amount,category,description,transaction_date,created_at'
            )
            .single()
        : await supabase
            .from('transactions')
            .insert({ ...payload, user_id: userId })
            .select(
              'id,user_id,kind,amount,category,description,transaction_date,created_at'
            )
            .single();

      if (result.error) {
        setError(result.error.message);
        return;
      }
      onSaved(result.data as Transaction);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the transaction.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[ui.body, { backgroundColor: theme.background }]}
        edges={['top', 'bottom']}
      >
        <ScrollView contentContainerStyle={ui.content}>
          <View style={ui.rowSpace}>
            <Text style={[ui.heading, { color: theme.text, fontSize: 21 }]}>
              {transaction ? 'Edit transaction' : 'Add transaction'}
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Text style={{ color: theme.primary, fontWeight: '700' }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>

          <View style={ui.row}>
            {(['expense', 'income'] as const).map((choice) => (
              <View key={choice} style={{ flex: 1 }}>
                <FinanceButton
                  title={choice === 'income' ? 'Income' : 'Expense'}
                  theme={theme}
                  variant={kind === choice ? 'primary' : 'secondary'}
                  onPress={() => changeKind(choice)}
                />
              </View>
            ))}
          </View>

          <FinanceField
            label="Amount (CAD)"
            theme={theme}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <Text style={{ color: theme.text, fontWeight: '700' }}>Category</Text>
          <CategoryChoices
            kind={kind}
            categories={CATEGORIES[kind]}
            selected={category}
            onSelect={setCategory}
            theme={theme}
          />
          <FinanceField
            label="Description (optional)"
            theme={theme}
            value={description}
            onChangeText={setDescription}
            maxLength={240}
            placeholder="e.g. Groceries"
          />
          <FinanceField
            label="Date (YYYY-MM-DD)"
            theme={theme}
            value={date}
            onChangeText={setDate}
            maxLength={10}
            placeholder="2026-10-22"
          />
          {error ? (
            <Text style={{ color: theme.expense, lineHeight: 20 }}>{error}</Text>
          ) : null}
          <FinanceButton
            title={saving ? 'Saving…' : 'Save transaction'}
            theme={theme}
            disabled={saving}
            onPress={() => void save()}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
