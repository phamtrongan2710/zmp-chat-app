import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const httpsEnabled = process.env.HTTPS_ENABLED !== "false";
  const httpsPfxPath = resolve(process.cwd(), process.env.HTTPS_PFX_PATH ?? "../../certs/localhost-dev.pfx");
  const httpsPassphrase = process.env.HTTPS_PASSPHRASE ?? "zmp-local-dev";

  const app = await NestFactory.create(AppModule, {
    cors: true,
    ...(httpsEnabled
      ? {
          httpsOptions: {
            pfx: readRequiredFile(httpsPfxPath),
            passphrase: httpsPassphrase,
          },
        }
      : {}),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();

function readRequiredFile(filePath: string): Buffer {
  if (!existsSync(filePath)) {
    throw new Error(
      `HTTPS certificate file not found at ${filePath}. Run scripts/create-dev-cert.ps1 first or disable HTTPS.`,
    );
  }

  return readFileSync(filePath);
}
