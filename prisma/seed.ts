import { PrismaClient, ProductCategory, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const ownerPassword = await bcrypt.hash("owner123", 10);
  const cashierPassword = await bcrypt.hash("kasir123", 10);

  await prisma.user.upsert({
    where: { username: "owner" },
    update: {},
    create: {
      name: "Owner Laundry",
      username: "owner",
      passwordHash: ownerPassword,
      role: Role.OWNER,
    },
  });

  await prisma.user.upsert({
    where: { username: "kasir" },
    update: {},
    create: {
      name: "Kasir 1",
      username: "kasir",
      passwordHash: cashierPassword,
      role: Role.CASHIER,
    },
  });

  const defaultServices = [
    {
      name: "Cuci - Reguler",
      price: 10000,
      washerCount: 1,
      dryerCount: 0,
      maxWeightKg: 8,
    },
    {
      name: "Cuci & Dryer - Reguler",
      price: 20000,
      washerCount: 1,
      dryerCount: 1,
      maxWeightKg: 8,
    },
    {
      name: "Dryer - Reguler",
      price: 15000,
      washerCount: 0,
      dryerCount: 1,
      maxWeightKg: 8,
    },
    {
      name: "Cuci & Dryer - Sprei",
      price: 25000,
      washerCount: 1,
      dryerCount: 1,
      maxWeightKg: null,
    },
    {
      name: "Cuci & Dryer - Selimut Besar",
      price: 30000,
      washerCount: 1,
      dryerCount: 1,
      maxWeightKg: null,
    },
    {
      name: "Cuci + Kering - Selimut Kecil",
      price: 20000,
      washerCount: 1,
      dryerCount: 1,
      maxWeightKg: null,
    }
  ];

  for (const s of defaultServices) {
    const existing = await prisma.service.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.service.create({ data: s });
    }
  }

  const existingProducts = await prisma.product.count();
  if (existingProducts === 0) {
    await prisma.product.createMany({
      data: [
        {
          name: "Soklin Liquid 1K",
          category: ProductCategory.DETERGENT,
          price: 1000,
          currentStock: 24,
          minStockAlert: 10,
          packName: "Renceng",
          packQty: 12,
        },
        {
          name: "Downy 1K",
          category: ProductCategory.SOFTENER,
          price: 1000,
          currentStock: 24,
          minStockAlert: 10,
          packName: "Renceng",
          packQty: 12,
        },
        {
          name: "Royal 1K",
          category: ProductCategory.PERFUME,
          price: 1000,
          currentStock: 24,
          minStockAlert: 10,
          packName: "Renceng",
          packQty: 12,
        },
      ],
    });
  }

  console.log("Seed selesai! Akun: owner/owner123 & kasir/kasir123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });