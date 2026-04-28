import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ChatModule } from "./chat/chat.module";
import { CryptoModule } from "./crypto/crypto.module";
import { DatabaseModule } from "./database/database.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, CryptoModule, ChatModule],
})
export class AppModule {}
