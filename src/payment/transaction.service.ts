import { uniqueID } from '@/helpers/myHelper.helper';
import { Transaction } from '@/schemas/transaction.schema';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TransactionService {
    constructor(
        @InjectModel(Transaction.name)
        private transactionModel: Model<Transaction>,
    ) { }

    /**
     * Create a reusable transaction
     */
    async createTransaction(data: {
        user: string;
        vendor?: string;
        type: 'subscribe' | 'service' | 'coin' | 'product' | 'withdraw' | 'deposit' | 'refund' | 'appointment';
        payment_method: 'cash_on' | 'stripe' | 'paypal' | 'bkash' | 'nagad' | 'paytm' | 'bank_transfer' | 'wallet';
        referenceType: 'Service' | 'Product' | 'Appointment' | 'Subscription';
        referenceId: string;
        amount: number;
        currency: string;
        country: string;
        charge?: number;
        tax?: number;
        bank_details?: any;
        sender?: any;
        receiver?: any;
    }) {
        try {
            const trxID = `TRX-${uniqueID()}`;

            const totalAmount =
                (data.amount || 0) +
                (data.charge || 0) +
                (data.tax || 0);

            const transaction = await this.transactionModel.create({
                uuid: uuidv4(),
                trxID,
                user: new Types.ObjectId(data.user),
                vendor: data.vendor ? new Types.ObjectId(data.vendor) : null,
                type: data.type,
                status: 'pending',
                payment_method: data.payment_method,
                referenceType: data.referenceType,
                referenceId: new Types.ObjectId(data.referenceId),
                amount: data.amount,
                totalAmount,
                currency: data.currency,
                country: data.country,
                bank_details: data.bank_details,
                charge: data.charge || 0,
                tax: data.tax || 0,
                sender: data.sender,
                receiver: data.receiver,
            });

            return transaction;
        } catch (err) {
            throw new InternalServerErrorException(`Transaction creation failed: ${err.message}`);
        }
    }

    /**
     * Update transaction status
     */
    async updateStatus(trxID: string, status: 'pending' | 'success' | 'canceled' | 'failed' | 'refunded' | 'on_hold') {
        return this.transactionModel.findOneAndUpdate(
            { trxID },
            { status },
            { new: true },
        );
    }
}
