import { NotificationModule } from '@/notification/notification.module';
import { AppointmentSchema } from '@/schemas/appointment.schema';
import { NotificationSchema } from '@/schemas/notification.schema';
import { UserSchema } from '@/schemas/user.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { QueueGateway } from '@/socket/queue.gateway';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueController } from './queue.controller';
import { QueueManagementService } from './queue.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: "Appointment", schema: AppointmentSchema },
            { name: "Notification", schema: NotificationSchema },
            { name: "User", schema: UserSchema },
            { name: "Vendor", schema: VendorSchema },

        ]),
        NotificationModule
    ],
    controllers: [QueueController],
    providers: [QueueManagementService, QueueGateway],
    exports: [QueueManagementService, QueueGateway],
})
export class QueueModule { }