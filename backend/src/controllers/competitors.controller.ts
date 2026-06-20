import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { fetchLiveCompetitors } from '../services/competitorService';

const competitorSchema = z.object({
  name: z.string().min(2),
  category: z.enum(['Grocery', 'Pharmacy', 'Fashion', 'Electronics', 'Restaurants', 'Healthcare']),
  latitude: z.number(),
  longitude: z.number(),
  rating: z.number().min(1).max(5),
  city: z.string().min(2),
  locality: z.string().min(2),
});

export async function getNearbyCompetitors(req: Request, res: Response): Promise<void> {
  const { lat, lng, radius, category } = req.query;

  if (!lat || !lng) {
    res.status(400).json({ error: 'Latitude (lat) and Longitude (lng) are required.' });
    return;
  }

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);
  const searchRadius = radius ? parseFloat(radius as string) : 5; // default 5 km

  if (isNaN(userLat) || isNaN(userLng)) {
    res.status(400).json({ error: 'Invalid latitude or longitude.' });
    return;
  }

  const targetCategory = (category && typeof category === 'string') ? category : 'Grocery';

  try {
    const nearby = await fetchLiveCompetitors(userLat, userLng, targetCategory, searchRadius);
    res.json(nearby);
  } catch (error) {
    res.status(500).json({ error: 'Failed to query nearby competitors.' });
  }
}

// Admin CRUD operations
export async function createCompetitor(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = competitorSchema.parse(req.body);

    const newRecord = await prisma.competitor.create({ data });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: 'CREATE_COMPETITOR',
        target: `Competitor: ${data.name} (${data.category})`,
        ip_address: req.ip,
      },
    });

    res.status(201).json(newRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Failed to create competitor.' });
    }
  }
}

export async function updateCompetitor(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id);

  if (isNaN(idNum)) {
    res.status(400).json({ error: 'Invalid ID parameter.' });
    return;
  }

  try {
    const data = competitorSchema.parse(req.body);

    const updatedRecord = await prisma.competitor.update({
      where: { id: idNum },
      data,
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: 'UPDATE_COMPETITOR',
        target: `Competitor ID: ${idNum} (${data.name})`,
        ip_address: req.ip,
      },
    });

    res.json(updatedRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Failed to update competitor.' });
    }
  }
}

export async function deleteCompetitor(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id);

  if (isNaN(idNum)) {
    res.status(400).json({ error: 'Invalid ID parameter.' });
    return;
  }

  try {
    const record = await prisma.competitor.findUnique({ where: { id: idNum } });
    if (!record) {
      res.status(404).json({ error: 'Competitor not found.' });
      return;
    }

    await prisma.competitor.delete({ where: { id: idNum } });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: 'DELETE_COMPETITOR',
        target: `Competitor ID: ${idNum} (${record.name})`,
        ip_address: req.ip,
      },
    });

    res.json({ message: 'Competitor deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete competitor.' });
  }
}
