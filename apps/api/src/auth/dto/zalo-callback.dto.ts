import { IsString, MinLength } from "class-validator";

export class ZaloCallbackDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  state!: string;

  @IsString()
  @MinLength(43)
  codeVerifier!: string;
}
