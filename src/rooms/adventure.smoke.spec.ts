import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { configureApp } from '../main';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('adventure flow', () => {
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

  it('runs lobby start, map rules, explore, trade, trap, vault gate, and win', async () => {
    const stamp = Date.now().toString(36);
    const server = app.getHttpServer();
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    const host = await request(server).post('/auth/guest').send({ username: `adv_host_${stamp}` }).expect(200);
    const mate = await request(server).post('/auth/guest').send({ username: `adv_mate_${stamp}` }).expect(200);

    const created = await request(server)
      .post('/rooms')
      .set(auth(host.body.token))
      .send({ name: 'Adventure Smoke' })
      .expect(201);
    const code = created.body.code as string;

    await request(server).post('/rooms/join').set(auth(mate.body.token)).send({ code }).expect(200);

    await request(server).post(`/rooms/${code}/ready`).set(auth(host.body.token)).send({ ready: true }).expect(200);
    await request(server).post(`/rooms/${code}/ready`).set(auth(mate.body.token)).send({ ready: true }).expect(200);
    await request(server).post(`/rooms/${code}/voyage/start`).set(auth(host.body.token)).expect(200);
    await sleep(3_500);

    await request(server)
      .post(`/rooms/${code}/move`)
      .set(auth(host.body.token))
      .send({ islandKey: 'the-vault' })
      .expect(400);

    const solve = (token: string, puzzleKey: string, answer: string) =>
      request(server).post(`/rooms/${code}/answer`).set(auth(token)).send({ puzzleKey, answer });

    const move = (token: string, islandKey: string) =>
      request(server).post(`/rooms/${code}/move`).set(auth(token)).send({ islandKey });

    await solve(host.body.token, 'port-royal-map', 'map').expect(200);
    await move(host.body.token, 'blackreef').expect(200);
    await request(server)
      .post(`/rooms/${code}/explore`)
      .set(auth(host.body.token))
      .send({ islandKey: 'blackreef' })
      .expect(200);
    await solve(host.body.token, 'blackreef-cipher', 'treasure').expect(200);
    await solve(host.body.token, 'vault-protocol', 'pirate protocol').expect(400);

    const roster = await request(server).get(`/rooms/${code}`).set(auth(host.body.token)).expect(200);
    expect(roster.body.discoveredIslandKeys).toEqual(expect.arrayContaining(['port-royal', 'blackreef']));
    expect(roster.body.scores?.length).toBeGreaterThan(0);

    const matePlayer = roster.body.players.find((p: { userId: string }) => p.userId === mate.body.user.id);
    expect(matePlayer?.id).toBeDefined();
    await request(server)
      .post(`/rooms/${code}/trade`)
      .set(auth(host.body.token))
      .send({ toPlayerId: matePlayer.id, itemKey: 'compass' })
      .expect(200);
    await request(server)
      .post(`/rooms/${code}/trade`)
      .set(auth(mate.body.token))
      .send({ toPlayerId: roster.body.players.find((p: { userId: string }) => p.userId === host.body.user.id).id, itemKey: 'compass' })
      .expect(200);

    await move(host.body.token, 'deadmans-shelf').expect(200);
    await solve(host.body.token, 'deadman-plaque', 'open').expect(200);
    await solve(host.body.token, 'deadman-plaque', 'leave').expect(200);

    await move(host.body.token, 'blackreef').expect(200);
    await move(host.body.token, 'port-royal').expect(200);
    await move(host.body.token, 'serpent-cay').expect(200);
    await solve(host.body.token, 'serpent-anagram', 'serpent').expect(200);

    await move(host.body.token, 'port-royal').expect(200);
    await move(host.body.token, 'blackreef').expect(200);
    await move(host.body.token, 'widows-rock').expect(200);
    await solve(host.body.token, 'widow-riddle', 'silence').expect(200);
    await move(host.body.token, 'goldmouth').expect(200);
    await solve(host.body.token, 'goldmouth-tides', 'four').expect(200);

    await move(host.body.token, 'the-vault').expect(200);
    await solve(host.body.token, 'vault-protocol', 'pirate protocol').expect(200);

    const won = await request(server).get(`/rooms/${code}`).set(auth(host.body.token)).expect(200);
    expect(won.body.status).toBe('FINISHED');
    expect(won.body.phase).toBe('finished');
    expect(won.body.winnerPlayerId).toBeTruthy();
    expect(JSON.stringify(won.body)).not.toContain('answerHash');
  }, 120_000);
});
