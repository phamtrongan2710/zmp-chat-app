import { IsString, MinLength } from "class-validator";

export class ZmpLoginDto {
  @IsString()
  @MinLength(1)
  accessToken!: string;
}
