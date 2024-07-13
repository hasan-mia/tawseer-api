import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt']) {
  // constructor(private readonly reflector: Reflector) {
  //   super();
  // }
  // canActivate(context: ExecutionContext): boolean {
  //   const roles = this.reflector.get<string[]>('roles', context.getHandler());
  //   if (!roles) {
  //     return true;
  //   }
  //   const request = context.switchToHttp().getRequest();
  //   const user = request.user;
  //   if (!user) {
  //     throw new UnauthorizedException();
  //   }
  //   const hasRole = () => roles.includes(user.role);
  //   return user && user.role && hasRole();
  // }
}
