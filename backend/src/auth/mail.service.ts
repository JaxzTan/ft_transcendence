import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { secret } from '../secrets';

/**
 * Sends transactional email (verification links, 2FA codes).
 *
 * SMTP config comes from secrets/smtp_credentials.txt in the form
 *   [smtp.gmail.com]:587 address@gmail.com:app-password
 * When the file is missing or still holds the template placeholder, the
 * service degrades to logging the mail body to the console — every flow
 * stays testable in dev by reading `docker compose logs backend`.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = '';

  constructor() {
    const raw = secret('SMTP_CREDENTIALS');
    const parsed = raw?.match(/^\[([^\]]+)\]:(\d+)\s+([^:<\s]+@[^:\s]+):(.+)$/);
    if (parsed) {
      const [, host, port, user, pass] = parsed;
      this.from = user;
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: false, // 587 = STARTTLS
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP credentials missing or placeholder — emails will be LOGGED to this console instead of sent.',
      );
    }
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`📧 [DEV MAIL] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      this.logger.error(`sendMail to ${to} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not send email — try again later');
    }
  }

  sendVerification(to: string, link: string): Promise<void> {
    return this.send(
      to,
      'Verify your 42 Ludo account',
      `Welcome to 42 Ludo!\n\nConfirm this email address by opening:\n\n${link}\n\nThe link expires in 24 hours. If you did not sign up, ignore this mail.`,
    );
  }

  sendPasswordReset(to: string, link: string): Promise<void> {
    return this.send(
      to,
      'Reset your 42 Ludo password',
      `We received a request to reset your password.\n\nChoose a new one here:\n\n${link}\n\nThe link expires in 1 hour and can be used once. If you did not request this, ignore this mail — your password stays unchanged.`,
    );
  }

  send2faCode(to: string, code: string): Promise<void> {
    return this.send(
      to,
      `${code} is your 42 Ludo login code`,
      `Your login code is: ${code}\n\nIt expires in 5 minutes. If you did not try to log in, someone knows your password — change it.`,
    );
  }
}
