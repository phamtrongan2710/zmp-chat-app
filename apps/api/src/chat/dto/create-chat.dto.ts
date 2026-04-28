import { IsString, MinLength } from "class-validator";

export class CreateChatDto {
  @IsString()
  @MinLength(1)
  peerUserId!: string;
}
