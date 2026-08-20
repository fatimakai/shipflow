import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes passwords with Argon2id and verifies valid input', async () => {
    const hash = await service.hash('correct horse battery staple');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(
      service.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong password')).resolves.toBe(false);
  });

  it('rejects malformed password hashes safely', async () => {
    await expect(
      service.verify('not-an-argon2-hash', 'password'),
    ).resolves.toBe(false);
  });
});
