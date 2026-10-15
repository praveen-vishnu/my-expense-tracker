/**
 * Field mappers between in-memory PennyWise domain objects and Supabase DB rows.
 */

export const TABLE_CONFIGS = {
  expenses: {
    primaryKey: 'id',
    toRow(clientRecord, userId) {
      return {
        id: clientRecord.id,
        user_id: userId,
        amount: Number(clientRecord.amount),
        category: String(clientRecord.category || '').trim(),
        date: clientRecord.date,
        note: clientRecord.note ? String(clientRecord.note) : '',
        account_id: clientRecord.accountId || null,
        recurring_id: clientRecord.recurringId || null,
        split: clientRecord.split || null,
      }
    },
    toClient(row) {
      return {
        id: row.id,
        amount: Number(row.amount),
        category: row.category,
        date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date,
        note: row.note || '',
        ...(row.account_id ? { accountId: row.account_id } : {}),
        ...(row.recurring_id ? { recurringId: row.recurring_id } : {}),
        ...(row.split ? { split: row.split } : {}),
      }
    },
  },

  accounts: {
    primaryKey: 'id',
    toRow(clientRecord, userId) {
      return {
        id: clientRecord.id,
        user_id: userId,
        name: String(clientRecord.name || '').trim(),
        type: clientRecord.type || 'bank',
        initial_balance: Number(clientRecord.initialBalance) || 0,
        credit_limit: clientRecord.creditLimit != null ? Number(clientRecord.creditLimit) : null,
        billing_day: clientRecord.billingDay != null ? Number(clientRecord.billingDay) : null,
        due_day: clientRecord.dueDay != null ? Number(clientRecord.dueDay) : null,
        is_default: Boolean(clientRecord.isDefault),
      }
    },
    toClient(row) {
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        initialBalance: Number(row.initial_balance) || 0,
        creditLimit: row.credit_limit != null ? Number(row.credit_limit) : null,
        billingDay: row.billing_day != null ? Number(row.billing_day) : null,
        dueDay: row.due_day != null ? Number(row.due_day) : null,
        isDefault: Boolean(row.is_default),
      }
    },
  },

  transfers: {
    primaryKey: 'id',
    toRow(clientRecord, userId) {
      return {
        id: clientRecord.id,
        user_id: userId,
        from_account_id: clientRecord.fromAccountId,
        to_account_id: clientRecord.toAccountId,
        amount: Number(clientRecord.amount),
        date: clientRecord.date,
        note: clientRecord.note ? String(clientRecord.note).trim() : '',
      }
    },
    toClient(row) {
      return {
        id: row.id,
        fromAccountId: row.from_account_id,
        toAccountId: row.to_account_id,
        amount: Number(row.amount),
        date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date,
        note: row.note || '',
      }
    },
  },

  recurring_schedules: {
    primaryKey: 'id',
    toRow(clientRecord, userId) {
      return {
        id: clientRecord.id,
        user_id: userId,
        name: String(clientRecord.name || '').trim(),
        amount: Number(clientRecord.amount),
        category: String(clientRecord.category || '').trim(),
        note: clientRecord.note ? String(clientRecord.note).trim() : '',
        day: Number(clientRecord.day),
        start_month: clientRecord.startMonth,
        kind: clientRecord.kind,
        installments: clientRecord.installments != null ? Number(clientRecord.installments) : null,
        account_id: clientRecord.accountId || null,
      }
    },
    toClient(row) {
      return {
        id: row.id,
        name: row.name,
        amount: Number(row.amount),
        category: row.category,
        note: row.note || '',
        day: Number(row.day),
        startMonth: row.start_month,
        kind: row.kind,
        installments: row.installments != null ? Number(row.installments) : null,
        accountId: row.account_id || null,
      }
    },
  },

  category_budgets: {
    primaryKey: 'id',
    toRow(clientRecord, userId) {
      return {
        id: clientRecord.id || `${clientRecord.month}_${clientRecord.category}`,
        user_id: userId,
        month: clientRecord.month,
        category: clientRecord.category,
        amount: Number(clientRecord.amount),
      }
    },
    toClient(row) {
      return {
        id: row.id,
        month: row.month,
        category: row.category,
        amount: Number(row.amount),
      }
    },
  },

  incomes: {
    primaryKey: 'user_id,month',
    toRow(clientRecord, userId) {
      return {
        user_id: userId,
        month: clientRecord.month,
        amount: Number(clientRecord.amount),
        account_id: clientRecord.accountId || null,
      }
    },
    toClient(row) {
      return {
        month: row.month,
        amount: Number(row.amount),
        accountId: row.account_id || null,
      }
    },
  },

  budgets: {
    primaryKey: 'user_id,month',
    toRow(clientRecord, userId) {
      return {
        user_id: userId,
        month: clientRecord.month,
        amount: Number(clientRecord.amount),
      }
    },
    toClient(row) {
      return {
        month: row.month,
        amount: Number(row.amount),
      }
    },
  },
}

