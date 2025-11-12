import { uniqueID } from '@/helpers/myHelper.helper';
import { Transaction } from '@/schemas/transaction.schema';
import { Vendor } from '@/schemas/vendor.schema';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class TransactionService {
    constructor(
        @InjectModel(Transaction.name)
        private transactionModel: Model<Transaction>,
        @InjectModel(Vendor.name)
        private vendorModel: Model<Vendor>,
    ) { }

    /**
     * Create a reusable transaction
     */
    async createTransaction(data: {
        user: string;
        vendor?: string;
        type: 'subscribe' | 'service' | 'coin' | 'product' | 'withdraw' | 'deposit' | 'refund' | 'appointment';
        payment_method: 'cash_on' | 'stripe' | 'paypal' | 'bkash' | 'nagad' | 'paytm' | 'bank_transfer' | 'wallet';
        referenceType: 'service' | 'product' | 'appointment' | 'subscription';
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

    // ======== Get all transaction ========
    async getAllTransaction(req: any) {
        try {
            const { keyword, limit, page } = req.query;

            let perPage: number | undefined;
            if (typeof limit === 'string') {
                perPage = parseInt(limit, 10);
            }

            const searchCriteria: any = {};

            if (keyword) {
                // Search across multiple fields
                searchCriteria.$or = [
                    { trxID: { $regex: keyword, $options: 'i' } },
                    { type: { $regex: keyword, $options: 'i' } },
                    { status: { $regex: keyword, $options: 'i' } },
                    { payment_method: { $regex: keyword, $options: 'i' } }
                ];
            }

            const count = await this.transactionModel.countDocuments(searchCriteria);

            const currentPage = page ? parseInt(page as string, 10) : 1;
            const skip = perPage ? (currentPage - 1) * perPage : 0;

            const query = this.transactionModel
                .find(searchCriteria)
                .populate('user', 'name email mobile avatar cover')
                .populate('vendor', 'name email mobile avatar') // Added vendor populate
                .select('-__v')
                .sort({ createdAt: -1 })
                .skip(skip);

            if (perPage) {
                query.limit(perPage);
            }

            const result = await query.exec();
            const totalPages = perPage ? Math.ceil(count / perPage) : 1;

            let nextPage: number | null = null;
            let nextUrl: string | null = null;

            if (perPage && currentPage < totalPages) {
                nextPage = currentPage + 1;
                nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
                if (keyword) {
                    nextUrl += `&keyword=${encodeURIComponent(keyword)}`;
                }
            }

            const data = {
                success: true,
                data: result || [],
                total: count,
                perPage,
                currentPage,
                totalPages,
                nextPage,
                nextUrl,
            };

            return data;
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(error.message);
        }
    }


    // ======== Get all transaction by user ========
    async getAllTransactionByUser(req: any) {
        try {
            const userId = req.user.id;
            const role = req.user.role;

            const { keyword, limit, page } = req.query;

            let perPage: number | undefined;
            if (typeof limit === 'string') {
                perPage = parseInt(limit, 10);
            }

            const searchCriteria: any = {};

            // Set user/vendor filter based on role
            if (role === 'vendor') {
                const ven = await this.vendorModel.findOne({ user: userId });

                if (!ven) {
                    throw new NotFoundException('Vendor profile not found');
                }
                searchCriteria.vendor = ven._id;

            } else {
                searchCriteria.user = new Types.ObjectId(userId);
            }

            // Add keyword search
            if (keyword != "undefined") {
                searchCriteria.$or = [
                    { trxID: { $regex: keyword, $options: 'i' } },
                    { type: { $regex: keyword, $options: 'i' } },
                    { status: { $regex: keyword, $options: 'i' } },
                    { payment_method: { $regex: keyword, $options: 'i' } }
                ];
            }


            const count = await this.transactionModel.countDocuments(searchCriteria);


            const currentPage = page ? parseInt(page as string, 10) : 1;
            const skip = perPage ? (currentPage - 1) * perPage : 0;

            const query = this.transactionModel
                .find(searchCriteria)
                .populate('user', 'name email mobile avatar cover')
                .populate('vendor', 'name email mobile avatar')
                .select('-__v')
                .sort({ createdAt: -1 })
                .skip(skip);

            if (perPage) {
                query.limit(perPage);
            }

            const result = await query.exec();
            const totalPages = perPage ? Math.ceil(count / perPage) : 1;

            let nextPage: number | null = null;
            let nextUrl: string | null = null;

            if (perPage && currentPage < totalPages) {
                nextPage = currentPage + 1;
                nextUrl = `${req.originalUrl.split('?')[0]}?limit=${perPage}&page=${nextPage}`;
                if (keyword != "undefined") {
                    nextUrl += `&keyword=${encodeURIComponent(keyword)}`;
                }
            }

            const data = {
                success: true,
                data: result || [],
                total: count,
                perPage,
                currentPage,
                totalPages,
                nextPage,
                nextUrl,
            };

            return data;
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(error.message);
        }
    }

    // ======== Get transaction details by ID ========
    async getTransactionDetails(id: string) {
        try {
            const data = await this.transactionModel
                .findById(id)
                .populate('user', 'name email mobile avatar cover')
                .populate('vendor', 'name email mobile avatar')
                .select('-__v')
                .exec();

            if (!data) {
                throw new NotFoundException('Transaction not found');
            }

            const result = {
                success: true,
                message: 'Transaction found successfully',
                data: data,
            };

            return result;
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(error.message);
        }
    }
}
