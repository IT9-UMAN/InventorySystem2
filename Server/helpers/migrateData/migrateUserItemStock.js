const prisma = require("../../config/prismaClient");

async function run() {
  const rows = await prisma.userItemStock.findMany({
    where: {
      rawMaterialId: {
        not: null,
      },
    },
  });

  console.log("Rows to migrate: ", rows.length);

  for (const row of rows) {
    await prisma.userItemStock.update({
        where: {
            id: row.id
        },
        data: {
            itemId: row.rawMaterialId,
            itemType: "RAW"
        }
    });
  }
  console.log("Migration Completed");
}

run();
