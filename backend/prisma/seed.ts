import { PrismaClient, UserRole, CompanyRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Coordinates mapping for localities
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Hyderabad: { lat: 17.3850, lng: 78.4867 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Mumbai: { lat: 19.0760, lng: 72.8777 },
};

const LOCALITIES: Record<string, string[]> = {
  Hyderabad: [
    'Jubilee Hills', 'Banjara Hills', 'Gachibowli', 'Madhapur', 'Kondapur',
    'Begumpet', 'Kukatpally', 'Ameerpet', 'Hitech City', 'Secunderabad'
  ],
  Bangalore: [
    'Indiranagar', 'Koramangala', 'Whitefield', 'HSR Layout', 'Jayanagar',
    'Malleshwaram', 'Electronic City', 'Marathahalli', 'Bellandur', 'JP Nagar'
  ],
  Chennai: [
    'Adyar', 'T. Nagar', 'Nungambakkam', 'Mylapore', 'Velachery',
    'OMR Road', 'Anna Nagar', 'Guindy', 'Royapettah', 'Besant Nagar'
  ],
  Pune: [
    'Kothrud', 'Koregaon Park', 'Kalyani Nagar', 'Viman Nagar', 'Hinjewadi',
    'Baner', 'Wakad', 'Hadapsar', 'Aundh', 'Shivaji Nagar'
  ],
  Mumbai: [
    'Bandra', 'Andheri', 'Colaba', 'Juhu', 'Worli',
    'Powai', 'Thane', 'Navi Mumbai', 'Borivali', 'Chembur'
  ],
};

const COMPETITOR_NAMES: Record<string, string[]> = {
  Grocery: ['Reliance Fresh', 'D-Mart', 'Big Bazaar', 'More Supermarket', 'Star Bazaar', 'Nature Basket', 'Spencer\'s', 'Spencer\'s Daily', 'Spar Hypermarket', 'Nilgiri\'s'],
  Pharmacy: ['Apollo Pharmacy', 'MedPlus', 'Wellness Forever', 'Netmeds Store', 'Frank Ross Pharmacy', 'Fortis HealthWorld', '1mg Store', 'Local Chemist', 'Generics Plus', 'Pharmeasy'],
  Fashion: ['Max Fashion', 'Zudio', 'Trends', 'Pantaloons', 'Westside', 'Shoppers Stop', 'Lifestyle', 'H&M', 'Zara', 'Decathlon'],
  Electronics: ['Reliance Digital', 'Croma', 'Vijay Sales', 'Sangeetha Gadgets', 'Unilet', 'Kohinoor Electronics', 'E-Zone', 'Poorvika', 'Bajaj Electronics', 'Lotus Electronics'],
  Restaurants: ['Barbeque Nation', 'Absolute Barbecues', 'Bikanervala', 'Paradise Biryani', 'Chutneys', 'Saravana Bhavan', 'Copper Chimney', 'Mainland China', 'The Social', 'Cafe Coffee Day'],
  Healthcare: ['Apollo Clinic', 'Care Hospital', 'Fortis Healthcare', 'Max Health', 'Aster Clinic', 'Dr. Batra\'s', 'Thyrocare', 'Lal Pathlabs', 'Medall Clinic', 'Local Diagnostic'],
};

async function main() {
  console.log('Seeding database...');

  // 1. Create a Default Admin and Client user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const adminCompany = await prisma.company.create({
    data: { name: 'InsightForge Admin Corp' }
  });

  const clientCompany = await prisma.company.create({
    data: { name: 'D-Mart Retail Labs' }
  });

  // Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@insightforge.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@insightforge.com',
      password: hashedPassword,
      company_name: 'InsightForge Corp',
      industry: 'SaaS',
      role: UserRole.ADMIN,
      companyRole: CompanyRole.OWNER,
      credits: 9999,
      company_id: adminCompany.id,
    },
  });

  // Client User
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@insightforge.com' },
    update: {},
    create: {
      name: 'Rohan Sharma',
      email: 'client@insightforge.com',
      password: hashedPassword,
      company_name: 'D-Mart Retail Labs',
      industry: 'Retail',
      role: UserRole.CLIENT,
      companyRole: CompanyRole.OWNER,
      credits: 10,
      company_id: clientCompany.id,
    },
  });

  // Create additional Analyst in Client User's Company
  await prisma.user.upsert({
    where: { email: 'analyst@insightforge.com' },
    update: {},
    create: {
      name: 'Sneha Patel',
      email: 'analyst@insightforge.com',
      password: hashedPassword,
      company_name: 'D-Mart Retail Labs',
      industry: 'Retail',
      role: UserRole.CLIENT,
      companyRole: CompanyRole.ANALYST,
      credits: 0, // Shares company report library
      company_id: clientCompany.id,
    },
  });

  console.log('Users and companies seeded successfully.');

  // 2. Clear old Demographics and Competitors
  await prisma.demographic.deleteMany({});
  await prisma.competitor.deleteMany({});

  const incomeLevels = ['Low', 'Middle', 'Upper Middle', 'High'];

  let competitorCount = 0;
  let demographicCount = 0;

  // 3. Loop through cities and localities
  for (const city of Object.keys(LOCALITIES)) {
    const center = CITY_COORDS[city];
    const localities = LOCALITIES[city];

    for (let i = 0; i < localities.length; i++) {
      const locality = localities[i];

      // Generate a slight offset for each locality's lat/lng
      const offsetLat = (Math.random() - 0.5) * 0.12;
      const offsetLng = (Math.random() - 0.5) * 0.12;
      const locLat = center.lat + offsetLat;
      const locLng = center.lng + offsetLng;

      // Random demographic variables
      const population = Math.floor(Math.random() * 450000) + 50000;
      const density = Math.floor(Math.random() * 15000) + 1200;
      const income_level = incomeLevels[Math.floor(Math.random() * incomeLevels.length)];
      const male_percentage = 48 + Math.random() * 4;
      const female_percentage = 100 - male_percentage;

      // Age distribution
      const age_18_25 = 15 + Math.random() * 10;
      const age_26_40 = 30 + Math.random() * 10;
      const age_41_60 = 25 + Math.random() * 10;
      const age_60_plus = 100 - (age_18_25 + age_26_40 + age_41_60);

      // Create demographic row
      await prisma.demographic.create({
        data: {
          city,
          locality,
          population,
          income_level,
          density,
          male_percentage: Number(male_percentage.toFixed(2)),
          female_percentage: Number(female_percentage.toFixed(2)),
          age_18_25: Number(age_18_25.toFixed(2)),
          age_26_40: Number(age_26_40.toFixed(2)),
          age_41_60: Number(age_41_60.toFixed(2)),
          age_60_plus: Number(age_60_plus.toFixed(2)),
        },
      });
      demographicCount++;

      // Create 10-15 competitors for this locality
      const numCompetitors = Math.floor(Math.random() * 6) + 10; // 10 to 15
      for (let j = 0; j < numCompetitors; j++) {
        const category = Object.keys(COMPETITOR_NAMES)[Math.floor(Math.random() * 6)];
        const names = COMPETITOR_NAMES[category];
        const baseName = names[Math.floor(Math.random() * names.length)];
        
        // Competitor specific coordinates, offset slightly from locality center
        const compOffsetLat = (Math.random() - 0.5) * 0.02;
        const compOffsetLng = (Math.random() - 0.5) * 0.02;
        const lat = locLat + compOffsetLat;
        const lng = locLng + compOffsetLng;

        const rating = Number((3.5 + Math.random() * 1.5).toFixed(1)); // 3.5 to 5.0

        await prisma.competitor.create({
          data: {
            name: `${baseName} - ${locality}`,
            category,
            latitude: lat,
            longitude: lng,
            rating,
            city,
            locality,
          },
        });
        competitorCount++;
      }
    }
  }

  console.log(`Seeded ${demographicCount} demographic records and ${competitorCount} competitor records.`);
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
