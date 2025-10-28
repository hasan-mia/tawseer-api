import { AppointmentSchema } from '@/schemas/appointment.schema';
import { NotificationSchema } from '@/schemas/notification.schema';
import { UserSchema } from '@/schemas/user.schema';
import { VendorSchema } from '@/schemas/vendor.schema';
import { QueueGateway } from '@/socket/queue.gateway';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueController } from './queue.controller';
import { QueueManagementService } from './queue.service';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        MongooseModule.forFeature([
            { name: "Appointment", schema: AppointmentSchema },
            { name: "Notification", schema: NotificationSchema },
            { name: "User", schema: UserSchema },
            { name: "Vendor", schema: VendorSchema },

        ]),
    ],
    providers: [QueueManagementService, QueueGateway],
    controllers: [QueueController],
    exports: [QueueManagementService],
})
export class QueueModule { }