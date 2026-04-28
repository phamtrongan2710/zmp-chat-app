import { IsBoolean, IsString } from "class-validator";

export class TypingStateDto {
  @IsString()
  chatId!: string;

  @IsString()
  userId!: string;

  @IsBoolean()
  isTyping!: boolean;
}
