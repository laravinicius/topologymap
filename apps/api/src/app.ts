import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import type pg from 'pg';
import type { AuthSession, AuthUser, LoginInput } from '@topologia-new/domain';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthConfig } from './auth/config.js';
import { hashPassword, normalizeLogin, validLogin, verifyPassword } from './auth/password.js';
import { HttpError, registerAuthorization } from './auth/authorization.js';
import { registerAdministration } from './admin/routes.js';
import { registerPark } from './park/routes.js';
import { registerDesks } from './desks/routes.js';
import { registerRacks } from './racks/routes.js';
import { registerConnections } from './connections/routes.js';
import { registerLayout } from './layout/routes.js';
import { registerFiles } from './files/routes.js';

declare module 'fastify' {
  interface FastifyRequest { session: AuthSession | null }
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
let dummyHash: Promise<string> | undefined;

export async function buildApp(pool: pg.Pool, config: AuthConfig, logger = false, filesDirectory?: string) {
  const app = Fastify({
    logger: logger ? { redact: ['req.headers.cookie', 'req.headers.authorization', 'req.body.password', 'res.headers.set-cookie'] } : false,
    bodyLimit: 4096,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
    // Não confiar em X-Forwarded-For enviado pelo cliente/proxy de desenvolvimento.
    trustProxy: false,
  });
  await app.register(cookie);
  app.decorateRequest('session', null);
  const cookieName = config.production ? '__Host-topologia_session' : 'topologia_session';
  const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'strict' as const, path: '/' };
  const dummy = await (dummyHash ??= hashPassword(randomBytes(32).toString('hex')));
  let hashing = 0;

  async function consumeLimit(key: string, maximum: number): Promise<{ allowed: boolean; retry: number }> {
    const result = await pool.query(`INSERT INTO login_limits(key,attempts,resets_at)
      VALUES ($1,1,clock_timestamp()+interval '15 minutes')
      ON CONFLICT (key) DO UPDATE SET
        attempts=CASE WHEN login_limits.resets_at<=clock_timestamp() THEN 1 ELSE least(login_limits.attempts+1,$2+1) END,
        resets_at=CASE WHEN login_limits.resets_at<=clock_timestamp() THEN clock_timestamp()+interval '15 minutes' ELSE login_limits.resets_at END
      RETURNING attempts<=$2 AS allowed, greatest(1,ceil(extract(epoch FROM resets_at-clock_timestamp())))::int AS retry`, [key, maximum]);
    return result.rows[0];
  }

  app.setErrorHandler<FastifyError>((error, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ message: error.message });
    if (error.validation && _request.routeOptions.url?.includes('/racks')) {
      const issue = error.validation[0];
      const field = issue?.instancePath?.slice(1) || (issue?.params as { missingProperty?: string })?.missingProperty;
      const message = field === 'capacityU' || field === 'startU' || field === 'heightU'
        ? `${field === 'capacityU' ? 'Capacidade' : field === 'startU' ? 'U inicial' : 'Altura'} deve ser um inteiro entre 1 e 1000 U.`
        : field === 'portCount' ? 'Quantidade de portas deve ser um inteiro entre 1 e 512, somente para patch panels.'
          : field === 'name' || field === 'equipmentType' ? 'Nome e tipo devem conter de 1 a 200 caracteres, com pelo menos um caractere diferente de espaço.'
            : 'Confira os campos e IDs. Para alterar portas, informe a quantidade e a lista atual de IDs. Tipo de cadastro, identificadores e filiação não são editáveis.';
      return reply.code(400).send({ message });
    }
    if (error.validation && _request.routeOptions.url?.includes('/desks')) {
      const issue = error.validation[0];
      const field = issue?.instancePath ?? '';
      const missing = issue?.params as { missingProperty?: string } | undefined;
      const message = field.startsWith('/pointCount') || missing?.missingProperty === 'pointCount'
        ? 'Quantidade de pontos deve ser um inteiro entre 0 e 512.'
        : field.startsWith('/name') || missing?.missingProperty === 'name'
          ? 'Nome deve conter de 1 a 200 caracteres e não pode ser vazio ou somente espaços.'
          : field.startsWith('/placement')
            ? 'Posição: X/Y entre -1000000 e 1000000 m; dimensões maiores que zero até 10000 m; rotação de 0 até menos de 360 graus.'
            : field.startsWith('/expectedPointIds') || missing?.missingProperty === 'expectedPointIds'
              ? 'Para alterar a quantidade, informe a lista atual de IDs dos pontos, sem duplicação.'
              : 'Confira os IDs e campos informados. Identificadores, filiação e ordem dos pontos não são editáveis.';
      return reply.code(400).send({ message });
    }
    if (error.validation && _request.routeOptions.url?.includes('/connections'))
      return reply.code(400).send({ message: 'Informe IDs UUID válidos. Transferir ou desvincular exige expected com pointId, portId e revision inteira positiva da conexão lida. Campos extras não são aceitos.' });
    if (error.validation || error.statusCode === 400) return reply.code(400).send({ message: 'Confira os campos informados e seus limites.' });
    const code = (error as FastifyError & { code?: string }).code;
    if (code === '23505') return reply.code(409).send({ message: 'Nome ou login já cadastrado.' });
    if (code === '23503' || code === '23001') return reply.code(409).send({ message: 'Referência inexistente ou cadastro com dependências.' });
    if (error.statusCode === 413 || error.statusCode === 415) return reply.code(error.statusCode).send({ message: 'Formato ou tamanho da requisição inválido.' });
    app.log.error({ requestId: _request.id }, 'Falha ao processar requisição.');
    return reply.code(503).send({ message: 'Serviço indisponível. Tente novamente.' });
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    const route = request.routeOptions.url;
    const safe = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (!safe && (!config.origins.includes(request.headers.origin ?? '') || request.headers['sec-fetch-site'] === 'cross-site')) {
      return reply.code(403).send({ message: 'Origem da requisição não permitida.' });
    }
    if (route === '/api/auth/login' && request.method === 'POST') {
      const limit = await consumeLimit(`ip:${digest(request.ip)}`, 20);
      if (!limit.allowed) return reply.header('Retry-After', limit.retry).code(429).send({ message: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
      return;
    }
    if ((route === '/api/health' && ['GET', 'HEAD'].includes(request.method)) || (route === '/api/auth/logout' && request.method === 'POST')) return;
    const token = request.cookies[cookieName];
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const result = await pool.query(`SELECT u.id,u.login,u.name,u.is_admin AS "isAdmin",s.expires_at
        FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND u.is_active`, [digest(token)]);
      if (result.rowCount) {
        const row = result.rows[0];
        request.session = { user: { id: row.id, login: row.login, name: row.name, isAdmin: row.isAdmin }, expiresAt: row.expires_at.toISOString() };
        return;
      }
    }
    reply.clearCookie(cookieName, cookieOptions);
    return reply.code(401).send({ message: 'Entre para acessar a aplicação.' });
  });

  app.get('/api/health', async (_request, reply) => {
    let database: 'up' | 'down' = 'up';
    try { await pool.query('SELECT 1'); } catch { database = 'down'; }
    return reply.code(database === 'up' ? 200 : 503).send({
      status: database === 'up' ? 'ok' : 'degraded', service: 'topologia_new', database, checkedAt: new Date().toISOString(),
    });
  });

  app.post<{ Body: LoginInput }>('/api/auth/login', {
    schema: { body: { type: 'object', required: ['login', 'password'], additionalProperties: false, properties: {
      login: { type: 'string', minLength: 1, maxLength: 100 }, password: { type: 'string', minLength: 1, maxLength: 128 },
    } } },
  }, async (request, reply) => {
    const login = normalizeLogin(request.body.login);
    if (!validLogin(login)) return reply.code(400).send({ message: 'Confira o login e a senha informados.' });
    const limit = await consumeLimit(`login:${digest(login)}`, 5);
    if (!limit.allowed) return reply.header('Retry-After', limit.retry).code(429).send({ message: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    if (hashing >= 2) return reply.header('Retry-After', 2).code(429).send({ message: 'Serviço ocupado. Tente novamente em instantes.' });
    hashing++;
    try {
      const result = await pool.query('SELECT id,login,name,is_admin AS "isAdmin",password_hash,is_active FROM users WHERE lower(login)=$1', [login]);
      const user = result.rows[0];
      // Conta inexistente/inativa faz o mesmo trabalho criptográfico e recebe a mesma mensagem.
      const valid = await verifyPassword(request.body.password, user?.is_active ? user.password_hash : dummy);
      if (!user?.is_active || !valid) return reply.code(401).send({ message: 'Login ou senha inválidos.' });
      const token = randomBytes(32).toString('hex');
      const client = await pool.connect();
      let expiresAt: Date;
      try {
        await client.query('BEGIN');
        // Revalidar atividade e hash sob lock antes de conceder a sessão.
        const active = await client.query('SELECT id FROM users WHERE id=$1 AND is_active AND password_hash=$2 FOR UPDATE', [user.id, user.password_hash]);
        if (!active.rowCount) {
          await client.query('ROLLBACK');
          return reply.code(401).send({ message: 'Login ou senha inválidos.' });
        }
        const previous = request.cookies[cookieName];
        if (previous && /^[a-f0-9]{64}$/.test(previous)) {
          await client.query('UPDATE sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1 AND revoked_at IS NULL', [digest(previous)]);
        }
        const session = await client.query(`INSERT INTO sessions(user_id,token_hash,expires_at)
          VALUES ($1,$2,clock_timestamp()+$3*interval '1 second') RETURNING expires_at`, [user.id, digest(token), config.sessionSeconds]);
        expiresAt = session.rows[0].expires_at;
        // Limpeza de janelas antigas participa da mesma transação da sessão.
        await client.query('DELETE FROM login_limits WHERE resets_at<clock_timestamp()');
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      const publicUser: AuthUser = { id: user.id, login: user.login, name: user.name, isAdmin: user.isAdmin };
      reply.setCookie(cookieName, token, { ...cookieOptions, maxAge: config.sessionSeconds, expires: expiresAt });
      return { user: publicUser, expiresAt: expiresAt.toISOString() } satisfies AuthSession;
    } finally { hashing--; }
  });

  registerAuthorization(app, pool);
  registerAdministration(app, pool);
  registerPark(app, pool);
  registerDesks(app, pool);
  registerRacks(app, pool);
  registerConnections(app, pool);
  registerLayout(app, pool);
  registerFiles(app, pool, filesDirectory);
  app.get('/api/auth/session', { config: { access: 'session' } }, async request => request.session!);
  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[cookieName];
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      await pool.query('UPDATE sessions SET revoked_at=clock_timestamp() WHERE token_hash=$1 AND revoked_at IS NULL', [digest(token)]);
    }
    reply.clearCookie(cookieName, cookieOptions);
    return reply.code(204).send();
  });
  app.get('/api/park', { config: { access: 'session' } }, async () => ({ message: 'Selecione uma empresa autorizada para acessar seu parque.' }));
  return app;
}
