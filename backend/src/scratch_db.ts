import prisma from './db';

async function main() {
  const reports = await prisma.report.findMany({
    select: {
      id: true,
      location_name: true,
      status: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { id: 'desc' }
  });
  console.log('--- Database Reports ---');
  console.log(JSON.stringify(reports, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
