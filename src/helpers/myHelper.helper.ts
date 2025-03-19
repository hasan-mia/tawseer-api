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

export const calculateTransactionFee = (amount: number, type: string) => {
    const feeRates = {
        service: 0.02,  // 2%
        product: 0.03,  // 3%
        withdraw: 0.05, // 5%
        deposit: 0,     // No fee
    };

    return amount * (feeRates[type] || 0.02);
}

