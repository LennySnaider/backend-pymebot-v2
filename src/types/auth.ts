import { Request } from 'express';

export interface AuthRequest extends Request {
  tenantId?: string;
  userId?: string;
  user?: {
    id: string;
    tenantId: string;
  };
}