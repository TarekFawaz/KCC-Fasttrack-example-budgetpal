import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ACCOUNT_TYPE_LABELS, ApiProblem, useAccounts, useDeleteAccount, type Account } from './accounts.api';
import { AccountForm } from './AccountForm';
import { formatMoney, installCurrency } from './money';

/** The one look of an inline error: text with an icon, never colour alone. */
export const ERROR_CLASSES = 'm-0 text-sm font-semibold text-destructive';

interface ConfirmDeleteProps {
  account: Account | null;
  pending: boolean;
  /** Read when the dialog closes: true while an error notice must keep the focus the page gave it. */
  keepFocus: () => boolean;
  onConfirm: (account: Account) => void;
  onCancel: () => void;
}

/** Modal confirmation on the kit AlertDialog: labelled, focus starts on Cancel, Escape cancels. */
function ConfirmDelete({ account, pending, keepFocus, onConfirm, onCancel }: ConfirmDeleteProps) {
  return (
    <AlertDialog
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (keepFocus()) event.preventDefault();
        }}
      >
        {account ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {account.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the account {account.name}. It cannot be undone, and it is refused while transactions use it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={(event) => {
                  // Keep the dialog open until the api answers.
                  event.preventDefault();
                  onConfirm(account);
                }}
              >
                {pending ? 'Deleting...' : 'Delete account'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
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
  const keepFocusRef = useRef(false);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  function confirmDelete(account: Account) {
    remove.mutate(account.id, {
      onSuccess: () => {
        keepFocusRef.current = false;
        setDeleting(null);
        setNotice(null);
      },
      onError: (problem) => {
        keepFocusRef.current = true;
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
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
      {notice ? (
        <p role="alert" tabIndex={-1} ref={noticeRef} className={ERROR_CLASSES}>
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
      <section aria-labelledby="accounts-list-heading" className="flex flex-col gap-3">
        <h2 id="accounts-list-heading" className="text-lg font-semibold tracking-tight">
          Your accounts
        </h2>
        {accounts.isPending ? <p role="status">Loading accounts...</p> : null}
        {accounts.isError ? (
          <p role="alert" className={ERROR_CLASSES}>
            <span aria-hidden="true">⚠ </span>
            Could not load your accounts. Try again.
          </p>
        ) : null}
        {accounts.isSuccess && accounts.data.length === 0 ? (
          <p className="m-0 rounded-md border border-dashed p-4 text-muted-foreground">
            You have no accounts yet. To add your first one, enter a name, pick a type and, if you like, an opening
            balance in the form above, then choose Add account.
          </p>
        ) : null}
        {accounts.isSuccess && accounts.data.length > 0 ? (
          <div className="rounded-lg border bg-card text-card-foreground">
            <Table>
              <TableCaption className="sr-only">Your accounts with their type and opening balance</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Name</TableHead>
                  <TableHead scope="col">Type</TableHead>
                  <TableHead scope="col" className="text-right">
                    Opening balance
                  </TableHead>
                  <TableHead scope="col">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.data.map((account) => (
                  <TableRow key={account.id}>
                    <TableHead scope="row" className="h-auto py-3 font-semibold text-foreground [overflow-wrap:anywhere]">
                      {account.name}
                    </TableHead>
                    <TableCell>{ACCOUNT_TYPE_LABELS[account.type]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(account.openingBalanceMinor, currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${account.name}`}
                          onClick={() => {
                            setNotice(null);
                            setEditing(account);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Delete ${account.name}`}
                          onClick={() => {
                            setNotice(null);
                            setDeleting(account);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
      <ConfirmDelete
        account={deleting}
        pending={remove.isPending}
        keepFocus={() => keepFocusRef.current}
        onConfirm={confirmDelete}
        onCancel={() => {
          keepFocusRef.current = false;
          setDeleting(null);
        }}
      />
    </section>
  );
}
