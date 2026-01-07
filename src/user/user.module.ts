import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { UserSchema } from '@/schemas/user.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'User', schema: UserSchema }, { name: 'Vendor', schema: VendorSchema }])],
  controllers: [UserController],
  providers: [UserService, CloudinaryService],
  exports: [UserService],
})
export class UserModule { }
