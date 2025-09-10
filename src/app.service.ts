/* eslint-disable prettier/prettier */
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    // eslint-disable-next-line prettier/prettier
    constructor(private readonly mailService: MailerService) { }

    // Check Server
    getHello(): string {
        return ` 
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tawseer API Server</title>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    overflow: hidden;
                }

                .flex {
                    display:flex;
                }
                
                .justify-center{
                    justify-content:center;
                }

                .justify-between{
                    justify-content:space-between;
                }
                
                .container {
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 20px;
                    padding: 3rem 2rem;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                    max-width: 500px;
                    width: 90%;
                    animation: fadeInUp 0.8s ease-out;
                }

                .logo {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    color: #ffd700;
                    animation: pulse 2s infinite;
                }

                .title {
                    font-size: 2.5rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                    background: linear-gradient(45deg, #ffd700, #fff);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .subtitle {
                    font-size: 1.1rem;
                    opacity: 0.9;
                    margin-bottom: 2rem;
                    font-weight: 300;
                }

                .status {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(76, 175, 80, 0.2);
                    border: 1px solid #4CAF50;
                    border-radius: 50px;
                    padding: 0.8rem 1.5rem;
                    font-size: 1rem;
                    font-weight: 500;
                    margin-bottom: 2rem;
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    background: #4CAF50;
                    border-radius: 50%;
                    animation: blink 1.5s infinite;
                }

                .info {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .info-item {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    padding: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .info-label {
                    font-size: 0.9rem;
                    opacity: 0.8;
                    margin-bottom: 0.3rem;
                }

                .info-value {
                    font-size: 1.1rem;
                    font-weight: 600;
                }

                .footer {
                    margin-top: 2rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 0.9rem;
                    opacity: 0.8;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }

                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }

                @media (max-width: 600px) {
                    .container {
                        padding: 2rem 1.5rem;
                    }
                    .title {
                        font-size: 2rem;
                    }
                    .info {
                        grid-template-columns: 1fr;
                    }
                }
            </style>
            </head>
            <body>
                <div class="container">
                   <div class="flex justify-between">
                        <div class="logo">
                            <i class="fas fa-cut"></i>
                        </div>
                        <div class="logo">
                            <i class="fas fa-shopping-bag"></i>
                        </div>
                   </div>
                    <h1 class="title">Tawseer API Server</h1>
                    <p class="subtitle">Professional Beauty & Product Management System</p>

                    <div class="status">
                        <span class="status-dot"></span>
                        Server Running Successfully
                    </div>

                    <div class="info">
                        <div class="info-item">
                            <div class="info-label">Version</div>
                            <div class="info-value">v1.0.0</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Environment</div>
                            <div class="info-value">Production</div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>&copy; 2025 Tawseer Management System. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        `;
    }

    // Send Email Server
    sendOtp(options: any) {
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
                    <p>Best regards,<br>Tawseer Team</p>
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
