import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import { AuthenticatedRequest } from "./jwt-auth.guard";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
