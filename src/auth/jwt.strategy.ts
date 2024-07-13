import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from 'src/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload) {
    const { id } = payload;

    const user = await this.userModel
      .findById(id)
      .select({ __v: 0, password: 0 })
      .populate({
        path: 'profile',
        select: '-__v',
      })
      .populate({
        path: 'locations',
        select: '-__v',
      })
      .populate({
        path: 'topup',
        select: '-__V',
      })
      .populate({
        path: 'withdraw',
        select: '-__V',
      })
      .exec();

    if (!user) {
      throw new UnauthorizedException('You are not authorized');
    }

    return user;
  }
}
