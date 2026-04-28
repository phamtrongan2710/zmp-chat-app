import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { ChatModule } from "./chat/chat.module";
import { CryptoModule } from "./crypto/crypto.module";
import { DatabaseModule } from "./database/database.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, CryptoModule, AuthModule, ChatModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
