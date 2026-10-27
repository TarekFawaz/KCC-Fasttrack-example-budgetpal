import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type FieldErrors = Partial<Record<'email' | 'password', string>>;

/** The one look of an inline error: text with an icon, never colour alone. */
export const ERROR_TEXT_CLASSES = 'm-0 text-sm font-semibold text-destructive';

interface AuthFieldProps {
  name: 'email' | 'password';
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  inputRef: (element: HTMLInputElement | null) => void;
}

/** A Label and Input pair; its error (text with icon, never colour alone) is tied to it with aria-describedby. */
export function AuthField({ name, label, type, autoComplete, value, onChange, error, hint, inputRef }: AuthFieldProps) {
  const id = `auth-${name}`;
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint ? (
        <p id={`${id}-hint`} className="m-0 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={ERROR_TEXT_CLASSES}>
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Moves focus to the first field (in `order`) that has an error each time the error set is replaced. */
export function useFocusFirstError(errors: FieldErrors, order: readonly (keyof FieldErrors)[]) {
  const refs = useRef<Partial<Record<keyof FieldErrors, HTMLInputElement | null>>>({});
  useEffect(() => {
    const first = order.find((name) => errors[name]);
    if (first) refs.current[first]?.focus();
  }, [errors, order]);
  return (name: keyof FieldErrors) => (element: HTMLInputElement | null) => {
    refs.current[name] = element;
  };
}
