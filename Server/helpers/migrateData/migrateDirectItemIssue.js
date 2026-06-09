const prisma = require("../../config/prismaClient")
async function run() {

  const result = await prisma.$executeRawUnsafe(`
    UPDATE DirectItemIssue
    SET materialIssued = rawMaterialIssued
    WHERE rawMaterialIssued IS NOT NULL;
  `);

  console.log("Rows updated:", result);
  console.log("Migration completed");
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());