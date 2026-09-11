import { Logger } from '@nestjs/common';
import { AuditRetentionService } from './audit-retention.service';

describe('AuditRetentionService', () => {
  const prisma = { auditLog: { deleteMany: jest.fn() } };
  let service: AuditRetentionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.auditLog.deleteMany.mockResolvedValue({ count: 3 });
    service = new AuditRetentionService(prisma as never);
  });

  it('deletes only records whose retention deadline elapsed', async () => {
    await expect(service.prune()).resolves.toBe(3);

    const calls = prisma.auditLog.deleteMany.mock.calls as unknown as Array<
      [{ where: { expiresAt: { lte: Date } } }]
    >;
    expect(calls).toHaveLength(1);
    expect(calls[0][0].where.expiresAt.lte).toBeInstanceOf(Date);
  });

  it('contains maintenance failures', async () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    prisma.auditLog.deleteMany.mockRejectedValue(new Error('unavailable'));

    await expect(service.prune()).resolves.toBe(0);
    expect(logError).toHaveBeenCalledWith(
      'Failed to prune expired audit records',
    );
    logError.mockRestore();
  });
});
