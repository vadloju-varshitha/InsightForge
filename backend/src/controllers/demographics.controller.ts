import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { AuthenticatedRequest } from '../middleware/auth';

const demographicSchema = z.object({
  city: z.string().min(2),
  locality: z.string().min(2),
  population: z.number().int().nonnegative(),
  income_level: z.enum(['Low', 'Middle', 'Upper Middle', 'High']),
  density: z.number().int().nonnegative(),
  male_percentage: z.number().min(0).max(100),
  female_percentage: z.number().min(0).max(100),
  age_18_25: z.number().min(0).max(100),
  age_26_40: z.number().min(0).max(100),
  age_41_60: z.number().min(0).max(100),
  age_60_plus: z.number().min(0).max(100),
});

export async function getCities(req: Request, res: Response): Promise<void> {
  try {
    const cities = await prisma.demographic.findMany({
      distinct: ['city'],
      select: { city: true },
      orderBy: { city: 'asc' },
    });
    res.json(cities.map((c) => c.city));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve cities.' });
  }
}

export async function getLocalities(req: Request, res: Response): Promise<void> {
  const { city } = req.query;
  if (!city || typeof city !== 'string') {
    res.status(400).json({ error: 'City parameter is required.' });
    return;
  }

  try {
    const localities = await prisma.demographic.findMany({
      where: { city },
      select: { locality: true, population: true, density: true, income_level: true },
      orderBy: { locality: 'asc' },
    });
    res.json(localities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve localities.' });
  }
}

export async function searchLocalities(req: Request, res: Response): Promise<void> {
  const { q } = req.query;
  const queryStr = q && typeof q === 'string' ? q : '';

  try {
    const results = await prisma.demographic.findMany({
      where: {
        OR: [
          { locality: { contains: queryStr, mode: 'insensitive' } },
          { city: { contains: queryStr, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: [{ city: 'asc' }, { locality: 'asc' }],
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search localities.' });
  }
}

export async function getDemographicDetails(req: Request, res: Response): Promise<void> {
  const { city, locality } = req.query;
  if (!city || !locality || typeof city !== 'string' || typeof locality !== 'string') {
    res.status(400).json({ error: 'Both city and locality query parameters are required.' });
    return;
  }

  try {
    const record = await prisma.demographic.findUnique({
      where: {
        city_locality: {
          city,
          locality,
        },
      },
    });

    if (!record) {
      res.status(404).json({ error: 'Demographic data for this location not found.' });
      return;
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve demographic details.' });
  }
}

// Admin CRUD Operations
export async function createDemographic(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = demographicSchema.parse(req.body);

    const existing = await prisma.demographic.findUnique({
      where: {
        city_locality: {
          city: data.city,
          locality: data.locality,
        },
      },
    });

    if (existing) {
      res.status(400).json({ error: 'Demographic entry already exists for this locality.' });
      return;
    }

    const newRecord = await prisma.demographic.create({ data });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: 'CREATE_DEMOGRAPHIC',
        target: `Demographics: ${data.city} - ${data.locality}`,
        ip_address: req.ip,
      },
    });

    res.status(201).json(newRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Failed to create demographic record.' });
    }
  }
}

export async function updateDemographic(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id);

  if (isNaN(idNum)) {
    res.status(400).json({ error: 'Invalid ID parameter.' });
    return;
  }

  try {
    const data = demographicSchema.parse(req.body);

    const updatedRecord = await prisma.demographic.update({
      where: { id: idNum },
      data,
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: 'UPDATE_DEMOGRAPHIC',
        target: `Demographics ID: ${idNum} (${data.city} - ${data.locality})`,
        ip_address: req.ip,
      },
    });

    res.json(updatedRecord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      res.status(500).json({ error: 'Failed to update demographic record.' });
    }
  }
}

export async function deleteDemographic(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id);

  if (isNaN(idNum)) {
    res.status(400).json({ error: 'Invalid ID parameter.' });
    return;
  }

  try {
    const record = await prisma.demographic.findUnique({ where: { id: idNum } });
    if (!record) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }

    await prisma.demographic.delete({ where: { id: idNum } });

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id,
        action: 'DELETE_DEMOGRAPHIC',
        target: `Demographics ID: ${idNum} (${record.city} - ${record.locality})`,
        ip_address: req.ip,
      },
    });

    res.json({ message: 'Demographic record deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete demographic record.' });
  }
}
