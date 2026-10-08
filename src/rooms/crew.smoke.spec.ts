import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../main';

describe('crew flow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('creates a crew, shares presence, and keeps secrets on the server', async () => {
    const stamp = Date.now().toString(36);
    const server = app.getHttpServer();
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    await request(server).get('/health').expect(200);
    await request(server).get('/rooms/ABCDEF').expect(401);
    await request(server).post('/auth/guest').send({ username: 'no' }).expect(400);

    const host = await request(server).post('/auth/guest').send({ username: `host_${stamp}` }).expect(200);
    const mate = await request(server).post('/auth/guest').send({ username: `mate_${stamp}` }).expect(200);

    const created = await request(server)
      .post('/rooms')
      .set(auth(host.body.token))
      .send({ name: 'Smoke Crew' })
      .expect(201);

    expect(created.body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(JSON.stringify(created.body)).not.toContain('answerHash');
    const code = created.body.code as string;

    await request(server).post('/rooms/join').set(auth(mate.body.token)).send({ code }).expect(200);

    const together = await request(server).get(`/rooms/${code}`).set(auth(host.body.token)).expect(200);
    expect(together.body.players).toHaveLength(2);

    await request(server)
      .post(`/rooms/${code}/presence`)
      .set(auth(host.body.token))
      .send({ online: false })
      .expect(200);

    const quiet = await request(server).get(`/rooms/${code}`).set(auth(host.body.token)).expect(200);
    const hostPlayer = quiet.body.players.find((player: { userId: string }) => player.userId === host.body.user.id);
    expect(hostPlayer.isOnline).toBe(false);

    await request(server).post(`/rooms/${code}/ready`).set(auth(host.body.token)).send({ ready: true }).expect(200);
    await request(server).post(`/rooms/${code}/ready`).set(auth(mate.body.token)).send({ ready: true }).expect(200);
    await request(server).post(`/rooms/${code}/voyage/start`).set(auth(host.body.token)).expect(200);
    await new Promise((r) => setTimeout(r, 3_500));

    const island = together.body.islands.find((i: { key: string }) => i.key === 'port-royal') as
      | { key: string; puzzles: { key: string }[] }
      | undefined;
    if (!island) return;

    const moved = await request(server)
      .post(`/rooms/${code}/move`)
      .set(auth(host.body.token))
      .send({ islandKey: island.key })
      .expect(200);
    expect(moved.body.status).toBe('ACTIVE');
    expect(moved.body.phase).toBe('voyage');

    const puzzleKey = island.puzzles[0]?.key;
    if (!puzzleKey) return;

    const failed = await request(server)
      .post(`/rooms/${code}/answer`)
      .set(auth(host.body.token))
      .send({ puzzleKey, answer: 'definitely-wrong' })
      .expect(200);
    const types = (failed.body.log as { type: string }[]).map((event) => event.type);
    expect(types).toEqual(expect.arrayContaining([expect.stringMatching(/PUZZLE_FAILED|TRAP_TRIGGERED/)]));
    expect(JSON.stringify(failed.body)).not.toContain('answerHash');

    await request(server).post(`/rooms/${code}/leave`).set(auth(mate.body.token)).expect(200);
    const left = await request(server).get(`/rooms/${code}`).set(auth(host.body.token)).expect(200);
    expect(left.body.players).toHaveLength(1);
  });
});
