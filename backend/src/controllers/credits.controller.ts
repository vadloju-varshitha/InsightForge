import { Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { createOrder, verifySignature, KEY_ID } from '../services/payment.service';

export async function createPaymentOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const orderSchema = z.object({
    amount: z.number().positive(), // in INR / units
    credits: z.number().int().positive(),
  });

  try {
    const { amount, credits } = orderSchema.parse(req.body);

    const order = await createOrder(amount);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      credits,
      keyId: KEY_ID,
    });
  } catch (error: any) {
    console.error('[CreditsController] Failed to create payment order:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment order.' });
  }
}

export async function verifyPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const verifySchema = z.object({
    razorpayOrderId: z.string(),
    razorpayPaymentId: z.string(),
    razorpaySignature: z.string(),
    credits: z.number().int().positive(),
  });

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, credits } = verifySchema.parse(req.body);

    const isValid = verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
      return;
    }

    // Add credits to user balance
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { credits: { increment: credits } },
      }),
      prisma.creditTransaction.create({
        data: {
          user_id: req.user.id,
          amount: credits,
          transaction_id: razorpayPaymentId,
          type: 'PURCHASE',
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREDIT_PURCHASE',
        target: `Purchased ${credits} credits. Payment ID: ${razorpayPaymentId}`,
        ip_address: req.ip,
      },
    });

    res.json({
      message: 'Payment verified and credits added successfully.',
      credits: updatedUser.credits,
    });
  } catch (error: any) {
    console.error('[CreditsController] Failed to verify payment:', error);
    res.status(500).json({ error: error.message || 'Failed to verify payment.' });
  }
}

export async function getTransactionHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const history = await prisma.creditTransaction.findMany({
      where: { user_id: req.user.id },
      orderBy: { timestamp: 'desc' },
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve transaction history.' });
  }
}
