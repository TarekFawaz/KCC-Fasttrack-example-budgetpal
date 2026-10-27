import { ACCOUNT_TYPE_LABELS, useAccounts } from './accounts.api';
import { AccountForm } from './AccountForm';
import styles from './accounts.module.css';
import { formatMoney, installCurrency } from './money';

/** Accounts page: the add form, then the list (or an empty state that explains how to add one). */
export function AccountsPage() {
  const accounts = useAccounts();
  const currency = installCurrency();

  return (
    <section className={styles.page}>
      <h1>Accounts</h1>
      <AccountForm />
      <section aria-labelledby="accounts-list-heading">
        <h2 id="accounts-list-heading">Your accounts</h2>
        {accounts.isPending ? <p role="status">Loading accounts...</p> : null}
        {accounts.isError ? (
          <p role="alert" className={styles.error}>
            <span aria-hidden="true">⚠ </span>
            Could not load your accounts. Try again.
          </p>
        ) : null}
        {accounts.isSuccess && accounts.data.length === 0 ? (
          <p className={styles.empty}>
            You have no accounts yet. To add your first one, enter a name, pick a type and, if you like, an opening
            balance in the form above, then choose Add account.
          </p>
        ) : null}
        {accounts.isSuccess && accounts.data.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>Your accounts with their type and opening balance</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col" className={styles.amount}>
                    Opening balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.data.map((account) => (
                  <tr key={account.id}>
                    <th scope="row">{account.name}</th>
                    <td>{ACCOUNT_TYPE_LABELS[account.type]}</td>
                    <td className={styles.amount}>{formatMoney(account.openingBalanceMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}
