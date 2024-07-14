/* eslint-disable prettier/prettier */
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    // eslint-disable-next-line prettier/prettier
    constructor(private readonly mailService: MailerService) { }

    // Check Server
    getHello(): string {
        return 'Welcome to salon server!';
    }

    // Send Email Server
    sendMail(options: any) {
        const htmlTemplate = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${options.subject}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        padding: 20px;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #fff;
                        border-radius: 10px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    }
                    h1 {
                        color: #333;
                    }
                    p {
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>${options.subject}</h1>
                    <p>Hello, ${options.name}</p>
                    ${options.message}
                    <p>If you did not request this, please ignore this email.</p>
                    <p>Best regards,<br>Salon Team</p>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: `Salon <${process.env.SMTP_MAIL}>`,
            to: options.email,
            subject: options.subject,
            html: htmlTemplate,
        };

        this.mailService.sendMail(mailOptions);
    }
}
