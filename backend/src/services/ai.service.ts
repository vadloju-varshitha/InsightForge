import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;

if (apiKey && apiKey !== 'your-openai-api-key') {
  openai = new OpenAI({ apiKey });
}

export async function generateExecutiveSummary(
  locality: string,
  city: string,
  businessType: string,
  demographics: {
    population: number;
    income_level: string;
    density: number;
    male_percentage: number;
    female_percentage: number;
  },
  competitorCount: number
): Promise<string> {
  const prompt = `
Generate a highly professional, executive market intelligence summary for opening a ${businessType} store in ${locality}, ${city}.
Local demographics:
- Population: ${demographics.population}
- Income level: ${demographics.income_level}
- Population density: ${demographics.density} per sq km
- Gender split: ${demographics.male_percentage}% Male, ${demographics.female_percentage}% Female
- Competitor count: ${competitorCount} similar stores nearby.

Write a concise, 3-4 sentence analytical paragraph highlighting the attractiveness of this location, target segments, and potential competitive strategy.
`;

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 250,
        temperature: 0.7,
      });
      return response.choices[0]?.message?.content?.trim() || getDeterministicSummary(locality, city, businessType, demographics, competitorCount);
    } catch (error) {
      console.warn('OpenAI API call failed, falling back to rule-based generation:', error);
      return getDeterministicSummary(locality, city, businessType, demographics, competitorCount);
    }
  } else {
    return getDeterministicSummary(locality, city, businessType, demographics, competitorCount);
  }
}

export async function generateScenarioModeling(
  locA: { name: string; city: string; population: number; income: string; competitors: number; footfall: number },
  locB: { name: string; city: string; population: number; income: string; competitors: number; footfall: number },
  businessType: string
): Promise<{ prosA: string[]; consA: string[]; prosB: string[]; consB: string[]; recommendation: string }> {
  const prompt = `
Compare Location A: ${locA.name}, ${locA.city} vs Location B: ${locB.name}, ${locB.city} for opening a new ${businessType} store.
Data:
- Location A: Pop: ${locA.population}, Income: ${locA.income}, Competitors: ${locA.competitors}, Est. Footfall: ${locA.footfall}/mo
- Location B: Pop: ${locB.population}, Income: ${locB.income}, Competitors: ${locB.competitors}, Est. Footfall: ${locB.footfall}/mo

Provide the comparison in JSON format:
{
  "prosA": ["pro 1", "pro 2"],
  "consA": ["con 1", "con 2"],
  "prosB": ["pro 1", "pro 2"],
  "consB": ["con 1", "con 2"],
  "recommendation": "Executive recommendation statement explaining why Location X is preferred."
}
`;

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 400,
        temperature: 0.5,
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      if (parsed.recommendation) {
        return parsed;
      }
    } catch (e) {
      console.warn('OpenAI comparison failed, falling back to rule-based modeling:', e);
    }
  }

  return getDeterministicComparison(locA, locB, businessType);
}

function getDeterministicSummary(
  locality: string,
  city: string,
  businessType: string,
  demographics: any,
  competitorCount: number
): Promise<string> {
  const densityTerm = demographics.density > 5000 ? 'extremely dense' : 'moderately populated';
  const incomeTerm = demographics.income_level === 'High' || demographics.income_level === 'Upper Middle' ? 'affluent' : 'middle-income';
  const competitionTerm = competitorCount > 8 ? 'saturated competitive' : competitorCount > 3 ? 'competitive' : 'low-competition';
  
  let strategy = '';
  if (competitorCount > 5) {
    strategy = `Given the ${competitionTerm} landscape, a differentiation strategy focusing on premium customer service or unique product offerings is essential.`;
  } else {
    strategy = `The relatively ${competitionTerm} market presents a strong first-mover opportunity, enabling rapid brand establishment.`;
  }

  const summary = `${locality} in ${city} represents an attractive site for a new ${businessType} outlet due to its ${densityTerm}, ${incomeTerm} population profile. With an estimated local population of ${demographics.population.toLocaleString()} and a ${competitionTerm} competitor density (${competitorCount} active players), the area exhibits robust location viability. ${strategy} Overall, the location yields positive fundamentals for driving customer acquisitions and sustaining capital expenditure paybacks.`;
  
  return Promise.resolve(summary);
}

function getDeterministicComparison(
  locA: any,
  locB: any,
  businessType: string
): { prosA: string[]; consA: string[]; prosB: string[]; consB: string[]; recommendation: string } {
  // Let's decide which is better based on basic heuristic: footfall / (competitors + 1)
  const scoreA = locA.footfall / (locA.competitors + 1);
  const scoreB = locB.footfall / (locB.competitors + 1);
  const preferred = scoreA >= scoreB ? 'A' : 'B';
  const prefLoc = preferred === 'A' ? locA : locB;
  const oppLoc = preferred === 'A' ? locB : locA;

  const prosA = [
    `High local population count of ${locA.population.toLocaleString()}`,
    `Favorable ${locA.income} income level`,
    `Estimated monthly footfall of ${locA.footfall.toLocaleString()} consumers`
  ];
  const consA = [
    locA.competitors > 8 ? `High competitor density with ${locA.competitors} existing locations` : `Presence of ${locA.competitors} direct market competitors`
  ];

  const prosB = [
    `Localized demand driven by ${locB.population.toLocaleString()} residents`,
    `Solid customer profile in the ${locB.income} tier`,
    `Model estimated monthly traffic at ${locB.footfall.toLocaleString()} visits`
  ];
  const consB = [
    locB.competitors > 8 ? `Crowded market context with ${locB.competitors} competitors` : `Presence of ${locB.competitors} direct competitor outlets`
  ];

  const recommendation = `Based on location-intelligence scoring, ${prefLoc.name} (${prefLoc.city}) is highly recommended over ${oppLoc.name}. It yields a superior footfall-to-competition ratio (modeled footfall: ${prefLoc.footfall.toLocaleString()}/mo against ${prefLoc.competitors} competitors) which minimizes customer acquisition friction and improves store-level profitability margins.`;

  return { prosA, consA, prosB, consB, recommendation };
}
