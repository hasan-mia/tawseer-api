/* eslint-disable prettier/prettier */
import { Document, Query } from 'mongoose';

interface QueryParams {
    keyword?: string;
    price?: {
        gte?: number;
        lte?: number;
    };
    categoryInfo?: {
        categoryID?: string;
        category?: string;
    };
    page?: number;
    limit?: number;
}

export class ApiFeatures<T extends Document> {
    query: Query<T[], T>;

    constructor(query: Query<T[], T>, private queryStr: QueryParams) {
        this.query = query;
    }

    search() {
        if (this.queryStr.keyword) {
            this.query = this.query.find({
                $or: [
                    { name: { $regex: this.queryStr.keyword, $options: 'i' } },
                    { email: { $regex: this.queryStr.keyword, $options: 'i' } },
                    { username: { $regex: this.queryStr.keyword, $options: 'i' } },
                    { mobile: { $regex: this.queryStr.keyword, $options: 'i' } },
                ],
            });
        }
        return this;
    }

    filter() {
        const queryCopy: QueryParams = { ...this.queryStr };
        const removeFields = ['keyword', 'page', 'limit'];
        removeFields.forEach((key) => delete (queryCopy as any)[key]);

        // Price Filtering
        if (queryCopy.price) {
            const priceFilter: any = {};
            if (queryCopy.price.gte) priceFilter.$gte = queryCopy.price.gte;
            if (queryCopy.price.lte) priceFilter.$lte = queryCopy.price.lte;
            this.query = this.query.find({ price: priceFilter });
        }

        // Category Filtering
        if (queryCopy.categoryInfo) {
            const categoryFilter: any = {};
            if (queryCopy.categoryInfo.categoryID) {
                categoryFilter['categoryInfo.categoryID'] = queryCopy.categoryInfo.categoryID;
            }
            if (queryCopy.categoryInfo.category) {
                categoryFilter['categoryInfo.category'] = queryCopy.categoryInfo.category;
            }
            this.query = this.query.find(categoryFilter);
        }

        return this;
    }

    pagination(resultPerPage: number) {
        const currentPage = this.queryStr.page ? Number(this.queryStr.page) : 1;
        const skip = resultPerPage * (currentPage - 1);

        this.query = this.query.limit(resultPerPage).skip(skip);
        return this;
    }
}
