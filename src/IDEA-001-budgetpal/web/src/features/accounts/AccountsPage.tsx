import { useEffect, useRef, useState } from 'react';
import { ACCOUNT_TYPE_LABELS, ApiProblem, useAccounts, useDeleteAccount, type Account } from './accounts.api';
import { AccountForm } from './AccountForm';
import styles from './accounts.module.css';
import { formatMoney, installCurrency } from './money';

interface ConfirmDeleteProps {
  account: Account;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal confirmation on a native <dialog>: labelled, focus starts on Cancel, Escape cancels. */
function ConfirmDelete({ account, pending, onConfirm, onCancel }: ConfirmDeleteProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // jsdom (and very old browsers) lack showModal; the open attribute still shows the dialog there.
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="delete-account-title"
      aria-describedby="delete-account-text"
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="delete-account-title">Delete {account.name}?</h2>
      <p id="delete-account-text">
        This removes the account {account.name}. It cannot be undone, and it is refused while transactions use it.
      </p>
      <div className={styles.actions}>
        <button type="button" ref={cancelRef} onClick={onCancel} className={styles.button}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={pending} className={styles.button}>
          {pending ? 'Deleting...' : 'Delete account'}
        </button>
      </div>
    </dialog>
  );
}

/** Accounts page: the add (or edit) form, then the list with row actions, or an empty state. */
export function AccountsPage() {
  const accounts = useAccounts();
  const remove = useDeleteAccount();
  const currency = installCurrency();
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  function confirmDelete(account: Account) {
    remove.mutate(account.id, {
      onSuccess: () => {
        setDeleting(null);
        setNotice(null);
      },
      onError: (problem) => {
        setDeleting(null);
        setNotice(
          problem instanceof ApiProblem && problem.status === 409
            ? `${account.name} is in use by transactions and cannot be deleted.`
            : problem instanceof ApiProblem && problem.status === 404
              ? `${account.name} no longer exists.`
              : `Could not delete ${account.name} right now. Try again.`,
        );
      },
    });
  }

  return (
    <section className={styles.page}>
      <h1>Accounts</h1>
      {notice ? (
        <p role="alert" tabIndex={-1} ref={noticeRef} className={styles.error}>
          <span aria-hidden="true">⚠ </span>
          {notice}
        </p>
      ) : null}
      {editing ? (
        <AccountForm
          key={editing.id}
          account={editing}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <AccountForm />
      )}
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
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.data.map((account) => (
                  <tr key={account.id}>
                    <th scope="row">{account.name}</th>
                    <td>{ACCOUNT_TYPE_LABELS[account.type]}</td>
                    <td className={styles.amount}>{formatMoney(account.openingBalanceMinor, currency)}</td>
                    <td>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          aria-label={`Edit ${account.name}`}
                          onClick={() => {
                            setNotice(null);
                            setEditing(account);
                          }}
                          className={styles.button}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${account.name}`}
                          onClick={() => {
                            setNotice(null);
                            setDeleting(account);
                          }}
                          className={styles.button}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      {deleting ? (
        <ConfirmDelete
          account={deleting}
          pending={remove.isPending}
          onConfirm={() => confirmDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
