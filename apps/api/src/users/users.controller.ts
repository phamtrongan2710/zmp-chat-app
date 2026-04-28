import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { UsersService } from "./users.service";

type CurrentUserPayload = { id: string; sessionId: string };

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("search")
  async search(@Query("q") query: string | undefined, @CurrentUser() user: CurrentUserPayload) {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException("q is required");
    }
    return this.usersService.search(query, user.id);
  }
}
