import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { MembershipRole, UserStatus } from '../src/generated/prisma/enums';
import { PrismaClient } from '../src/generated/prisma/client';

const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
const schema = databaseUrl.searchParams.get('schema') ?? 'public';
databaseUrl.searchParams.delete('schema');

const adapter = new PrismaPg(
  { connectionString: databaseUrl.toString() },
  { schema },
);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed data cannot run in production.');
  }

  const owner = await prisma.user.upsert({
    where: { email: 'owner@shipflow.local' },
    update: {
      displayName: 'ShipFlow Owner',
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      email: 'owner@shipflow.local',
      displayName: 'ShipFlow Owner',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@shipflow.local' },
    update: {
      displayName: 'ShipFlow Member',
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    create: {
      email: 'member@shipflow.local',
      displayName: 'ShipFlow Member',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'shipflow-demo' },
    update: {
      name: 'ShipFlow Demo',
      ownerId: owner.id,
      deletedAt: null,
    },
    create: {
      name: 'ShipFlow Demo',
      slug: 'shipflow-demo',
      ownerId: owner.id,
    },
  });

  await prisma.$transaction([
    prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: owner.id,
        },
      },
      update: { role: MembershipRole.OWNER },
      create: {
        organizationId: organization.id,
        userId: owner.id,
        role: MembershipRole.OWNER,
      },
    }),
    prisma.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: member.id,
        },
      },
      update: { role: MembershipRole.MEMBER },
      create: {
        organizationId: organization.id,
        userId: member.id,
        role: MembershipRole.MEMBER,
      },
    }),
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
