const prisma = require("../../config/prismaClient");

// async function run() {
//     const rows = await prisma.warehouseStock.findMany({
//         where: {
//             rawMaterialId: {
//                 not: null
//             }
//         }
//     });

//     console.log("Rows to migrate: ", rows.length);

//     for(const row of rows) {
//         await prisma.warehouseStock.update({
//             where: {
//                 id: row.id
//             },
//             data: {
//                 itemId: row.rawMaterialId,
//                 itemType: "RAW"    
//             }
//         });
//     }
//     console.log("Migration Completed");
// }

// run();

async function run() {

  const result = await prisma.$executeRawUnsafe(`
    UPDATE WarehouseStock
    SET itemId = rawMaterialId,
        itemType = 'RAW'
    WHERE rawMaterialId IS NOT NULL;
  `);

  console.log("Rows updated:", result);
  console.log("Migration completed");
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());