import { Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';

export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      include: { company: true },
      orderBy: { created_at: 'desc' },
    });
    // Remove password hash from response
    const sanitized = users.map((u) => {
      const { password, ...rest } = u;
      return rest;
    });
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
}

export async function suspendUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id);

  if (isNaN(idNum)) {
    res.status(400).json({ error: 'Invalid user ID.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: idNum } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Toggle user suspension / reset credits to 0 or block (we'll toggle role or keep audit logs)
    // For simplicity, we toggle user's role to a custom status or empty credits as suspension.
    // Let's modify the credits to 0 or toggle a suspended state in audit log.
    // We can also delete the user or set their credits to -1 to represent suspension.
    const updated = await prisma.user.update({
      where: { id: idNum },
      data: {
        credits: user.credits >= 0 ? -1 : 3, // -1 represents suspended
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: user.credits >= 0 ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
        target: `User ID: ${idNum} (${user.email})`,
        ip_address: req.ip,
      },
    });

    res.json({ message: 'User status updated successfully.', user: { id: updated.id, email: updated.email, credits: updated.credits } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle suspension.' });
  }
}

export async function manageCredits(req: AuthenticatedRequest, res: Response): Promise<void> {
  const creditChangeSchema = z.object({
    userId: z.number(),
    amount: z.number().int(), // positive for increase, negative for decrease/refund
    reason: z.string().min(2),
  });

  try {
    const { userId, amount, reason } = creditChangeSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        credits: { increment: amount },
      },
    });

    // Record transaction
    await prisma.creditTransaction.create({
      data: {
        user_id: userId,
        amount,
        transaction_id: `admin_adjust_${Date.now()}`,
        type: amount > 0 ? 'REFUND' : 'USAGE', // refund represents adjustments
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: 'CREDIT_ADJUSTMENT',
        target: `User ID: ${userId} (${amount > 0 ? '+' : ''}${amount} credits. Reason: ${reason})`,
        ip_address: req.ip,
      },
    });

    res.json({ message: 'Credits adjusted successfully.', user: { id: updated.id, email: updated.email, credits: updated.credits } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Failed to adjust credits.' });
    }
  }
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
}

export async function getNotificationLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const logs = await prisma.notification.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve notification logs.' });
  }
}

export async function getAdminAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const totalUsers = await prisma.user.count({ where: { role: 'CLIENT' } });
    const totalReports = await prisma.report.count();
    const reportsProcessing = await prisma.report.count({ where: { status: 'Processing' } });
    
    // Transactions sum
    const transactions = await prisma.creditTransaction.findMany();
    const totalPurchased = transactions.filter(t => t.type === 'PURCHASE').reduce((sum, t) => sum + t.amount, 0);
    const totalUsed = transactions.filter(t => t.type === 'USAGE').reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Group reports by month
    const reports = await prisma.report.findMany({
      select: { created_at: true },
    });

    const monthlyMap: Record<string, number> = {};
    reports.forEach((r) => {
      const month = r.created_at.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthlyMap[month] = (monthlyMap[month] || 0) + 1;
    });

    const reportsPerMonth = Object.keys(monthlyMap).map(month => ({
      month,
      reports: monthlyMap[month],
    }));

    // Popular locations
    const popularLocsRaw = await prisma.report.groupBy({
      by: ['location_name'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 5,
    });

    const popularLocations = popularLocsRaw.map(l => ({
      location: l.location_name.split(',')[0],
      count: l._count.id,
    }));

    res.json({
      metrics: {
        totalUsers,
        totalReports,
        reportsProcessing,
        totalPurchased,
        totalUsed,
      },
      reportsPerMonth,
      popularLocations,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compile admin analytics.' });
  }
}
