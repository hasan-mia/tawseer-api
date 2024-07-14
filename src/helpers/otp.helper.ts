/* eslint-disable prettier/prettier */
export function generateRandomFourDigitOtp(): number {
    return Math.floor(1000 + Math.random() * 9000);
}
