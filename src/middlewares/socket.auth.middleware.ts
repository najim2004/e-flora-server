import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types/auth.types';

export interface AuthenticatedSocket extends Socket {
  userId: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Cookie থেকে token extract করার function
function getTokenFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      return [name, rest.join('=')];
    })
  );

  return cookies['token'] || null;
}

// Socket middleware function
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = getTokenFromCookie(cookieHeader);

    if (!token) {
      return next(new Error('Authentication error: No token in cookies'));
    }

    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    (socket as AuthenticatedSocket).userId = payload._id;

    next();
  } catch {
    return next(new Error('Authentication error: Invalid token'));
  }
}
