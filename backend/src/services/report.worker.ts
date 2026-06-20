import prisma from '../db';
import { ReportStatus } from '@prisma/client';
import { generateExecutiveSummary } from './ai.service';
import { generatePDFBuffer } from './pdf.service';
import { uploadReportPDF } from './storage.service';
import { sendReportReadyNotification } from './notification.service';
import {
  fetchNearbyPlaces,
  fetchAccessibilityInfo,
  fetchLiveTraffic,
  fetchCurrentWeather,
} from './liveIntelligence';
import { fetchLiveCompetitors, calculateDensityScore } from './competitorService';

export function queueReportProcessing(reportId: number, userId: number): void {
  // Start the background process in an IIFE so the main request thread returns immediately
  (async () => {
    console.log(`[Worker] Started background processing for Report #${reportId}`);

    try {
      // 1. Update status to Processing
      await prisma.report.update({
        where: { id: reportId },
        data: { status: ReportStatus.Processing },
      });

      // 2. Fetch report details
      const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: { user: true },
      });

      if (!report) {
        console.error(`[Worker] Report #${reportId} not found in database.`);
        return;
      }

      // Parse locality and city names from location name
      let city = 'Hyderabad';
      let locality = 'Jubilee Hills';
      
      const parts = report.location_name.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        locality = parts[0];
        city = parts[1];
      } else if (parts.length === 1) {
        locality = parts[0];
      }

      // Fetch demographic record for density base variables
      let demographic = await prisma.demographic.findUnique({
        where: { city_locality: { city, locality } },
      });

      if (!demographic) {
        // Fallback to first available record
        demographic = await prisma.demographic.findFirst();
      }

      const popDensity = demographic?.density || 4500;
      const totalPop = demographic?.population || 120000;

      // 3. FETCH LIVE INTELLIGENCE APIs
      console.log(`[Worker] Querying live Overpass API for coordinates (${report.latitude}, ${report.longitude})...`);
      const nearbyBusinesses = await fetchNearbyPlaces(report.latitude, report.longitude, 1000); // 1km radius

      console.log(`[Worker] Querying OSRM Accessibility for City ${city}...`);
      const accessibility = await fetchAccessibilityInfo(report.latitude, report.longitude, city);

      console.log(`[Worker] Querying TomTom live Traffic...`);
      const traffic = await fetchLiveTraffic(report.latitude, report.longitude);

      console.log(`[Worker] Querying OpenWeather conditions...`);
      const weather = await fetchCurrentWeather(report.latitude, report.longitude);

      // 4. Competitor analysis & Market saturation
      console.log(`[Worker] Querying competitor service for direct competitors within 5km...`);
      const directCompetitors = await fetchLiveCompetitors(report.latitude, report.longitude, report.business_type, 5);
      const competitorDensityScore = calculateDensityScore(directCompetitors.length, report.business_type);
      const competitorSaturation = competitorDensityScore;

      // Group nearby businesses by categories for summary and metrics
      const businessCounts: Record<string, number> = {
        Grocery: 0,
        Healthcare: 0,
        Restaurants: 0,
        Fashion: 0,
        Electronics: 0,
        Other: 0,
      };

      nearbyBusinesses.forEach((b) => {
        const cat = b.category || 'Other';
        if (businessCounts[cat] !== undefined) {
          businessCounts[cat]++;
        } else {
          businessCounts['Other']++;
        }
      });

      // 5. Dynamic Footfall Viability Score (0 - 100)
      // Formula incorporates density, transport connectivity, traffic conditions, synergy and competition
      const baseDensityWeight = Math.min(40, (popDensity / 12000) * 40); // max 40
      const connectivityWeight = (accessibility.connectivityScore / 100) * 20; // max 20
      
      // Congestion contribution: moderate congestion indicates high activity hub (positive visibility)
      let trafficScoreContribution = 15;
      if (traffic.congestionIndex > 75) {
        trafficScoreContribution = 8; // too congested lowers accessibility
      } else if (traffic.congestionIndex > 30) {
        trafficScoreContribution = 20; // healthy customer flow
      }
      
      // Business synergy: presence of restaurants/cafes and malls adds attractiveness
      const restaurantsCount = businessCounts['Restaurants'] || 0;
      const groceryCount = businessCounts['Grocery'] || 0; // supermarkets & malls
      const synergyWeight = Math.min(25, (restaurantsCount * 1.5 + groceryCount * 3)); // max 25

      // Competition penalty: reduces footfall availability if direct market competitors are too high
      const competitionPenalty = Math.min(30, directCompetitors.length * 4.5);

      const viabilityScore = Math.max(
        15,
        Math.min(
          99,
          Math.floor(
            (baseDensityWeight + connectivityWeight + trafficScoreContribution + synergyWeight - competitionPenalty) *
              weather.impactFactor
          )
        )
      );

      // Scale footfall estimate based on viabilityScore and category scale factor
      // e.g. Grocery store gets higher absolute numbers than specialized electronics
      let categoryScale = 800;
      if (report.business_type === 'Grocery') categoryScale = 1200;
      if (report.business_type === 'Restaurants') categoryScale = 1000;
      if (report.business_type === 'Electronics') categoryScale = 600;

      const estimatedFootfall = Math.floor(viabilityScore * categoryScale * (report.store_size / 2000));
      const confidenceScore = Math.max(70, Math.min(98, 90 - directCompetitors.length * 2 + (nearbyBusinesses.length > 20 ? 5 : 0)));

      // Benchmarking Index compared to standard target
      let industryAvg = 'Average';
      if (viabilityScore > 75) {
        industryAvg = 'Above Average';
      } else if (viabilityScore < 45) {
        industryAvg = 'Below Average';
      }

      // Customer Sentiment (Seed sample ratings/percentages)
      const sentiment_pos = 65 + Math.floor(Math.random() * 20);
      const sentiment_neg = 5 + Math.floor(Math.random() * 10);
      const sentiment_neu = 100 - (sentiment_pos + sentiment_neg);

      // Assemble live metrics JSON
      const liveMetricsJSON = {
        refreshTimestamp: new Date().toISOString(),
        weather: {
          temp: weather.temp,
          condition: weather.condition,
          impactFactor: weather.impactFactor,
        },
        traffic: {
          speedRatio: traffic.speedRatio,
          congestionIndex: traffic.congestionIndex,
          flowCondition: traffic.flowCondition,
        },
        accessibility: {
          distanceKm: accessibility.distanceKm,
          durationMin: accessibility.durationMin,
          hubName: accessibility.hubName,
          connectivityScore: accessibility.connectivityScore,
        },
        businessCounts,
        marketSaturation: competitorSaturation,
        totalBusinessesNearby: nearbyBusinesses.length,
        competitorDensityScore: competitorSaturation,
        competitorsList: directCompetitors,
      };

      // 6. Generate AI Summary
      const summaryText = await generateExecutiveSummary(
        locality,
        city,
        report.business_type,
        {
          population: totalPop,
          income_level: demographic?.income_level || 'Middle',
          density: popDensity,
          male_percentage: demographic?.male_percentage || 50,
          female_percentage: demographic?.female_percentage || 50,
        },
        directCompetitors.length
      );

      // 7. Parse custom sections checklist
      const sections = (report.custom_sections as string[]) || ['demographics', 'competitors', 'footfall', 'charts', 'recommendation'];

      // Map live competitors to competitor list for PDF generation compatibility
      const pdfCompetitorList = directCompetitors.map(c => ({
        name: c.name,
        category: c.category,
        distance: c.distance,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude
      }));

      // 8. Generate PDF report buffer via Puppeteer
      const pdfBuffer = await generatePDFBuffer(
        {
          id: report.id,
          location_name: report.location_name,
          business_type: report.business_type,
          store_size: report.store_size,
          investment_amount: report.investment_amount,
          target_audience: report.target_audience,
          footfall_estimate: estimatedFootfall,
          confidence_score: confidenceScore,
          executive_summary: summaryText,
          custom_sections: sections,
          latitude: report.latitude,
          longitude: report.longitude,
          industry_avg: industryAvg,
          sentiment_pos,
          sentiment_neu,
          sentiment_neg,
          live_metrics: liveMetricsJSON,
        },
        {
          city,
          locality,
          population: totalPop,
          income_level: demographic?.income_level || 'Middle',
          density: popDensity,
          male_percentage: demographic?.male_percentage || 50,
          female_percentage: demographic?.female_percentage || 50,
          age_18_25: demographic?.age_18_25 || 25,
          age_26_40: demographic?.age_26_40 || 35,
          age_41_60: demographic?.age_41_60 || 28,
          age_60_plus: demographic?.age_60_plus || 12,
        },
        pdfCompetitorList,
        {
          primaryColor: (report.brand_settings as any)?.primaryColor || '#1E3A8A',
          logoUrl: (report.brand_settings as any)?.logoUrl || undefined,
        }
      );

      // 9. Upload PDF to Storage
      const pdfUrl = await uploadReportPDF(report.id, pdfBuffer);

      // 10. Update Report record in database
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.Ready,
          footfall_estimate: estimatedFootfall,
          confidence_score: confidenceScore,
          pdf_url: pdfUrl,
          executive_summary: summaryText,
          industry_avg: industryAvg,
          sentiment_pos,
          sentiment_neu,
          sentiment_neg,
          live_metrics: liveMetricsJSON,
        },
      });

      console.log(`[Worker] Report #${report.id} completed. Status: Ready.`);

      // 11. Trigger Email & Telegram Notification
      const downloadLink = pdfUrl;
      await sendReportReadyNotification(
        report.user_id,
        report.user.email,
        report.location_name,
        downloadLink
      );

      // 12. Log audit log
      await prisma.auditLog.create({
        data: {
          user_id: report.user_id,
          action: 'GENERATE_REPORT_SUCCESS',
          target: `Report ID: ${report.id} (${report.location_name})`,
        },
      });

    } catch (err: any) {
      console.error(`[Worker] Error processing Report #${reportId}:`, err);
      try {
        await prisma.report.update({
          where: { id: reportId },
          data: { status: ReportStatus.Ready, executive_summary: `Generation failed: ${err.message || err}` },
        });
      } catch (dbErr) {
        console.error(`[Worker] Failed to update report status to failed for Report #${reportId}:`, dbErr);
      }
    }
  })();
}

export async function cleanupStuckReports(): Promise<void> {
  try {
    const res = await prisma.report.updateMany({
      where: {
        status: {
          in: [ReportStatus.Requested, ReportStatus.Processing],
        },
      },
      data: {
        status: ReportStatus.Ready,
        executive_summary: 'Generation failed: System restarted during processing. Please try creating a new report.',
      },
    });
    if (res.count > 0) {
      console.log(`[Startup] Cleaned up ${res.count} stuck reports from database.`);
    }
  } catch (err) {
    console.error('[Startup] Failed to clean up stuck reports:', err);
  }
}
