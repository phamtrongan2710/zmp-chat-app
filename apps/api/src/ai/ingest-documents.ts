import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { AiService } from "./ai.service";
import { RagService } from "./rag.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const aiService = app.get(AiService);
    const ragService = app.get(RagService);
    await aiService.ensureBotUser();
    await ragService.ensureDocumentEmbedded();
  } finally {
    await app.close();
  }
}

void main();
