import { randomUUID } from 'node:crypto';

export type Id = string;

export const novoId = (): Id => randomUUID();
