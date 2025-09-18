import { IsArray, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsNotEmpty()
  @IsMongoId()
  senderId: string;

  @IsNotEmpty()
  @IsMongoId()
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];
}
export class GetMessagesDto {
  @IsNotEmpty()
  @IsMongoId()
  conversationId: string;

  @IsOptional()
  @IsString()
  page?: number;

  @IsOptional()
  @IsString()
  limit?: number;
}

export class MarkAsReadDto {
  @IsNotEmpty()
  @IsMongoId()
  messageId: string;
}