import { randomBytes, randomUUID } from 'node:crypto';

export type Id = string;

export const novoId = (): Id => randomUUID();

/** Token aleatório e difícil de adivinhar, usado em links de acesso e de convite. */
export const novaChave = (): string => randomBytes(18).toString('base64url');
