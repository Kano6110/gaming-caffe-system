import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" already exists — skipping.`);
    return;
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: { username, passwordHash, role: "ADMIN" },
  });

  console.log(`Created admin user "${admin.username}" (id: ${admin.id})`);
  console.log(`Login with username="${username}" password="${password}"`);
  console.log("⚠️  Change this password immediately after first login.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });