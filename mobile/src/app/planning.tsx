import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
  today,
  validDate,
  type Budget,
  type RecurringTransaction,
  type Transaction,
  type TransactionKind,
  type RecurrenceFrequency,
} from '@/lib/finance';
import { supabase } from '@/lib/supabase';

export default function PlanningScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [schedules, setSchedules] = useState<RecurringTransaction[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [budgetError, setBudgetError] = useState('');
  const [recurringError, setRecurringError] = useState('');
  const [editor, setEditor] = useState<
    { type: 'budget'; budget?: Budget } | { type: 'recurring' } | undefined
  >();

  const loadData = useCallback(async () => {
    setLoading(true);
    setBudgetError('');
    setRecurringError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        setUserId('');
        setBudgets([]);
        setTransactions([]);
        setSchedules([]);
        return;
      }

      setUserId(session.user.id);
      const [budgetResult, transactionResult, recurringResult] =
        await Promise.all([
          supabase
            .from('budgets')
            .select('id,user_id,category,month,amount')
            .order('month', { ascending: false }),
          supabase
            .from('transactions')
            .select('id,user_id,kind,amount,category,description,transaction_date'),
          supabase
            .from('recurring_transactions')
            .select(
              'id,user_id,kind,amount,category,description,frequency,start_date,next_due_date,end_date,active'
            )
            .order('next_due_date', { ascending: true }),
        ]);

      if (budgetResult.error) {
        setBudgetError(
          'Budgets are unavailable. Check that supabase/budgets.sql has been run in Supabase.'
        );
      } else {
        setBudgets((budgetResult.data ?? []) as Budget[]);
      }

      if (recurringResult.error) {
        setRecurringError(
          'Recurring schedules are unavailable. Check that supabase/recurring_transactions.sql has been run in Supabase.'
        );
      } else {
        setSchedules((recurringResult.data ?? []) as RecurringTransaction[]);
      }

      if (transactionResult.error) throw transactionResult.error;
      setTransactions((transactionResult.data ?? []) as Transaction[]);
    } catch (err) {
      setBudgetError(
        err instanceof Error ? err.message : 'Could not load planning data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const monthBudgets = budgets.filter(
    (budget) => budget.month.slice(0, 7) === month
  );
  const expensesByCategory = transactions
    .filter(
      (transaction) =>
        transaction.kind === 'expense' &&
        transaction.transaction_date.startsWith(month)
    )
    .reduce<Record<string, number>>((totals, transaction) => {
      totals[transaction.category] =
        (totals[transaction.category] ?? 0) + Number(transaction.amount);
      return totals;
    }, {});
  const totalLimit = monthBudgets.reduce(
    (sum, budget) => sum + Number(budget.amount),
    0
  );
  const totalSpent = monthBudgets.reduce(
    (sum, budget) => sum + (expensesByCategory[budget.category] ?? 0),
    0
  );

  const saveBudget = async (category: string, amountInput: string) => {
    const amount = Number(amountInput);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 9999999999.99 ||
      !/^\d+(\.\d{1,2})?$/.test(amountInput)
    ) {
      return 'Enter a positive budget amount with up to 2 decimal places.';
    }
    if (!CATEGORIES.expense.includes(category)) {
      return 'Choose a valid expense category.';
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return 'Enter the month as YYYY-MM.';
    }

    try {
      const { data, error } = await supabase
        .from('budgets')
        .upsert(
          {
            user_id: userId,
            category,
            amount,
            month: `${month}-01`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,category,month' }
        )
        .select('id,user_id,category,month,amount')
        .single();
      if (error) {
        return 'Could not save the budget. Confirm the budgets SQL setup is complete.';
      }
      setBudgets((current) => [
        data as Budget,
        ...current.filter(
          (budget) =>
            !(budget.category === category && budget.month.slice(0, 7) === month)
        ),
      ]);
      return '';
    } catch (err) {
      return err instanceof Error
        ? err.message
        : 'Could not save the budget.';
    }
  };

  const deleteBudget = (budget: Budget) => {
    Alert.alert(
      'Delete budget?',
      `Remove the ${budget.category} budget for ${budget.month.slice(0, 7)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const { error } = await supabase
                  .from('budgets')
                  .delete()
                  .eq('id', budget.id)
                  .eq('user_id', userId);
                if (error) {
                  setBudgetError(error.message);
                  return;
                }
                setBudgets((current) =>
                  current.filter((item) => item.id !== budget.id)
                );
              } catch (err) {
                setBudgetError(
                  err instanceof Error ? err.message : 'Could not delete budget.'
                );
              }
            })();
          },
        },
      ]
    );
  };

  const deleteSchedule = (schedule: RecurringTransaction) => {
    Alert.alert(
      'Delete recurring schedule?',
      'This only removes the schedule; posted transactions are not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const { error } = await supabase
                  .from('recurring_transactions')
                  .delete()
                  .eq('id', schedule.id)
                  .eq('user_id', userId);
                if (error) {
                  setRecurringError(error.message);
                  return;
                }
                setSchedules((current) =>
                  current.filter((item) => item.id !== schedule.id)
                );
              } catch (err) {
                setRecurringError(
                  err instanceof Error
                    ? err.message
                    : 'Could not delete the recurring schedule.'
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
          title="Planning"
          subtitle="Manage category budgets and recurring schedules."
          theme={theme}
        />

        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : !userId ? (
          <FinanceCard theme={theme}>
            <Text style={[ui.text, { color: theme.textSecondary }]}>
              Sign in on the Overview tab to manage your budgets.
            </Text>
            <FinanceButton
              title="Go to Overview"
              theme={theme}
              onPress={() => router.push('/')}
            />
          </FinanceCard>
        ) : (
          <>
            <FinanceField
              label="Planning month (YYYY-MM)"
              theme={theme}
              value={month}
              onChangeText={setMonth}
              placeholder="2026-10"
              keyboardType="numbers-and-punctuation"
              maxLength={7}
            />

            <FinanceCard theme={theme}>
              <Text style={[ui.heading, { color: theme.text }]}>
                Monthly budgets
              </Text>
              <Text style={[ui.muted, { color: theme.textSecondary }]}>
                Compare spending in each category with its monthly limit.
              </Text>
              <View style={ui.rowSpace}>
                <Text style={[ui.muted, { color: theme.textSecondary }]}>
                  Total budget
                </Text>
                <Text style={[ui.amount, { color: theme.text }]}>
                  {money(totalLimit)}
                </Text>
              </View>
              <View style={ui.rowSpace}>
                <Text style={[ui.muted, { color: theme.textSecondary }]}>
                  Spent in budgeted categories
                </Text>
                <Text style={[ui.amount, { color: theme.text }]}>
                  {money(totalSpent)}
                </Text>
              </View>
              <View style={ui.rowSpace}>
                <Text style={[ui.muted, { color: theme.textSecondary }]}>
                  Budget remaining
                </Text>
                <Text
                  style={[
                    ui.amount,
                    {
                      color: totalSpent > totalLimit ? theme.expense : theme.income,
                    },
                  ]}
                >
                  {money(totalLimit - totalSpent)}
                </Text>
              </View>
              {budgetError ? (
                <Text style={[ui.muted, { color: theme.expense }]}>
                  {budgetError}
                </Text>
              ) : null}
              <FinanceButton
                title="Set a budget"
                theme={theme}
                onPress={() => setEditor({ type: 'budget' })}
              />
              {monthBudgets.length === 0 ? (
                <Text style={[ui.empty, { color: theme.textSecondary }]}>
                  No budgets for this month yet. Create a category limit to
                  track your spending.
                </Text>
              ) : (
                monthBudgets.map((budget) => {
                  const spent = expensesByCategory[budget.category] ?? 0;
                  const limit = Number(budget.amount);
                  const percent = limit > 0 ? (spent / limit) * 100 : 0;
                  const over = percent >= 100;
                  const near = percent >= 80 && !over;
                  return (
                    <View
                      key={budget.id}
                      style={[
                        ui.stack,
                        {
                          borderTopWidth: 1,
                          borderTopColor: theme.border,
                          paddingTop: 14,
                        },
                      ]}
                    >
                      <View style={ui.rowSpace}>
                        <View style={{ flex: 1 }}>
                          <Text style={[ui.heading, { color: theme.text }]}>
                            {budget.category}
                          </Text>
                          <Text style={[ui.muted, { color: theme.textSecondary }]}>
                            {money(spent)} of {money(limit)}
                          </Text>
                        </View>
                        <View style={ui.row}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() =>
                              setEditor({ type: 'budget', budget })
                            }
                          >
                            <Text style={{ color: theme.primary }}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => deleteBudget(budget)}
                          >
                            <Text style={{ color: theme.expense }}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View
                        accessibilityRole="progressbar"
                        accessibilityLabel={`${budget.category} budget used`}
                        accessibilityValue={{
                          min: 0,
                          max: 100,
                          now: Math.round(Math.min(percent, 100)),
                        }}
                        style={{
                          height: 9,
                          borderRadius: 99,
                          backgroundColor: theme.surfaceAlt,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(percent, 100)}%`,
                            height: '100%',
                            backgroundColor: over
                              ? theme.expense
                              : near
                                ? '#F2B84B'
                                : theme.income,
                          }}
                        />
                      </View>
                      <Text
                        style={[
                          ui.muted,
                          { color: over ? theme.expense : theme.textSecondary },
                        ]}
                      >
                        {over
                          ? `Over budget by ${money(spent - limit)}`
                          : near
                            ? `You've used ${Math.round(percent)}% of this budget`
                            : `${Math.round(percent)}% used · ${money(limit - spent)} left`}
                      </Text>
                    </View>
                  );
                })
              )}
            </FinanceCard>

            <FinanceCard theme={theme}>
              <Text style={[ui.heading, { color: theme.text }]}>
                Recurring transactions
              </Text>
              <Text style={[ui.muted, { color: theme.textSecondary }]}>
                Schedules are projections; they do not post transactions
                automatically.
              </Text>
              {recurringError ? (
                <Text style={[ui.muted, { color: theme.expense }]}>
                  {recurringError}
                </Text>
              ) : null}
              <FinanceButton
                title="Add recurring schedule"
                theme={theme}
                onPress={() => setEditor({ type: 'recurring' })}
              />
              {schedules.length === 0 ? (
                <Text style={[ui.empty, { color: theme.textSecondary }]}>
                  Add regular salary payments, rent, bills, or other recurring
                  income and expenses.
                </Text>
              ) : (
                schedules.map((schedule) => (
                  <View
                    key={schedule.id}
                    style={[
                      ui.stack,
                      {
                        borderTopWidth: 1,
                        borderTopColor: theme.border,
                        paddingTop: 14,
                      },
                    ]}
                  >
                    <View style={ui.rowSpace}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={[ui.heading, { color: theme.text }]}>
                          {schedule.description || schedule.category}
                        </Text>
                        <Text style={[ui.muted, { color: theme.textSecondary }]}>
                          {schedule.kind} · {schedule.category} ·{' '}
                          {schedule.frequency}
                        </Text>
                        <Text style={[ui.muted, { color: theme.textSecondary }]}>
                          Next due {schedule.next_due_date}
                        </Text>
                      </View>
                      <Text
                        style={[
                          ui.amount,
                          {
                            color:
                              schedule.kind === 'income'
                                ? theme.income
                                : theme.expense,
                          },
                        ]}
                      >
                        {schedule.kind === 'income' ? '+' : '−'}
                        {money(Number(schedule.amount))}
                      </Text>
                    </View>
                    <FinanceButton
                      title="Delete schedule"
                      theme={theme}
                      variant="danger"
                      onPress={() => deleteSchedule(schedule)}
                    />
                  </View>
                ))
              )}
            </FinanceCard>
          </>
        )}
      </ScrollView>

      {editor ? (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditor(undefined)}
        >
          {editor.type === 'budget' ? (
            <BudgetEditor
              theme={theme}
              month={month}
              budget={editor.budget}
              onClose={() => setEditor(undefined)}
              onSave={saveBudget}
            />
          ) : (
            <RecurringEditor
              theme={theme}
              userId={userId}
              onClose={() => setEditor(undefined)}
              onSaved={(schedule) => {
                setSchedules((current) =>
                  [schedule, ...current].sort((a, b) =>
                    a.next_due_date.localeCompare(b.next_due_date)
                  )
                );
                setEditor(undefined);
              }}
            />
          )}
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function BudgetEditor({
  theme,
  month,
  budget,
  onClose,
  onSave,
}: {
  theme: ReturnType<typeof useTheme>;
  month: string;
  budget?: Budget;
  onClose: () => void;
  onSave: (category: string, amount: string) => Promise<string>;
}) {
  const [category, setCategory] = useState(budget?.category ?? 'Food');
  const [amount, setAmount] = useState(
    budget ? String(budget.amount) : ''
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const saveError = await onSave(category, amount);
    setSaving(false);
    if (saveError) {
      setError(saveError);
    } else {
      onClose();
    }
  };

  return (
    <SafeAreaView
      style={[ui.body, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <ScrollView contentContainerStyle={ui.content}>
        <View style={ui.rowSpace}>
          <Text style={[ui.heading, { color: theme.text, fontSize: 21 }]}>
            {budget ? 'Edit budget' : 'Set a budget'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={[ui.muted, { color: theme.textSecondary }]}>
          Monthly limit for {month}.
        </Text>
        <Text style={{ color: theme.text, fontWeight: '700' }}>Category</Text>
        <CategoryChoices
          kind="expense"
          categories={CATEGORIES.expense}
          selected={category}
          onSelect={setCategory}
          theme={theme}
          disabled={Boolean(budget)}
        />
        <FinanceField
          label="Monthly limit (CAD)"
          theme={theme}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="450.00"
        />
        {error ? (
          <Text style={{ color: theme.expense, lineHeight: 20 }}>{error}</Text>
        ) : null}
        <FinanceButton
          title={saving ? 'Saving…' : budget ? 'Update budget' : 'Save budget'}
          theme={theme}
          disabled={saving}
          onPress={() => void submit()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function RecurringEditor({
  theme,
  userId,
  onClose,
  onSaved,
}: {
  theme: ReturnType<typeof useTheme>;
  userId: string;
  onClose: () => void;
  onSaved: (schedule: RecurringTransaction) => void;
}) {
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [category, setCategory] = useState('Housing');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] =
    useState<RecurrenceFrequency>('monthly');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setCategory(next === 'income' ? 'Salary' : 'Housing');
  };

  const submit = async () => {
    setError('');
    const numericAmount = Number(amount);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > 9999999999.99 ||
      !/^\d+(\.\d{1,2})?$/.test(amount)
    ) {
      setError('Enter a valid positive amount with up to 2 decimal places.');
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
    if (!validDate(startDate)) {
      setError('Enter a valid start date as YYYY-MM-DD.');
      return;
    }
    if (endDate && (!validDate(endDate) || endDate < startDate)) {
      setError('The end date must be on or after the start date.');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .insert({
          user_id: userId,
          kind,
          amount: numericAmount,
          category,
          description: description.trim(),
          frequency,
          start_date: startDate,
          next_due_date: startDate,
          end_date: endDate || null,
        })
        .select(
          'id,user_id,kind,amount,category,description,frequency,start_date,next_due_date,end_date,active'
        )
        .single();
      if (error) {
        setError(
          'Could not save this schedule. Confirm that the recurring-transactions SQL setup is complete.'
        );
        return;
      }
      onSaved(data as RecurringTransaction);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save the recurring schedule.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[ui.body, { backgroundColor: theme.background }]}
      edges={['top', 'bottom']}
    >
      <ScrollView contentContainerStyle={ui.content}>
        <View style={ui.rowSpace}>
          <Text style={[ui.heading, { color: theme.text, fontSize: 21 }]}>
            New recurring schedule
          </Text>
          <TouchableOpacity onPress={onClose}>
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
        <Text style={{ color: theme.text, fontWeight: '700' }}>Frequency</Text>
        <View style={ui.stack}>
          {(
            [
              ['weekly', 'Weekly'],
              ['biweekly', 'Every two weeks'],
              ['monthly', 'Monthly'],
              ['yearly', 'Yearly'],
            ] as const
          ).map(([value, label]) => (
            <FinanceButton
              key={value}
              title={label}
              theme={theme}
              variant={frequency === value ? 'primary' : 'secondary'}
              onPress={() => setFrequency(value)}
            />
          ))}
        </View>
        <FinanceField
          label="Description (optional)"
          theme={theme}
          value={description}
          onChangeText={setDescription}
          maxLength={240}
          placeholder="e.g. Monthly rent"
        />
        <FinanceField
          label="First due date (YYYY-MM-DD)"
          theme={theme}
          value={startDate}
          onChangeText={setStartDate}
          maxLength={10}
          placeholder="2026-10-22"
        />
        <FinanceField
          label="End date (optional, YYYY-MM-DD)"
          theme={theme}
          value={endDate}
          onChangeText={setEndDate}
          maxLength={10}
          placeholder="2027-10-22"
        />
        {error ? (
          <Text style={{ color: theme.expense, lineHeight: 20 }}>{error}</Text>
        ) : null}
        <FinanceButton
          title={saving ? 'Saving…' : 'Save schedule'}
          theme={theme}
          disabled={saving}
          onPress={() => void submit()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
