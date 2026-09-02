import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { EMPLOYEE_STATUSES, MOVEMENT_TYPES, ROLES } from './types.ts';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function asyncHandler(fn: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

export function handleError(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'Dados inválidos.' });
    return;
  }
  if (err instanceof ZodError || (typeof err === 'object' && err && 'issues' in err && Array.isArray((err as { issues: unknown[] }).issues))) {
    const issues = (err as ZodError).issues;
    res.status(400).json({ error: issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }
  const message = err instanceof Error ? err.message : 'Erro interno do servidor.';
  console.error(err);
  res.status(500).json({ error: message });
}

const nonEmpty = (label: string, max = 120) => z.string().trim().min(1, `${label} é obrigatório.`).max(max, `${label} é longo demais.`);

export const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido.').max(180).transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Informe a senha.').max(72),
});

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres.')
  .max(72, 'A senha deve ter no máximo 72 caracteres.');

export const createUserSchema = z.object({
  name: nonEmpty('Nome'),
  email: z.string().trim().email('E-mail inválido.').max(180).transform((value) => value.toLowerCase()),
  password: passwordSchema,
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  name: nonEmpty('Nome').optional(),
  email: z.string().trim().email('E-mail inválido.').max(180).transform((value) => value.toLowerCase()).optional(),
  password: passwordSchema.optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('E-mail inválido.').max(180).transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  accessToken: z.string().min(20, 'Link inválido ou expirado.'),
  refreshToken: z.string().min(10, 'Link inválido ou expirado.'),
  password: passwordSchema,
});

export const employeeSchema = z.object({
  name: nonEmpty('Nome'),
  registration: nonEmpty('Matrícula', 40),
  role: nonEmpty('Cargo', 80),
  sector: nonEmpty('Setor', 80),
  admission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de admissão inválida.'),
  status: z.enum(EMPLOYEE_STATUSES),
});

export const epiSchema = z.object({
  name: nonEmpty('Nome'),
  category: nonEmpty('Categoria', 80),
  brand: nonEmpty('Marca', 80),
  ca: nonEmpty('CA', 40),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Validade inválida.'),
  minimum: z.number().int().min(0).max(1_000_000),
  available: z.number().int().min(0).max(1_000_000).optional(),
});

export const epiPatchSchema = epiSchema.partial();

export const movementSchema = z.object({
  type: z.enum(MOVEMENT_TYPES),
  epiId: z.string().min(1),
  employeeId: z.union([z.string().min(1), z.null()]).optional(),
  quantity: z.number().int().min(-100_000).max(100_000),
  note: z.string().trim().max(280, 'Observação é longa demais.').optional().default(''),
});

export const inventoryCountSchema = z.object({
  found: z.number().int().min(0).max(1_000_000),
});
