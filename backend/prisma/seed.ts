import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed default notification patterns for whitelisted apps
  const patterns = [
    {
      appName: 'Mercado Pago',
      regexPattern: 'Pago de \\$([\\d.,]+) a (.+)',
      version: 1,
      fieldsExtracted: JSON.stringify(['amount', 'merchant']),
    },
    {
      appName: 'MODO',
      regexPattern: 'Pagaste \\$([\\d.,]+) en (.+)',
      version: 1,
      fieldsExtracted: JSON.stringify(['amount', 'merchant']),
    },
    {
      appName: 'Google Wallet',
      regexPattern: 'You paid \\$([\\d.,]+) to (.+)',
      version: 1,
      fieldsExtracted: JSON.stringify(['amount', 'merchant']),
    },
    {
      appName: 'Santander',
      regexPattern: 'Compra por \\$([\\d.,]+) en (.+)',
      version: 1,
      fieldsExtracted: JSON.stringify(['amount', 'merchant']),
    },
    {
      appName: 'Galicia',
      regexPattern: 'Pago \\$([\\d.,]+) - (.+)',
      version: 1,
      fieldsExtracted: JSON.stringify(['amount', 'merchant']),
    },
  ];

  for (const pattern of patterns) {
    await prisma.notificationPattern.upsert({
      where: { version: pattern.version },
      update: pattern,
      create: pattern,
    });
  }

  // Seed exchange rates (initial mock data)
  const rates = [
    { baseCurrency: 'ARS', targetCurrency: 'USD', rate: 0.00117, fetchedAt: new Date() },
    { baseCurrency: 'ARS', targetCurrency: 'EUR', rate: 0.00108, fetchedAt: new Date() },
    { baseCurrency: 'USD', targetCurrency: 'ARS', rate: 854.7, fetchedAt: new Date() },
    { baseCurrency: 'USD', targetCurrency: 'EUR', rate: 0.923, fetchedAt: new Date() },
    { baseCurrency: 'EUR', targetCurrency: 'ARS', rate: 925.9, fetchedAt: new Date() },
    { baseCurrency: 'EUR', targetCurrency: 'USD', rate: 1.083, fetchedAt: new Date() },
  ];

  for (const rate of rates) {
    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency: rate.baseCurrency,
          targetCurrency: rate.targetCurrency,
        },
      },
      update: { rate: rate.rate, fetchedAt: rate.fetchedAt },
      create: rate,
    });
  }

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });