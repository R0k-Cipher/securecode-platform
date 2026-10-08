
import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import nodemailer, {
  type Transporter,
} from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger =
    new Logger(
      EmailService.name,
    );

  private readonly transporter:
    Transporter | null;

  private readonly from:
    string;

  constructor(
    private readonly config:
      ConfigService,
  ) {
    this.from =
      this.config.get<string>(
        'MAIL_FROM',
      ) ??
      'SecureCode <no-reply@securecode.local>';

    const host =
      this.config.get<string>(
        'SMTP_HOST',
      );

    const port =
      Number(
        this.config.get<string>(
          'SMTP_PORT',
        ) ?? 587,
      );

    const user =
      this.config.get<string>(
        'SMTP_USER',
      );

    const pass =
      this.config.get<string>(
        'SMTP_PASSWORD',
      );

    if (
      !host ||
      !user ||
      !pass
    ) {
      this.logger.warn(
        'SMTP non configuré : les emails ne seront pas envoyés.',
      );

      this.transporter =
        null;

      return;
    }

    this.transporter =
      nodemailer.createTransport({
        host,
        port,

        secure:
          port === 465,

        auth: {
          user,
          pass,
        },
      });
  }

  isConfigured():
    boolean {
    return Boolean(
      this.transporter,
    );
  }

  async send(
    input: {
      to: string;
      subject: string;
      html: string;
      text?: string;
    },
  ): Promise<{
    sent: boolean;
    messageId: string | null;
  }> {
    if (
      !this.transporter
    ) {
      this.logger.warn(
        `Email non envoyé à ${input.to}: SMTP non configuré.`,
      );

      return {
        sent: false,
        messageId: null,
      };
    }

    try {
      const result =
        await this.transporter.sendMail({
          from: this.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
        });

      this.logger.log(
        `Email envoyé avec succès à ${input.to}`,
      );

      return {
        sent: true,
        messageId: result.messageId ?? null,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const stack =
        error instanceof Error
          ? error.stack
          : undefined;

      this.logger.error(
        `Échec SMTP pour ${input.to}: ${message}`,
        stack,
      );

      return {
        sent: false,
        messageId: null,
      };
    }
  }

  async sendOrganizationInvitation(
    input: {
      to: string;
      organizationName: string;
      inviterName: string;
      roleName: string;
      token: string;
      expiresAt: Date;
    },
  ) {
    const frontendUrl =
      (
        this.config.get<string>(
          'FRONTEND_URL',
        ) ??
        'http://localhost:4200'
      )
        .replace(
          /\/+$/,
          '',
        );

    const invitationUrl =
      `${frontendUrl}/invitation?token=${encodeURIComponent(
        input.token,
      )}`;

    const subject =
      `Invitation à rejoindre ${input.organizationName}`;

    const html =
      `
      <!doctype html>
      <html lang="fr">
      <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
          <tr>
            <td align="center">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
                <tr>
                  <td style="padding:26px 30px;background:#0b1220;color:#fff">
                    <div style="font-size:18px;font-weight:700">SecureCode</div>
                    <div style="margin-top:5px;font-size:11px;color:#94a3b8;letter-spacing:.12em">CODE SECURITY PLATFORM</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px">
                    <h1 style="margin:0 0 14px;font-size:22px">Invitation à rejoindre une organisation</h1>
                    <p style="margin:0 0 14px;line-height:1.6;color:#475569">
                      ${this.escapeHtml(
                        input.inviterName,
                      )} vous invite à rejoindre
                      <strong>${this.escapeHtml(
                        input.organizationName,
                      )}</strong>
                      avec le rôle
                      <strong>${this.escapeHtml(
                        input.roleName,
                      )}</strong>.
                    </p>
                    <p style="margin:0 0 22px;line-height:1.6;color:#64748b">
                      Cette invitation expire le
                      ${input.expiresAt.toLocaleString(
                        'fr-FR',
                      )}.
                    </p>
                    <a href="${invitationUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
                      Accepter l'invitation
                    </a>
                    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;word-break:break-all">
                      ${invitationUrl}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
      `;

    return this.send({
      to:
        input.to,

      subject,

      html,

      text:
        `${input.inviterName} vous invite à rejoindre ${input.organizationName} comme ${input.roleName}. ${invitationUrl}`,
    });
  }

  /**
   * Envoie les accès (login + mot de passe temporaire) à une personne
   * qui n'a pas encore de compte sur la plateforme.
   */
  async sendOrganizationInvitationWithCredentials(
    input: {
      to: string;

      login: string;

      organizationName:
        string;

      inviterName:
        string;

      roleName:
        string;

      temporaryPassword:
        string;

      token:
        string;

      expiresAt:
        Date;
    },
  ) {
    const frontendUrl =
      (
        this.config.get<string>(
          'FRONTEND_URL',
        ) ??
        'http://localhost:4200'
      )
        .replace(
          /\/+$/,
          '',
        );

    const activationUrl =
      `${frontendUrl}/invitation?token=${encodeURIComponent(
        input.token,
      )}`;

    const subject =
      `Votre accès SecureCode — ${input.organizationName}`;

    const expiration =
      input.expiresAt
        .toLocaleString(
          'fr-FR',
        );

    const html =
      `
      <!doctype html>
      <html lang="fr">
      <body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a">

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">

          <tr>
            <td align="center">

              <table role="presentation" width="600" cellspacing="0" cellpadding="0"
                style="max-width:600px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">

                <tr>
                  <td style="padding:26px 30px;background:#0b1220;color:#fff">

                    <div style="font-size:18px;font-weight:700">
                      SecureCode
                    </div>

                    <div style="margin-top:5px;font-size:11px;color:#94a3b8;letter-spacing:.12em">
                      CODE SECURITY PLATFORM
                    </div>

                  </td>
                </tr>

                <tr>
                  <td style="padding:30px">

                    <h1 style="margin:0 0 18px;font-size:22px">
                      Votre accès à
                      ${this.escapeHtml(
                        input.organizationName,
                      )}
                    </h1>

                    <p style="line-height:1.6;color:#475569">
                      ${this.escapeHtml(
                        input.inviterName,
                      )}
                      vous invite à rejoindre
                      <strong>
                        ${this.escapeHtml(
                          input.organizationName,
                        )}
                      </strong>.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                      style="margin:22px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">

                      <tr>
                        <td style="padding:18px">

                          <div style="font-size:12px;color:#64748b">
                            LOGIN SECURECODE
                          </div>

                          <div style="font-size:16px;font-weight:700;margin:5px 0 16px">
                            ${this.escapeHtml(
                              input.login,
                            )}
                          </div>

                          <div style="font-size:12px;color:#64748b">
                            MOT DE PASSE TEMPORAIRE
                          </div>

                          <div style="font-size:16px;font-weight:700;font-family:monospace;margin:5px 0 16px">
                            ${this.escapeHtml(
                              input.temporaryPassword,
                            )}
                          </div>

                          <div style="font-size:12px;color:#64748b">
                            RÔLE
                          </div>

                          <div style="font-size:16px;font-weight:700;margin-top:5px">
                            ${this.escapeHtml(
                              input.roleName,
                            )}
                          </div>

                        </td>
                      </tr>

                    </table>

                    <p style="line-height:1.6;color:#64748b">
                      Cette invitation et ce mot de passe temporaire expirent le
                      <strong>
                        ${this.escapeHtml(
                          expiration,
                        )}
                      </strong>.
                    </p>

                    <p style="line-height:1.6;color:#64748b">
                      Vous devrez définir votre mot de passe personnel avant
                      l'activation de votre compte.
                    </p>

                    <a
                      href="${activationUrl}"
                      style="display:inline-block;margin-top:12px;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:700"
                    >
                      Activer mon compte
                    </a>

                  </td>
                </tr>

              </table>

            </td>
          </tr>

        </table>

      </body>
      </html>
      `;

    return this.send({
      to:
        input.to,

      subject,

      html,

      text:
        `${input.inviterName} vous invite à rejoindre ${input.organizationName}. ` +
        `Login : ${input.login}. ` +
        `Mot de passe temporaire : ${input.temporaryPassword}. ` +
        `Rôle : ${input.roleName}. ` +
        `Expiration : ${expiration}. ` +
        `Activation : ${activationUrl}`,
    });
  }

  private escapeHtml(
    value: string,
  ): string {
    return value
      .replace(
        /&/g,
        '&amp;',
      )
      .replace(
        /</g,
        '&lt;',
      )
      .replace(
        />/g,
        '&gt;',
      )
      .replace(
        /"/g,
        '&quot;',
      )
      .replace(
        /'/g,
        '&#039;',
      );
  }
}

