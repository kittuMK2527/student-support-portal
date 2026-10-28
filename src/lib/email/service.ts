// Swap in a real provider (Resend, SendGrid, Nodemailer on a server) with setEmailService.
import type { Database, EmailMessage } from '@/types';
import { newId } from '@/lib/api/crypto';
import { nowIso } from '@/lib/api/clock';

export type OutgoingEmail = Omit<EmailMessage, 'id' | 'sentAt'>;

export interface EmailService {
  readonly name: string;
  send(email: OutgoingEmail, db: Database): Promise<EmailMessage>;
}

export class MockOutboxEmailService implements EmailService {
  readonly name = 'Mock outbox (no real email is sent)';
  async send(email: OutgoingEmail, db: Database): Promise<EmailMessage> {
    const msg: EmailMessage = { ...email, id: newId('mail'), sentAt: nowIso() };
    db.emails.push(msg);
    return msg;
  }
}

let service: EmailService = new MockOutboxEmailService();
export const emailService = () => service;
export const setEmailService = (s: EmailService) => {
  service = s;
};
