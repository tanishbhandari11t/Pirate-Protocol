import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export async function parseDto<T extends object>(cls: new () => T, plain: unknown): Promise<T> {
  if (plain === null || typeof plain !== 'object' || Array.isArray(plain)) {
    throw new BadRequestException('Invalid payload');
  }
  const dto = plainToInstance(cls, plain);
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new BadRequestException(messages.length ? messages : 'Invalid payload');
  }
  return dto;
}
