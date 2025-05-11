import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
    constructor(private readonly mailService: MailerService) { }

    sendOtp(options: any) {
        const htmlTemplate = `<!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${options.subject}</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    background-color: #f8f9fa;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #343a40;
                }
                .email-wrapper {
                    width: 100%;
                    padding-top: 20px;
                     padding-bottom: 20px;
                    background-color: #f8f9fa;
                }
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 8px;
                    padding: 30px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }
                .email-header {
                    border-bottom: 1px solid #dee2e6;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                }
                .email-header h1 {
                    margin: 0;
                    font-size: 24px;
                    color: #212529;
                }
                .email-body {
                    font-size: 16px;
                    line-height: 1.6;
                    color: #495057;
                }
                .email-footer {
                    margin-top: 30px;
                    font-size: 14px;
                    color: #868e96;
                    border-top: 1px solid #dee2e6;
                    padding-top: 15px;
                }
                @media only screen and (max-width: 600px) {
                    .email-container {
                        padding: 10px;
                    }
                }
            </style>
            </head>
            <body>
            <div class="email-wrapper">
                <div class="email-container">
                <div class="email-header">
                    <h1>${options.subject}</h1>
                </div>
                <div class="email-body">
                    <p>Dear ${options.name},</p>
                    ${options.message}
                    <p>If you did not initiate this request, please disregard this email.</p>
                </div>
                <div class="email-footer">
                    <p>Best regards,<br><strong>The Tawseer Team</strong></p>
                </div>
                </div>
            </div>
            </body>
            </html>
            `;

        const mailOptions = {
            from: `Tawseer <${process.env.SMTP_MAIL}>`,
            to: options.email,
            subject: options.subject,
            html: htmlTemplate,
        };

        this.mailService.sendMail(mailOptions);
    }
}
