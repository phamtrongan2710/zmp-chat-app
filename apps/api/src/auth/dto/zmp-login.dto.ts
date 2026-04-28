import { IsOptional, IsString, MinLength } from "class-validator";

export class ZmpLoginDto {
  @IsString()
  @MinLength(1)
  zaloId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  avatar?: string | null;
}
