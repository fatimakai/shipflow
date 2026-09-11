import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import {
  InvitationStatus,
  MembershipRole,
  SessionRevocationReason,
} from '../src/generated/prisma/enums';

describe('Database schema (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
    prisma = app.get(PrismaService);
  });

  it('enforces the identity and tenancy invariants', async () => {
    const marker = randomUUID();
    const ownerEmail = `owner-${marker}@example.test`;
    const memberEmail = `member-${marker}@example.test`;
    const inviteEmail = `invite-${marker}@example.test`;

    const owner = await prisma.user.create({ data: { email: ownerEmail } });
    const member = await prisma.user.create({ data: { email: memberEmail } });

    try {
      expect(owner.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      await expect(
        prisma.user.create({
          data: { email: `UPPER-${marker}@example.test` },
        }),
      ).rejects.toThrow();

      const organization = await prisma.organization.create({
        data: {
          name: 'Schema Contract Organization',
          slug: `schema-contract-${marker}`,
          ownerId: owner.id,
        },
      });

      await prisma.membership.create({
        data: {
          organizationId: organization.id,
          userId: owner.id,
          role: MembershipRole.OWNER,
        },
      });

      await expect(
        prisma.membership.create({
          data: {
            organizationId: organization.id,
            userId: member.id,
            role: MembershipRole.OWNER,
          },
        }),
      ).rejects.toThrow();

      const invitation = {
        organizationId: organization.id,
        invitedById: owner.id,
        email: inviteEmail,
        role: MembershipRole.MEMBER,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      await prisma.invitation.create({
        data: { ...invitation, tokenHash: randomUUID() },
      });

      await expect(
        prisma.invitation.create({
          data: { ...invitation, tokenHash: randomUUID() },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.invitation.create({
          data: {
            ...invitation,
            email: `owner-role-${marker}@example.test`,
            role: MembershipRole.OWNER,
            tokenHash: randomUUID(),
          },
        }),
      ).rejects.toThrow();

      const acceptedInvitation = await prisma.invitation.create({
        data: {
          ...invitation,
          email: `accepted-${marker}@example.test`,
          status: InvitationStatus.ACCEPTED,
          acceptedById: member.id,
          acceptedAt: new Date(),
          tokenHash: randomUUID(),
        },
      });

      await prisma.user.delete({ where: { id: member.id } });

      await expect(
        prisma.invitation.findUniqueOrThrow({
          where: { id: acceptedInvitation.id },
          select: { status: true, acceptedById: true },
        }),
      ).resolves.toEqual({
        status: InvitationStatus.ACCEPTED,
        acceptedById: null,
      });

      const replacementSession = await prisma.session.create({
        data: {
          userId: owner.id,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      const rotatedSession = await prisma.session.create({
        data: {
          userId: owner.id,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revokedAt: new Date(),
          revocationReason: SessionRevocationReason.ROTATED,
          replacedById: replacementSession.id,
        },
      });

      await prisma.session.delete({ where: { id: replacementSession.id } });

      await expect(
        prisma.session.findUniqueOrThrow({
          where: { id: rotatedSession.id },
          select: { revocationReason: true, replacedById: true },
        }),
      ).resolves.toEqual({
        revocationReason: SessionRevocationReason.ROTATED,
        replacedById: null,
      });
    } finally {
      await prisma.organization.deleteMany({
        where: { slug: `schema-contract-${marker}` },
      });
      await prisma.user.deleteMany({
        where: { email: { in: [ownerEmail, memberEmail] } },
      });
    }
  });

  it('enforces encrypted 2FA credential and single-use backup-code invariants', async () => {
    const marker = randomUUID();
    const email = `two-factor-${marker}@example.test`;
    const user = await prisma.user.create({ data: { email } });
    const credential = await prisma.twoFactorCredential.create({
      data: {
        userId: user.id,
        encryptedSecret: Buffer.from('encrypted-secret'),
        initializationVector: Buffer.alloc(12, 1),
        authenticationTag: Buffer.alloc(16, 2),
        encryptionKeyVersion: 1,
      },
    });
    const codeHash = Buffer.from(`backup-${marker}`)
      .toString('hex')
      .slice(0, 64);

    try {
      await prisma.twoFactorBackupCode.create({
        data: { credentialId: credential.id, codeHash },
      });

      await expect(
        prisma.twoFactorCredential.create({
          data: {
            userId: user.id,
            encryptedSecret: Buffer.from('another-secret'),
            initializationVector: Buffer.alloc(12, 3),
            authenticationTag: Buffer.alloc(16, 4),
            encryptionKeyVersion: 1,
          },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.twoFactorBackupCode.create({
          data: { credentialId: credential.id, codeHash },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.twoFactorBackupCode.updateMany({
          where: { codeHash, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
      ).resolves.toMatchObject({ count: 1 });
      await expect(
        prisma.twoFactorBackupCode.updateMany({
          where: { codeHash, consumedAt: null },
          data: { consumedAt: new Date() },
        }),
      ).resolves.toMatchObject({ count: 0 });

      await prisma.user.delete({ where: { id: user.id } });

      await expect(
        prisma.twoFactorCredential.count({ where: { id: credential.id } }),
      ).resolves.toBe(0);
      await expect(
        prisma.twoFactorBackupCode.count({
          where: { credentialId: credential.id },
        }),
      ).resolves.toBe(0);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  afterAll(async () => {
    await app.close();
  });
});
