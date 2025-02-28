/* eslint-disable prettier/prettier */
import otpGenerator from "otp-generator";

export const uniqueID = () => {
    const randomPart = otpGenerator.generate(4, {
        digits: true,
        lowerCaseAlphabets: true,
        upperCaseAlphabets: true,
        specialChars: false,
    });
    const timestampPart = Date.now().toString().slice(-4);
    const transactionID = `${randomPart}${timestampPart}`.slice(0, 10);

    return transactionID;
};

export const getPublicIdFromUrl = (url: string): string | null => {
    const regex = /\/upload\/[^/]+\/([^/]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
