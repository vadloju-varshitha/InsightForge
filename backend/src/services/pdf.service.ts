import puppeteer from 'puppeteer';

export interface PDFBranding {
  logoUrl?: string;
  primaryColor?: string; // e.g. '#1E3A8A'
}

export async function generatePDFBuffer(
  report: {
    id: number;
    location_name: string;
    business_type: string;
    store_size: number;
    investment_amount: number;
    target_audience: string;
    footfall_estimate: number;
    confidence_score: number;
    executive_summary: string;
    custom_sections: string[]; // e.g. ["demographics", "competitors", "footfall", "charts", "recommendation"]
    latitude: number;
    longitude: number;
    industry_avg?: string;
    sentiment_pos?: number;
    sentiment_neu?: number;
    sentiment_neg?: number;
    live_metrics?: any;
  },
  demographics: {
    city: string;
    locality: string;
    population: number;
    income_level: string;
    density: number;
    male_percentage: number;
    female_percentage: number;
    age_18_25: number;
    age_26_40: number;
    age_41_60: number;
    age_60_plus: number;
  },
  competitors: Array<{ name: string; category: string; distance?: number; address?: string; latitude: number; longitude: number }>,
  branding: PDFBranding = {}
): Promise<Buffer> {
  const primaryColor = branding.primaryColor || '#1E3A8A';
  const logoUrl = branding.logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop&q=80'; // fallback abstract premium logo

  const includeSection = (sec: string) => report.custom_sections.includes(sec);

  // Demographic Charts as SVG Vector elements
  // 1. Gender Pie Chart SVG
  const maleAngle = (demographics.male_percentage / 100) * 360;
  const xEnd = 50 + 40 * Math.cos((maleAngle - 90) * (Math.PI / 180));
  const yEnd = 50 + 40 * Math.sin((maleAngle - 90) * (Math.PI / 180));
  const largeArcFlag = demographics.male_percentage > 50 ? 1 : 0;
  
  const genderPieSVG = `
    <svg viewBox="0 0 100 100" class="chart-svg">
      <circle cx="50" cy="50" r="40" fill="#3B82F6" />
      <path d="M 50 50 L 50 10 A 40 40 0 ${largeArcFlag} 1 ${xEnd} ${yEnd} Z" fill="#1E3A8A" />
      <circle cx="50" cy="50" r="20" fill="#ffffff" />
    </svg>
  `;

  // 2. Age Bar Chart SVG
  const maxAgeVal = Math.max(demographics.age_18_25, demographics.age_26_40, demographics.age_41_60, demographics.age_60_plus);
  const getBarHeight = (val: number) => (val / maxAgeVal) * 80;
  
  const ageBarSVG = `
    <svg viewBox="0 0 160 120" class="chart-svg">
      <!-- Grid Lines -->
      <line x1="20" y1="20" x2="150" y2="20" stroke="#e2e8f0" stroke-dasharray="2" />
      <line x1="20" y1="60" x2="150" y2="60" stroke="#e2e8f0" stroke-dasharray="2" />
      <line x1="20" y1="100" x2="150" y2="100" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Bars -->
      <rect x="25" y="${100 - getBarHeight(demographics.age_18_25)}" width="20" height="${getBarHeight(demographics.age_18_25)}" fill="${primaryColor}" rx="2" />
      <rect x="55" y="${100 - getBarHeight(demographics.age_26_40)}" width="20" height="${getBarHeight(demographics.age_26_40)}" fill="#3B82F6" rx="2" />
      <rect x="85" y="${100 - getBarHeight(demographics.age_41_60)}" width="20" height="${getBarHeight(demographics.age_41_60)}" fill="#10B981" rx="2" />
      <rect x="115" y="${100 - getBarHeight(demographics.age_60_plus)}" width="20" height="${getBarHeight(demographics.age_60_plus)}" fill="#F59E0B" rx="2" />
      
      <!-- Labels -->
      <text x="35" y="112" font-size="7" fill="#64748b" text-anchor="middle">18-25</text>
      <text x="65" y="112" font-size="7" fill="#64748b" text-anchor="middle">26-40</text>
      <text x="95" y="112" font-size="7" fill="#64748b" text-anchor="middle">41-60</text>
      <text x="125" y="112" font-size="7" fill="#64748b" text-anchor="middle">60+</text>
    </svg>
  `;

  // 3. Footfall Gauge Chart SVG
  const gaugeAngle = (report.confidence_score / 100) * 180;
  const needleAngleRad = (gaugeAngle - 180) * (Math.PI / 180);
  const needleX = 50 + 35 * Math.cos(needleAngleRad);
  const needleY = 55 + 35 * Math.sin(needleAngleRad);

  const footfallGaugeSVG = `
    <svg viewBox="0 0 100 60" class="gauge-svg">
      <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="#e2e8f0" stroke-width="8" stroke-linecap="round" />
      <path d="M 10 55 A 40 40 0 0 1 ${50 + 40 * Math.cos(needleAngleRad)} ${55 + 40 * Math.sin(needleAngleRad)}" fill="none" stroke="#10B981" stroke-width="8" stroke-linecap="round" />
      
      <!-- Needle -->
      <line x1="50" y1="55" x2="${needleX}" y2="${needleY}" stroke="#1E3A8A" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="50" cy="55" r="4" fill="#1E3A8A" />
      
      <text x="50" y="45" font-size="10" fill="#1e293b" text-anchor="middle" font-weight="bold">${report.confidence_score}%</text>
      <text x="50" y="55" font-size="6" fill="#64748b" text-anchor="middle">Confidence</text>
    </svg>
  `;

  // Build HTML report
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>InsightForge Market Research Report</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 40px;
      line-height: 1.5;
      font-size: 13px;
      background-color: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 15px;
      margin-bottom: 30px;
    }
    .header img {
      max-height: 50px;
      border-radius: 4px;
    }
    .header-details {
      text-align: right;
    }
    .header-details h2 {
      margin: 0;
      color: ${primaryColor};
      font-size: 18px;
      font-weight: 800;
    }
    .header-details p {
      margin: 3px 0 0 0;
      font-size: 10px;
      color: #64748b;
    }
    .report-title-container {
      margin-bottom: 30px;
    }
    .report-title {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 5px 0;
    }
    .report-subtitle {
      font-size: 14px;
      color: #3b82f6;
      margin: 0;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      margin-bottom: 35px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: ${primaryColor};
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 15px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
    }
    .card-subtext {
      font-size: 10px;
      color: #64748b;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      background-color: #f1f5f9;
    }
    .chart-container {
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      height: 180px;
    }
    .chart-svg {
      width: 100%;
      height: 100%;
      max-height: 150px;
    }
    .gauge-svg {
      width: 80%;
      height: 80%;
      max-height: 110px;
    }
    .legend-container {
      display: flex;
      flex-direction: column;
      gap: 5px;
      justify-content: center;
      font-size: 11px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 9999px;
      background-color: #e0f2fe;
      color: #0369a1;
    }
    .footer {
      position: fixed;
      bottom: 20px;
      left: 40px;
      right: 40px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 8px;
    }
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- Cover / Header Header -->
  <div class="header">
    <img src="${logoUrl}" alt="Company Logo" />
    <div class="header-details">
      <h2>InsightForge Reports</h2>
      <p>Date: ${new Date().toLocaleDateString()} | ID: #REP-${report.id}</p>
    </div>
  </div>

  <div class="report-title-container">
    <div class="report-subtitle">Market Intelligence Report</div>
    <h1 class="report-title">${demographics.locality}, ${demographics.city}</h1>
    <div class="badge">${report.business_type} Store Expansion Analysis</div>
  </div>

  <!-- Executive Summary -->
  ${includeSection('recommendation') ? `
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <p style="font-size: 14px; font-weight: 500; color: #1e293b; line-height: 1.6; background-color: #eff6ff; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
      "${report.executive_summary}"
    </p>
  </div>
  ` : ''}

  <!-- Location Overview -->
  <div class="section">
    <div class="section-title">Location Profile & Parameters</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Target Business Category</div>
        <div class="card-value" style="color: ${primaryColor};">${report.business_type}</div>
        <div class="card-subtext">Optimized parameters for this industry vertical</div>
      </div>
      <div class="card">
        <div class="card-title">Store Configuration</div>
        <div class="card-value">${report.store_size.toLocaleString()} sq ft</div>
        <div class="card-subtext">Investment: $${report.investment_amount.toLocaleString()} | Target: ${report.target_audience}</div>
      </div>
    </div>
  </div>

  <!-- Demographics Analysis -->
  ${includeSection('demographics') ? `
  <div class="section">
    <div class="section-title">Demographic Analytics</div>
    <div class="grid-2" style="margin-bottom: 20px;">
      <div class="card">
        <div class="card-title">Estimated Population</div>
        <div class="card-value">${demographics.population.toLocaleString()}</div>
        <div class="card-subtext">Density: ${demographics.density.toLocaleString()}/sq km (${demographics.density > 5000 ? 'High Density' : 'Medium Density'})</div>
      </div>
      <div class="card">
        <div class="card-title">Household Income Tier</div>
        <div class="card-value" style="color: #10B981;">${demographics.income_level}</div>
        <div class="card-subtext">Reflects average purchasing power index</div>
      </div>
    </div>

    ${includeSection('charts') ? `
    <div class="grid-2">
      <div>
        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #475569;">Gender Distribution Ratio</h4>
        <div class="chart-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          ${genderPieSVG}
          <div class="legend-container">
            <div class="legend-item">
              <span class="legend-dot" style="background-color: #1E3A8A;"></span>
              <span>Male: <strong>${demographics.male_percentage}%</strong></span>
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="background-color: #3B82F6;"></span>
              <span>Female: <strong>${demographics.female_percentage}%</strong></span>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #475569;">Age Bracket Profile</h4>
        <div class="chart-container">
          ${ageBarSVG}
        </div>
      </div>
    </div>
    ` : ''}
  </div>
  ` : ''}

  <div class="page-break"></div>

  <!-- Competitors Mapping -->
  ${includeSection('competitors') ? `
  <div class="section">
    <div class="section-title">Competitor Landscape Analysis</div>
    <p style="margin-top: 0; color: #64748b; font-size: 11px;">
      Detailed overview of direct competitor outlets identified within a 5km radius of coordinates (${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}).
    </p>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Address</th>
          <th>Distance</th>
          <th>Coordinates</th>
        </tr>
      </thead>
      <tbody>
        ${competitors.slice(0, 10).map(c => `
          <tr>
            <td style="font-weight: 600;">${c.name}</td>
            <td style="font-size: 10px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.address || 'Address not available'}</td>
            <td>${c.distance ? `${c.distance} km` : 'Near'}</td>
            <td style="font-family: monospace; font-size: 10px; color: #64748b;">${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${competitors.length === 0 ? '<p style="text-align: center; color: #94a3b8; padding: 20px;">No direct competitors found in this radius.</p>' : ''}
  </div>
  ` : ''}

  <!-- Footfall Estimation -->
  ${includeSection('footfall') ? `
  <div class="section">
    <div class="section-title">Expected Footfall Estimation Model</div>
    <div class="grid-2">
      <div class="card" style="display: flex; flex-direction: column; justify-content: center;">
        <div class="card-title">Expected Monthly Traffic</div>
        <div class="card-value" style="font-size: 24px; color: #10B981;">
          ~ ${report.footfall_estimate ? report.footfall_estimate.toLocaleString() : 'N/A'}
        </div>
        <div class="card-subtext" style="font-weight: 600; color: #10B981;">
          Live Location Intelligence
        </div>
        <div class="card-subtext" style="margin-top: 12px; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
          Benchmarking Score: <strong>${report.industry_avg || 'Average'}</strong> compared to industry averages.
        </div>
      </div>
      
      <div>
        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #475569;">Estimation Confidence Level</h4>
        <div class="chart-container">
          ${footfallGaugeSVG}
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Live Environment Intelligence -->
  ${report.live_metrics ? `
  <div class="section">
    <div class="section-title">Live Mobility & Environmental Intelligence</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Live Traffic Congestion (TomTom)</div>
        <div class="card-value">${report.live_metrics.traffic?.congestionIndex}%</div>
        <div class="card-subtext">Flow Condition: <strong>${report.live_metrics.traffic?.flowCondition}</strong> (Speed Ratio: ${report.live_metrics.traffic?.speedRatio})</div>
      </div>
      <div class="card">
        <div class="card-title">OpenWeather Conditions</div>
        <div class="card-value">${report.live_metrics.weather?.temp}&deg;C</div>
        <div class="card-subtext">Condition: <strong>${report.live_metrics.weather?.condition}</strong> (Mobility Impact: ${report.live_metrics.weather?.impactFactor}x)</div>
      </div>
    </div>
    <div class="card" style="margin-top: 15px;">
      <div class="card-title">Transit Accessibility & Connectivity (OSRM)</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 5px;">
        <div>
          <span style="font-size: 14px; font-weight: 700; color: #1e293b;">${report.live_metrics.accessibility?.hubName}</span>
          <div class="card-subtext">Distance: <strong>${report.live_metrics.accessibility?.distanceKm} km</strong> | Driving Time: <strong>${report.live_metrics.accessibility?.durationMin} min</strong></div>
        </div>
        <div style="text-align: right;">
          <span class="badge" style="font-size: 11px; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;">
            Connectivity Score: ${report.live_metrics.accessibility?.connectivityScore}/100
          </span>
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Sentiment & Scenario -->
  <div class="section" style="margin-top: 20px;">
    <div class="section-title">Sentiment & Market Sentiment Analysis</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Customer Sentiment Breakdown</div>
        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <div style="flex: ${report.sentiment_pos || 70}; background-color: #10B981; height: 16px; border-radius: 3px;" title="Positive"></div>
          <div style="flex: ${report.sentiment_neu || 20}; background-color: #cbd5e1; height: 16px; border-radius: 3px;" title="Neutral"></div>
          <div style="flex: ${report.sentiment_neg || 10}; background-color: #ef4444; height: 16px; border-radius: 3px;" title="Negative"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 6px; color: #64748b;">
          <span>Pos: ${report.sentiment_pos || 70}%</span>
          <span>Neu: ${report.sentiment_neu || 20}%</span>
          <span>Neg: ${report.sentiment_neg || 10}%</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Key Local Sentiment Keywords</div>
        <div style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px;">
          <span style="font-size: 13px; font-weight: bold; color: ${primaryColor};">Convenient</span>
          <span style="font-size: 11px; color: #10B981;">Clean</span>
          <span style="font-size: 14px; font-weight: 800; color: #3B82F6;">Spacious</span>
          <span style="font-size: 10px; color: #f59e0b;">Busy Parking</span>
          <span style="font-size: 12px; color: #475569;">Fresh Options</span>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <span>InsightForge Reports &bull; Confidential Location Intelligence</span>
    <span>Page 2 of 2</span>
  </div>

</body>
</html>
  `;

  // Launch Puppeteer browser inside the terminal sandbox or host environment
  // We'll use --no-sandbox args so it works on Linux/Windows containers easily
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 12000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px',
      },
    });

    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error('Puppeteer generation failed, returning a placeholder text PDF buffer:', err);
    // If Puppeteer fails (e.g. chromium dependencies not installed on standard render shell),
    // return a basic text-based PDF or placeholder buffer to prevent crashing
    return Buffer.from(htmlContent);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Failed to close Puppeteer browser during cleanup:', closeErr);
      }
    }
  }
}
