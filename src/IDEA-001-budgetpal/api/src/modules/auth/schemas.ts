import { z } from 'zod';
import type { Problem } from '../../kernel/errors.js';
import { checkPasswordPolicy } from './password.js';


export const EmailField = z
  .string({ required_error: 'Email is required.' })
  .max(254, 'Email must be at most 254 characters.')
  .email('Enter a valid email address.')
  .describe('Email address; unique regardless of letter case.');

/** Length 15..128 and not on the common-password list (D-06, AC-2); no composition rules. */
export const NewPasswordField = z
  .string({ required_error: 'Password is required.' })
  .superRefine((password, context) => {
    const result = checkPasswordPolicy(password);
    if (!result.ok) context.addIssue({ code: z.ZodIssueCode.custom, message: result.message });
  })
  .describe('15 to 128 characters; not a common password.');

export const SignUpBody = z.object({ email: EmailField, password: NewPasswordField }).strict();
export type SignUpBody = z.infer<typeof SignUpBody>;

/** Login does not re-check the policy: a wrong or old password is simply a failed login. */
export const LoginBody = z
  .object({
    email: z.string({ required_error: 'Email is required.' }).min(1, 'Email is required.').max(254),
    password: z.string({ required_error: 'Password is required.' }).min(1, 'Password is required.').max(1024),
  })
  .strict();
export type LoginBody = z.infer<typeof LoginBody>;

/** The only user fields a response may carry: never the hash. */
export const UserResponse = z.object({ id: z.number().int(), email: z.string() });
export type UserResponse = z.infer<typeof UserResponse>;

/** RFC 9457 body, documented under the media type it is returned with. */
export const ProblemResponse = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
}) satisfies z.ZodType<Problem>;

export function problemContent(description: string): {
  description: string;
  content: { 'application/problem+json': { schema: typeof ProblemResponse } };
} {
  return { description, content: { 'application/problem+json': { schema: ProblemResponse } } };
}
