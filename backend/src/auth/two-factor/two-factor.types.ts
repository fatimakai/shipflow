export interface EncryptedTwoFactorSecret {
  encryptedSecret: Buffer;
  initializationVector: Buffer;
  authenticationTag: Buffer;
  encryptionKeyVersion: number;
}

export type TotpVerificationResult =
  { valid: false } | { valid: true; timeStep: number };

export interface GeneratedBackupCodes {
  plaintextCodes: string[];
  codeHashes: string[];
}
