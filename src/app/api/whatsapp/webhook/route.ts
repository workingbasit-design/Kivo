import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { isStopText, isHelpText, normalizeInboundText } from '@/lib/messaging/consent';
import { monthKeyInTimezone, quotaAllows } from '@/lib/messaging/quota';
import { sendWhatsAppText } from '@/lib/messaging/providers';
import { unsafeUnscoped } from '@/lib/tenant-guard';

/**
 * WhatsApp Cloud API webhook.
 *
 * GET verifies the webhook (Meta setup). POST receives inbound customer
 * messages — used for CASL STOP/HELP handling: STOP opts the customer out of
 * automated messages (with one confirming reply), HELP gets an info reply.
 * Every inbound message and consent change is logged (tenant-scoped audit).
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (
    mode === 'subscribe' &&
    token &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed.' }, { status: 403 });
}

interface InboundMessage {
  from?: string;
  type?: string;
  text?: { body?: string };
}

function helpReply(locale: string | null | undefined, businessName: string): string {
  if (locale === 'fr') {
    return (
      `Ici ${businessName}. Vous recevez des rappels automatisés parce que vous avez accepté de les recevoir. ` +
      `Répondez ARRÊT pour ne plus en recevoir, ou appelez-nous directement pour toute question.`
    );
  }
  return (
    `This is ${businessName}. You get automated reminders because you opted in. ` +
    `Reply STOP to stop receiving them, or call us directly with any questions.`
  );
}

function stopReply(locale: string | null | undefined, businessName: string): string {
  if (locale === 'fr') {
    return `C'est noté — vous ne recevrez plus de messages automatisés de ${businessName}. Merci!`;
  }
  return `You're unsubscribed — no more automated messages from ${businessName}. Thank you!`;
}

export async function POST(req: Request) {
  // Meta signs every webhook POST with X-Hub-Signature-256
  // (HMAC-SHA256 of the RAW body using the WhatsApp App Secret). Without
  // this check anyone could forge inbound "STOP" messages and opt customers
  // out, or trigger outbound replies to attacker-chosen numbers. Fail
  // closed: no app secret configured, or bad signature, means no processing.
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const rawBody = await req.text();
  if (!appSecret) {
    console.error('[whatsapp:webhook] WHATSAPP_APP_SECRET not configured — rejecting POST');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 403 });
  }
  const sigHeader = req.headers.get('x-hub-signature-256') ?? '';
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`;
  const sigBuf = Buffer.from(sigHeader);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  const entries = (body as { entry?: Array<{ changes?: Array<{ value?: {
    phone_number_id?: string;
    messages?: InboundMessage[];
  } }> }> }).entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.phone_number_id;
      if (!phoneNumberId) continue;

      // Inbound Meta webhook: the phone_number_id (assigned by Meta and
      // stored on our connection row) IS how the tenant is resolved — no
      // business scope can exist before this lookup. The signature check
      // at route entry proves the payload came from Meta.
      const connection = await unsafeUnscoped('whatsapp:resolveConnection', () =>
        prisma.messagingConnection.findFirst({
          where: { channel: 'WHATSAPP', waPhoneNumberId: phoneNumberId, enabled: true },
          include: { business: { select: { id: true, name: true, timezone: true } } },
        })
      );
      if (!connection) continue;
      const business = connection.business;

      for (const msg of value?.messages ?? []) {
        const fromDigits = (msg.from ?? '').replace(/\D/g, '');
        if (!fromDigits || msg.type !== 'text') continue;
        const text = msg.text?.body ?? '';
        const normalized = normalizeInboundText(text);

        const customer = await prisma.customer.findFirst({
          where: {
            businessId: business.id,
            OR: [{ phoneNorm: fromDigits }, { phoneNorm: { endsWith: fromDigits.slice(-10) } }],
          },
          select: { id: true, name: true, preferredLocale: true, messageConsent: true },
        });

        const isStop = isStopText(text);
        const isHelp = isHelpText(text) && !isStop;
        if (!isStop && !isHelp) {
          // Plain reply — log it so the owner sees the conversation context.
          await prisma.messageLog.create({
            data: {
              type: 'WHATSAPP', direction: 'IN', recipient: fromDigits,
              content: text.slice(0, 1000), status: 'DELIVERED',
              customerId: customer?.id ?? null, businessId: business.id,
            },
          });
          continue;
        }

        // STOP → opt out. HELP → info reply. Both logged + consent-audited.
        if (customer && isStop) {
          await prisma.$transaction([
            prisma.customer.update({
              where: { id: customer.id, businessId: business.id },
              data: {
                messageConsent: false,
                messageConsentAt: new Date(),
                messageConsentSource: 'whatsapp-inbound',
              },
            }),
            prisma.consentLog.create({
              data: {
                businessId: business.id, customerId: customer.id,
                channel: 'WHATSAPP', action: 'STOP_RECEIVED', source: 'whatsapp-inbound',
              },
            }),
          ]);
        } else if (customer && isHelp) {
          await prisma.consentLog.create({
            data: {
              businessId: business.id, customerId: customer.id,
              channel: 'WHATSAPP', action: 'HELP_RECEIVED', source: 'whatsapp-inbound',
            },
          });
        }

        await prisma.messageLog.create({
          data: {
            type: 'WHATSAPP', direction: 'IN', recipient: fromDigits,
            content: text.slice(0, 1000),
            status: isStop ? 'STOP_RECEIVED' : 'HELP_RECEIVED',
            customerId: customer?.id ?? null, businessId: business.id,
          },
        });

        // One confirming reply (quota-checked — never silently spends).
        const reply = isStop
          ? stopReply(customer?.preferredLocale, business.name)
          : helpReply(customer?.preferredLocale, business.name);
        const timeZone = business.timezone || 'America/Toronto';
        const month = monthKeyInTimezone(new Date(), timeZone);
        const settings = await prisma.messagingSettings.findUnique({
          where: { businessId: business.id },
        });
        const quota = await prisma.messageQuota.upsert({
          where: { businessId_month: { businessId: business.id, month } },
          create: { businessId: business.id, month },
          update: {},
        });
        const limit = settings?.whatsappLimit ?? 1000;
        if (!quotaAllows(quota.whatsappCount, limit)) continue; // quota exhausted: stay silent
        if (!connection.waAccessToken) continue;

        const sent = await sendWhatsAppText(
          { phoneNumberId, accessToken: connection.waAccessToken },
          fromDigits,
          reply
        );
        await prisma.messageLog.create({
          data: {
            type: 'WHATSAPP', direction: 'OUT', recipient: fromDigits, content: reply,
            status: sent.ok ? 'SENT' : 'FAILED',
            error: sent.ok ? null : `[${sent.errorKind ?? 'unknown'}] ${sent.error ?? ''}`,
            providerMessageId: sent.providerMessageId,
            customerId: customer?.id ?? null, businessId: business.id,
          },
        });
        if (sent.ok) {
          await prisma.messageQuota.update({
            where: { id: quota.id, businessId: business.id },
            data: { whatsappCount: { increment: 1 } },
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
