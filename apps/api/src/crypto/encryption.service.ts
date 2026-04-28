import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const raw = configService.get<string>("APP_ENCRYPTION_KEY");
    if (!raw) {
      throw new Error("APP_ENCRYPTION_KEY is required");
    }

    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== KEY_LENGTH) {
      throw new Error(`APP_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${decoded.length})`);
    }

    this.key = decoded;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  }

  decrypt(payload: string): string {
    const buffer = Buffer.from(payload, "base64");
    const iv = buffer.subarray(0, IV_LENGTH);
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = buffer.subarray(IV_LENGTH + 16);

    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
}
