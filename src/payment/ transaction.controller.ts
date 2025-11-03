import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards
} from '@nestjs/common';
import { TransactionService } from './transaction.service';

@Controller('transactions')
export class TransactionController {
  constructor(
    private transactionService: TransactionService
  ) { }

  // ======== Get All Transaction ========
  @Get('')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getAllTransaction(
    @Request() req
  ) {
    return this.transactionService.getAllTransaction(req);
  }

  // ======== Get All Transaction by user========
  @Get('user')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getAllTransactionByUser(
    @Request() req
  ) {
    return this.transactionService.getAllTransactionByUser(req);

  }
  // ======== Get All Transaction details========
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTransactionDetails(
    @Request() req
  ) {
    return this.transactionService.getTransactionDetails(req.params.id);

  }

}