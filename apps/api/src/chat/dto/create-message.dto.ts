import { IsISO8601, IsString, MinLength } from "class-validator";

export class CreateMessageDto {
  @IsString()
  id!: string;

  @IsString()
  chatId!: string;

  @IsString()
  senderId!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsISO8601()
  createdAt!: string;

  @IsString()
  status!: "sent" | "delivered";
}
