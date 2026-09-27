import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthError, signToken, verifyToken } from './token';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async guest(username: string) {
    const user = await this.prisma.user.upsert({
      where: { username },
      update: {},
      create: { username },
    });
    const signed = signToken(user.id, this.secret());
    return {
      token: signed.token,
      expiresAt: signed.expiresAt,
      user: { id: user.id, username: user.username },
    };
  }

  verify(token: string) {
    try {
      return verifyToken(token, this.secret());
    } catch (error) {
      if (error instanceof AuthError) throw new UnauthorizedException('Invalid token');
      throw error;
    }
  }

  private secret() {
    return this.config.getOrThrow<string>('APP_SECRET');
  }
}
