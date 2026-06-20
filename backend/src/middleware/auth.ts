import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import prisma from '../db';
import { UserRole, CompanyRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'insightforge_secret_key_2026_super_secure';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: UserRole;
    companyRole: CompanyRole;
    companyId: number | null;
    credits: number;
  };
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication token missing.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        companyRole: true,
        company_id: true,
        credits: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User session no longer exists.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyRole: user.companyRole,
      companyId: user.company_id,
      credits: user.credits,
    };

    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    res.status(403).json({ error: 'Admin privileges required.' });
    return;
  }
  next();
}

export function requireCompanyRole(allowedRoles: CompanyRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated.' });
      return;
    }
    if (req.user.role === UserRole.ADMIN) {
      // Admins bypass company roles
      return next();
    }
    if (!allowedRoles.includes(req.user.companyRole)) {
      res.status(403).json({ error: 'Insufficient company permissions for this operation.' });
      return;
    }
    next();
  };
}
