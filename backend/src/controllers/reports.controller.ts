import { Response } from 'express';
import { z } from 'zod';
import prisma from '../db';
import { AuthenticatedRequest } from '../middleware/auth';
import { queueReportProcessing } from '../services/report.worker';
import { generateScenarioModeling } from '../services/ai.service';
import { ReportStatus } from '@prisma/client';

const createReportSchema = z.object({
  location_name: z.string().min(2),
  latitude: z.number(),
  longitude: z.number(),
  business_type: z.enum(['Grocery', 'Pharmacy', 'Fashion', 'Electronics', 'Restaurants', 'Healthcare']),
  store_size: z.number().int().positive(),
  investment_amount: z.number().int().positive(),
  target_audience: z.string().min(2),
  custom_sections: z.array(z.string()).optional(),
  brand_settings: z.object({
    logoUrl: z.string().optional(),
    primaryColor: z.string().optional(),
  }).optional(),
});

export async function createReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const data = createReportSchema.parse(req.body);

    // Fetch user credit count
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { credits: true, company_id: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (user.credits < 1) {
      res.status(400).json({ error: 'Insufficient report credits. Please purchase more credits.' });
      return;
    }

    // Deduct 1 credit and create report inside transaction
    const [updatedUser, report] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { credits: { decrement: 1 } },
      }),
      prisma.report.create({
        data: {
          user_id: req.user.id,
          company_id: user.company_id,
          location_name: data.location_name,
          latitude: data.latitude,
          longitude: data.longitude,
          business_type: data.business_type,
          store_size: data.store_size,
          investment_amount: data.investment_amount,
          target_audience: data.target_audience,
          status: ReportStatus.Requested,
          custom_sections: data.custom_sections || ['demographics', 'competitors', 'footfall', 'charts', 'recommendation'],
          brand_settings: data.brand_settings || { primaryColor: '#1E3A8A' },
        },
      }),
      prisma.creditTransaction.create({
        data: {
          user_id: req.user.id,
          amount: -1,
          transaction_id: `use_credit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'USAGE',
        },
      }),
    ]);

    // Log action
    await prisma.auditLog.create({
      data: {
        user_id: req.user.id,
        action: 'CREATE_REPORT_REQUEST',
        target: `Report ID: ${report.id} (${report.location_name})`,
        ip_address: req.ip,
      },
    });

    // Start background worker queue thread
    queueReportProcessing(report.id, req.user.id);

    res.status(201).json({
      message: 'Report request accepted and is now processing.',
      report,
      remainingCredits: updatedUser.credits,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Failed to request report.' });
    }
  }
}

export async function getReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { search, business_type, status, sort } = req.query;

  try {
    const whereClause: any = {};

    // Company-wide sharing: If user belongs to a company, fetch all reports in company. Else, user specific.
    if (req.user.companyId) {
      whereClause.company_id = req.user.companyId;
    } else {
      whereClause.user_id = req.user.id;
    }

    if (search && typeof search === 'string') {
      whereClause.location_name = { contains: search, mode: 'insensitive' };
    }

    if (business_type && typeof business_type === 'string') {
      whereClause.business_type = business_type;
    }

    if (status && typeof status === 'string') {
      whereClause.status = status as ReportStatus;
    }

    let orderByClause: any = { created_at: 'desc' };
    if (sort && typeof sort === 'string') {
      if (sort === 'location_asc') orderByClause = { location_name: 'asc' };
      if (sort === 'location_desc') orderByClause = { location_name: 'desc' };
      if (sort === 'date_asc') orderByClause = { created_at: 'asc' };
    }

    const reports = await prisma.report.findMany({
      where: whereClause,
      orderBy: orderByClause,
    });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve report history.' });
  }
}

export async function getReportDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id);

  if (isNaN(idNum)) {
    res.status(400).json({ error: 'Invalid ID parameter.' });
    return;
  }

  try {
    const report = await prisma.report.findUnique({
      where: { id: idNum },
      include: { user: true },
    });

    if (!report) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    // Authorization check: User must own the report, belong to same company, or be an admin
    const isOwner = report.user_id === req.user?.id;
    const isCompanyShare = req.user?.companyId && report.company_id === req.user.companyId;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!isOwner && !isCompanyShare && !isAdmin) {
      res.status(403).json({ error: 'Access denied to this report.' });
      return;
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve report details.' });
  }
}

// Location Comparison
export async function compareLocations(req: AuthenticatedRequest, res: Response): Promise<void> {
  const compareSchema = z.object({
    reportIds: z.array(z.number()).min(2),
  });

  try {
    const { reportIds } = compareSchema.parse(req.body);

    const reports = await prisma.report.findMany({
      where: {
        id: { in: reportIds },
      },
    });

    if (reports.length < 2) {
      res.status(400).json({ error: 'At least two valid report records are required for comparison.' });
      return;
    }

    // Load detailed data for each report to compare
    const comparisonData = [];
    for (const rep of reports) {
      let city = 'Hyderabad';
      let locality = 'Jubilee Hills';
      const parts = rep.location_name.split(',').map(s => s.trim());
      if (parts.length >= 2) {
        locality = parts[0];
        city = parts[1];
      }

      const demographic = await prisma.demographic.findUnique({
        where: { city_locality: { city, locality } },
      });

      const allCompetitors = await prisma.competitor.findMany({ where: { city } });
      const competitorCount = allCompetitors.filter(c => {
        const R = 6371;
        const dLat = ((rep.latitude - c.latitude) * Math.PI) / 180;
        const dLon = ((rep.longitude - c.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((c.latitude * Math.PI) / 180) *
            Math.cos((rep.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return distance <= 5 && c.category.toLowerCase() === rep.business_type.toLowerCase();
      }).length;

      comparisonData.push({
        id: rep.id,
        name: rep.location_name,
        city,
        locality,
        businessType: rep.business_type,
        population: demographic?.population || 100000,
        income: demographic?.income_level || 'Middle',
        density: demographic?.density || 3000,
        competitors: competitorCount,
        footfall: rep.footfall_estimate || 5000,
      });
    }

    // Call AI summary comparisons (A vs B)
    const comparisonSummary = await generateScenarioModeling(
      comparisonData[0],
      comparisonData[1],
      reports[0].business_type
    );

    // Save Comparison to history
    await prisma.comparisonHistory.create({
      data: {
        user_id: req.user?.id || 0,
        title: `Comparison: ${reports.map(r => r.location_name.split(',')[0]).join(' vs ')}`,
        report_ids: reportIds,
      },
    });

    res.json({
      reports: comparisonData,
      modelResult: comparisonSummary,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Failed to process location comparison.' });
    }
  }
}

// Saved Locations List, Save, Unsave
export async function getSavedLocations(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const locations = await prisma.savedLocation.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve saved locations.' });
  }
}

export async function saveLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const saveLocSchema = z.object({
    name: z.string().min(2),
    latitude: z.number(),
    longitude: z.number(),
  });

  try {
    const { name, latitude, longitude } = saveLocSchema.parse(req.body);

    const location = await prisma.savedLocation.create({
      data: {
        user_id: req.user.id,
        name,
        latitude,
        longitude,
      },
    });

    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save location.' });
  }
}

export async function unsaveLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const idNum = parseInt(id);

  if (isNaN(idNum)) {
    res.status(400).json({ error: 'Invalid ID.' });
    return;
  }

  try {
    await prisma.savedLocation.delete({
      where: { id: idNum },
    });
    res.json({ message: 'Location removed from saved library.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete saved location.' });
  }
}

// Competitor density alert monitor (Saved Location Alert)
export async function checkLocationAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const saved = await prisma.savedLocation.findMany({
      where: { user_id: req.user.id },
    });

    const alerts = [];
    for (const loc of saved) {
      // Query competitors in a 5km radius to check density
      const allComps = await prisma.competitor.findMany();
      const currentComps = allComps.filter(c => {
        const R = 6371;
        const dLat = ((loc.latitude - c.latitude) * Math.PI) / 180;
        const dLon = ((loc.longitude - c.longitude) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((c.latitude * Math.PI) / 180) *
            Math.cos((loc.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return distance <= 5;
      });

      // Simulate a random shift or change if needed for demonstration, or alert if count > 10
      if (currentComps.length > 12) {
        alerts.push({
          locationName: loc.name,
          message: `Alert: High competitor density detected. Total competitor count in 5km is ${currentComps.length}. We advise caution.`,
          severity: 'High',
          competitorsCount: currentComps.length,
        });
      }
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check alerts.' });
  }
}
