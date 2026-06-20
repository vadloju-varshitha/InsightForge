import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserRole, CompanyRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'insightforge_secret_key_2026_super_secure';

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  companyName: z.string().optional(),
  industry: z.string().optional(),
  joinCompanyId: z.number().optional(),
  companyRole: z.nativeEnum(CompanyRole).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function signup(req: any, res: Response): Promise<void> {
  try {
    const data = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    let companyId: number | null = null;
    let companyName = data.companyName || null;

    if (data.joinCompanyId) {
      const company = await prisma.company.findUnique({ where: { id: data.joinCompanyId } });
      if (!company) {
        res.status(400).json({ error: 'Company to join not found.' });
        return;
      }
      companyId = company.id;
      companyName = company.name;
    } else if (data.companyName) {
      const newCompany = await prisma.company.create({
        data: { name: data.companyName },
      });
      companyId = newCompany.id;
    }

    const isFirstUser = (await prisma.user.count()) === 0;
    const role = isFirstUser ? UserRole.ADMIN : UserRole.CLIENT;
    const companyRole = data.joinCompanyId ? (data.companyRole || CompanyRole.ANALYST) : CompanyRole.OWNER;

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        company_name: companyName,
        industry: data.industry || 'Other',
        role,
        companyRole,
        credits: isFirstUser ? 9999 : 3, // Seed first signup with 3 credits
        company_id: companyId,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'SIGNUP',
        target: `User: ${user.email}`,
        ip_address: req.ip,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyRole: user.companyRole,
        companyId: user.company_id,
        companyName: user.company_name,
        credits: user.credits,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Internal server error during signup.' });
    }
  }
}

export async function login(req: any, res: Response): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { company: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        target: `User: ${user.email}`,
        ip_address: req.ip,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyRole: user.companyRole,
        companyId: user.company_id,
        companyName: user.company_name,
        credits: user.credits,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Internal server error during login.' });
    }
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { company: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyRole: user.companyRole,
        companyId: user.company_id,
        companyName: user.company_name,
        credits: user.credits,
        industry: user.industry,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
}

export async function getCompanyMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user || !req.user.companyId) {
    res.status(400).json({ error: 'User is not part of a company.' });
    return;
  }

  try {
    const members = await prisma.user.findMany({
      where: { company_id: req.user.companyId },
      select: {
        id: true,
        name: true,
        email: true,
        companyRole: true,
        created_at: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve company members.' });
  }
}

export async function addCompanyMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user || !req.user.companyId) {
    res.status(400).json({ error: 'User is not part of a company.' });
    return;
  }

  try {
    const inviteSchema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      companyRole: z.nativeEnum(CompanyRole),
    });

    const data = inviteSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already registered.' });
      return;
    }

    const company = await prisma.company.findUnique({ where: { id: req.user.companyId } });
    if (!company) {
      res.status(404).json({ error: 'Company not found.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        company_name: company.name,
        industry: 'Other',
        role: UserRole.CLIENT,
        companyRole: data.companyRole,
        credits: 0,
        company_id: company.id,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'ADD_TEAM_MEMBER',
        target: `User: ${newUser.email} added to Company ${company.name}`,
        ip_address: req.ip,
      },
    });

    res.status(201).json({
      message: 'Team member added successfully.',
      member: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        companyRole: newUser.companyRole,
        created_at: newUser.created_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Failed to add team member.' });
    }
  }
}
