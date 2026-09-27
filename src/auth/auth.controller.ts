import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GuestDto } from './dto/guest.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('guest')
  @HttpCode(200)
  guest(@Body() dto: GuestDto) {
    return this.auth.guest(dto.username);
  }
}
