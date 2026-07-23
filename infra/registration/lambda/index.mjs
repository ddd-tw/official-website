/**
 * DDD Taiwan 自營報名 API（Phase 3a，AWS 版）
 * Lambda (Node 20) + API Gateway HTTP API + DynamoDB 單表 + SES
 *
 * Endpoints（與前端契約同 Cloudflare 版，路徑不變）：
 *   POST /api/register            報名 { eventId, name, email, ticketType? }
 *   GET  /api/events/{id}/stats   名額狀態 { registered, capacity, open }
 *   POST /api/checkin             驗票 { qrToken, staff }（需 X-Staff-Key）
 *   GET  /api/export/{eventId}    匯出名單 CSV（需 X-Staff-Key；餵成就 build）
 *
 * DynamoDB 單表設計（TABLE_NAME）：
 *   活動設定   PK=EVENT#{eventId}  SK=META            { capacity, deadline, open }
 *   報名紀錄   PK=EVENT#{eventId}  SK=REG#{email}     { name, ticketType, qrToken, createdAt,
 *                                                       checkedInAt?, checkedInBy? }
 *   QR 反查    PK=QR#{qrToken}     SK=QR              { eventId, email }
 *   PK/SK 天生防同活動重複報名；出席直接寫回報名 item，無需第二張表。
 *
 * 環境變數：TABLE_NAME, STAFF_KEY, ALLOWED_ORIGIN, SES_FROM（未設時跳過寄信，QR 回傳前端）
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { randomBytes } from 'node:crypto';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});
const TABLE = process.env.TABLE_NAME;

const CORS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://ddd-tw.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Staff-Key',
};
const json = (data, status = 200, extra = {}) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
  body: JSON.stringify(data),
});

const qrToken = () => randomBytes(16).toString('hex');
const regId = () => `${Date.now().toString(36)}${randomBytes(6).toString('hex')}`;

async function sendTicketEmail({ email, name, eventId, token }) {
  if (!process.env.SES_FROM) return false;
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${token}`;
  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: process.env.SES_FROM,
      Destination: { ToAddresses: [email] },
      Content: {
        Simple: {
          Subject: { Data: `你的活動票券 — ${eventId}`, Charset: 'UTF-8' },
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: `<p>${name} 你好，</p><p>這是你的入場 QR code，活動當天請出示：</p>
                     <p><img src="${qrImg}" alt="QR" width="240" height="240"></p>
                     <p>活動資訊：https://ddd-tw.com/events/</p><p>— DDD Taiwan</p>`,
            },
          },
        },
      },
    }));
    return true;
  } catch (e) {
    console.error('SES send failed:', e);
    return false;
  }
}

async function getMeta(eventId) {
  const { Item } = await db.send(new GetCommand({
    TableName: TABLE, Key: { PK: `EVENT#${eventId}`, SK: 'META' },
  }));
  return Item;
}

async function countConfirmed(eventId) {
  let n = 0, lastKey;
  do {
    const res = await db.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :reg)',
      FilterExpression: '#st = :confirmed',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: { ':pk': `EVENT#${eventId}`, ':reg': 'REG#', ':confirmed': 'confirmed' },
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    }));
    n += res.Count;
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return n;
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? '';
  const path = event.rawPath ?? '';
  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS };
  const staffOk = () => (event.headers?.['x-staff-key'] ?? '') === process.env.STAFF_KEY;

  try {
    // ---- 報名 ----
    if (path === '/api/register' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const eventId = String(body.eventId || '').trim();
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const ticketType = String(body.ticketType || 'general').trim();
      if (!eventId || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return json({ error: 'invalid input' }, 400);

      const meta = await getMeta(eventId);
      if (!meta || !meta.open) return json({ error: 'registration closed' }, 403);
      if (meta.deadline && new Date(meta.deadline) < new Date())
        return json({ error: 'deadline passed' }, 403);
      if (meta.capacity != null && (await countConfirmed(eventId)) >= meta.capacity)
        return json({ error: 'full' }, 409);

      const token = qrToken();
      const now = new Date().toISOString();
      try {
        // 報名 item + QR 反查 item 以 transaction 一起寫；條件式防重複報名
        await db.send(new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE,
                Item: {
                  PK: `EVENT#${eventId}`, SK: `REG#${email}`,
                  id: regId(), eventId, email, name, ticketType,
                  status: 'confirmed', qrToken: token, createdAt: now,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: TABLE,
                Item: { PK: `QR#${token}`, SK: 'QR', eventId, email },
              },
            },
          ],
        }));
      } catch (e) {
        if (e.name === 'TransactionCanceledException') return json({ error: 'already registered' }, 409);
        throw e;
      }

      const mailed = await sendTicketEmail({ email, name, eventId, token });
      return json({ ok: true, mailed, ...(mailed ? {} : { qrToken: token }) }, 201);
    }

    // ---- 名額狀態 ----
    const stats = path.match(/^\/api\/events\/([\w-]+)\/stats$/);
    if (stats && method === 'GET') {
      const meta = await getMeta(stats[1]);
      const registered = await countConfirmed(stats[1]);
      return json({ registered, capacity: meta?.capacity ?? null, open: !!meta?.open });
    }

    // ---- 驗票 ----
    if (path === '/api/checkin' && method === 'POST') {
      if (!staffOk()) return json({ error: 'unauthorized' }, 401);
      const { qrToken: token, staff } = JSON.parse(event.body || '{}');
      if (!token) return json({ error: 'invalid ticket' }, 404);
      const { Item: qr } = await db.send(new GetCommand({
        TableName: TABLE, Key: { PK: `QR#${token}`, SK: 'QR' },
      }));
      if (!qr) return json({ error: 'invalid ticket' }, 404);
      const { Item: reg } = await db.send(new GetCommand({
        TableName: TABLE, Key: { PK: `EVENT#${qr.eventId}`, SK: `REG#${qr.email}` },
      }));
      if (!reg || reg.status !== 'confirmed') return json({ error: 'invalid ticket' }, 404);
      if (reg.checkedInAt) return json({ ok: true, already: true, name: reg.name });
      await db.send(new UpdateCommand({
        TableName: TABLE, Key: { PK: `EVENT#${qr.eventId}`, SK: `REG#${qr.email}` },
        UpdateExpression: 'SET checkedInAt = :t, checkedInBy = :s',
        ExpressionAttributeValues: { ':t': new Date().toISOString(), ':s': staff || '' },
      }));
      return json({ ok: true, name: reg.name, ticketType: reg.ticketType });
    }

    // ---- 匯出 CSV（餵成就 build） ----
    const exp = path.match(/^\/api\/export\/([\w-]+)$/);
    if (exp && method === 'GET') {
      if (!staffOk()) return json({ error: 'unauthorized' }, 401);
      const rows = [];
      let lastKey;
      do {
        const res = await db.send(new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :reg)',
          ExpressionAttributeValues: { ':pk': `EVENT#${exp[1]}`, ':reg': 'REG#' },
          ExclusiveStartKey: lastKey,
        }));
        rows.push(...res.Items.filter((r) => r.status === 'confirmed'));
        lastKey = res.LastEvaluatedKey;
      } while (lastKey);
      const csv = ['event_id,email,name,ticket_type,registered_at,checked_in_at']
        .concat(rows.map((r) =>
          [r.eventId, r.email, r.name, r.ticketType, r.createdAt, r.checkedInAt || '']
            .map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')))
        .join('\n');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8', ...CORS },
        body: csv,
      };
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: 'internal' }, 500);
  }
};
